import express from 'express';
import cors from 'cors';
import fs from 'fs'; 
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import {
  getAllRoutesTelemetry,
  getDashboardStats,
  loadTrafficData,
  getTrafficInsightsSummary,
  getRouteAnalyticsSummary,
  getTrafficHistorySlice,
  evaluateAlternativeRoutes,
  simulatePrediction,
  predictJourneyService,
  getLiveWeatherService,
  getEngineStatusService,
  getGeoJsonRoadSummary,
  getMonitoredCorridorsOsmOverlay
} from './trafficService.js';
import { NODE_COORDINATES, DHAKA_BYPASS_WAYPOINTS, haversineKm } from './routesConfig.js';
import { buildOsmRouteGeometry } from './osmRouter.js';
import { getAllBuses, getBusById, getBusStops, findBusesBetween } from './busService.js';
import { supabase, checkDatabaseHealth } from './db.js';
import { getRlStatus, evaluatePendingPredictions, startRlBackgroundWorker, startOsrmContinuousCollector, run10HourTrainingSimulation, trainWithRealLifeData } from './rlEngine.js';

// Resilient compression import (safe if module not present)
let compression = null;
try {
  const mod = await import('compression');
  compression = mod.default || mod;
} catch {
  console.warn('[Server] Optional compression module not loaded; proceeding without compression.');
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load root .env if present
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const app = express();
const PORT = process.env.PORT || 5000;
const SERVER_START_TIME = Date.now();

// High-performance gzip/brotli compression middleware (if available)
if (compression) {
  app.use(compression({
    threshold: 1024, // Compress responses above 1 KB
    filter: (req, res) => {
      if (req.headers['x-no-compression']) return false;
      return compression.filter(req, res);
    }
  }));
}

// CORS configuration: allow Firebase Hosting domain and localhost in dev
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5000',
  'http://127.0.0.1:3000',
  // Replace with your actual Firebase project URL after deploying
  'https://trafficpulse-dhaka.web.app',
  'https://trafficpulse-dhaka.firebaseapp.com',
];
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (Render health checks, curl) or matching origins
    if (!origin || allowedOrigins.some(o => origin.startsWith(o))) {
      callback(null, true);
    } else {
      callback(null, true); // Keep permissive; tighten after confirming Firebase URL
    }
  },
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));

// Response timing and request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (!res.headersSent) {
      res.setHeader('X-Response-Time', `${duration}ms`);
    }
    if (process.env.NODE_ENV !== 'test') {
      const statusColor = res.statusCode >= 500 ? '❌' : res.statusCode >= 400 ? '⚠️' : '⚡';
      console.log(`[API] ${statusColor} ${req.method} ${req.originalUrl} ${res.statusCode} (${duration}ms)`);
    }
  });
  next();
});

// API Routes

// 1. Overview Dashboard Stats
app.get('/api/stats', (req, res) => {
  try {
    const stats = getDashboardStats();
    res.setHeader('Cache-Control', 'public, max-age=15');
    res.json({ success: true, data: stats });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. All 50 Official Corridors with Live Telemetry
app.get('/api/routes', (req, res) => {
  try {
    const routes = getAllRoutesTelemetry();
    const { level, search } = req.query;

    let filtered = routes;
    if (level && level !== 'ALL') {
      filtered = filtered.filter(r => r.traffic_level.toUpperCase() === level.toUpperCase());
    }
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(r =>
        r.route_code.toLowerCase().includes(q) ||
        r.route_id.toLowerCase().includes(q) ||
        r.origin_name.toLowerCase().includes(q) ||
        r.dest_name.toLowerCase().includes(q)
      );
    }

    res.setHeader('Cache-Control', 'public, max-age=15');
    res.json({ success: true, count: filtered.length, total: routes.length, data: filtered });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Single Corridor Details
app.get('/api/routes/:id', (req, res) => {
  try {
    const code = req.params.id.toUpperCase();
    const routes = getAllRoutesTelemetry();
    const route = routes.find(r => r.route_code === code || r.route_id.includes(code));
    if (!route) {
      return res.status(404).json({ success: false, error: 'Route not found' });
    }
    res.setHeader('Cache-Control', 'public, max-age=30');
    res.json({ success: true, data: route });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Strategic Waypoints Registry
app.get('/api/waypoints', (req, res) => {
  try {
    const nodes = Object.entries(NODE_COORDINATES).map(([name, coords]) => ({
      name,
      lat: coords[0],
      lon: coords[1]
    }));
    res.setHeader('Cache-Control', 'public, max-age=60');
    res.json({
      success: true,
      count: nodes.length,
      waypoints: nodes,
      bypasses: DHAKA_BYPASS_WAYPOINTS
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5. Historical Dataset Explorer with Pagination & Filters
// 5. Historical CSV Telemetry Logs (bounded streaming slice; zero OOM)
app.get('/api/history', (req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    const isAll = req.query.all === 'true' || req.query.limit === 'all';
    const rawLimit = parseInt(req.query.limit, 10);
    const search = req.query.search ? req.query.search.toLowerCase() : '';
    const level = req.query.level;
    const archiveFile = req.query.archive || req.query.file || null;
    const fromDate = req.query.from_date || req.query.start_date || null;
    const toDate = req.query.to_date || req.query.end_date || null;
    const page = parseInt(req.query.page, 10) || 1;

    const result = getTrafficHistorySlice({
      archiveFile,
      fromDate,
      toDate,
      level,
      search,
      page,
      limit: rawLimit || 20,
      all: isAll,
    });

    res.json({
      success: true,
      ...result,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5b. Pre-Aggregated Traffic Insights Summary across ALL 212k+ CSV records (~15 KB payload)
app.get('/api/insights', (req, res) => {
  try {
    res.setHeader('Cache-Control', 'public, max-age=15');
    const summary = getTrafficInsightsSummary();
    if (!summary) {
      return res.json({ success: true, total: 0, data: null });
    }
    res.json({
      success: true,
      isInsightsSummary: true,
      total: summary.total,
      data: summary,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5.0 List Available Historical CSV Datasets & Archives
app.get('/api/archives', (req, res) => {
  try {
    const dataDir = path.resolve(__dirname, '../data');
    const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.csv'));
    const archives = files.map(filename => {
      const filePath = path.join(dataDir, filename);
      const stat = fs.statSync(filePath);
      return {
        filename,
        size_mb: Number((stat.size / (1024 * 1024)).toFixed(2)),
        modified: stat.mtime
      };
    });
    res.json({ success: true, count: archives.length, archives });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5.1 Route Analytics: all 98 corridors ranked from most data to least
app.get('/api/analytics/routes', (req, res) => {
  try {
    const { routes, totalRecords } = getRouteAnalyticsSummary();
    res.json({
      success: true,
      totalRoutes: routes.length,
      totalRecords,
      routes
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6. Alternative Route Advisor / Jam Bypass
app.post('/api/advisor', (req, res) => {
  try {
    const { routeCode, originCoords, destCoords, routeName, delayThreshold } = req.body;

    let origin = originCoords;
    let dest = destCoords;
    let name = routeName || 'Custom Route';

    if (routeCode) {
      const routes = getAllRoutesTelemetry();
      const match = routes.find(r => r.route_code === routeCode.toUpperCase());
      if (match) {
        origin = match.origin_coords;
        dest = match.dest_coords;
        name = match.route_id;
      }
    }

    if (!origin || !dest) {
      return res.status(400).json({
        success: false,
        error: 'Origin and destination coordinates or valid routeCode are required'
      });
    }

    const threshold = parseFloat(delayThreshold) || 4.0;
    const report = evaluateAlternativeRoutes(origin, dest, name, threshold);

    res.json({ success: true, data: report });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 7. What-If Traffic ML Simulation / Predictor
app.post('/api/predict', (req, res) => {
  try {
    const inputs = req.body || {};
    const prediction = simulatePrediction(inputs);
    res.json({ success: true, data: prediction });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 7b. Day/Date, Time, From, To Journey Predictor & Alternative Route Advisor
// Powered by Google Maps Routes API v2 + OpenWeatherMap API + OSM Network
app.post('/api/predict-journey', async (req, res) => {
  try {
    const { date, day, time, from, to, isAutoTest } = req.body || {};
    const result = await predictJourneyService({ date, day, time, from, to, isAutoTest });

    // Asynchronously log journey prediction to PostgreSQL (non-blocking)
    if (supabase && result) {
      supabase.from('journey_predictions_log').insert({
        from_location: from || 'Unknown',
        to_location: to || 'Unknown',
        predicted_level: result.traffic_prediction || null,
        travel_time_min: result.primary_route?.travel_time_min || null,
        traffic_delay_min: result.primary_route?.traffic_delay_min || null,
        distance_km: result.primary_route?.distance_km || null,
      }).then(() => {}).catch(e => console.warn('[Database] Failed to log journey prediction:', e.message));
    }

    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 7b1. PostgreSQL Database Health & Overview
app.get('/api/database/status', async (req, res) => {
  try {
    const health = await checkDatabaseHealth();
    res.json({ success: true, data: health });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 7b2. Reinforcement Learning Engine Status & Verification Metrics
app.get('/api/rl/status', async (req, res) => {
  try {
    const status = await getRlStatus();
    res.json({ success: true, data: status });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 7b3. Trigger Immediate Ground-Truth Evaluation against Google Maps Live API
app.post('/api/rl/evaluate-now', async (req, res) => {
  try {
    const { limit = 5, currentPrediction = null } = req.body || {};
    const result = await evaluatePendingPredictions({ currentPrediction, limit, forceImmediate: true });
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 7b4. 10-Hour Continuous Multi-Route Reinforcement Training Simulation
app.post('/api/rl/simulate-10h', async (req, res) => {
  try {
    const { corridorsCount = 5, startHour = 8, hoursCount = 10 } = req.body || {};
    const result = await run10HourTrainingSimulation({ corridorsCount, startHour, hoursCount });
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 7b5. Real-Life Data Reinforcement Training & Stress Testing (500 - 2,000+ episodes)
app.post('/api/rl/train-real-life', async (req, res) => {
  try {
    const { episodes = 1000, corridor = null } = req.body || {};
    const count = Math.max(10, Math.min(5000, parseInt(episodes, 10) || 1000));
    const result = await trainWithRealLifeData({ sampleCount: count, corridorFilter: corridor });
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 7b2. Exact Road Distance & Driving Time Measurement Tool (A to B)
app.post('/api/measure-route', async (req, res) => {
  try {
    const { origin, destination } = req.body || {};
    if (!origin || !destination || origin.length < 2 || destination.length < 2) {
      return res.status(400).json({ success: false, error: 'origin and destination [lat, lon] coordinates are required' });
    }

    const origCoords = [Number(origin[0]), Number(origin[1])];
    const destCoords = [Number(destination[0]), Number(destination[1])];
    const directDistKm = haversineKm(origCoords, destCoords);

    let roadCoords = null;
    let roadDistKm = 0;
    let osrmDurationMin = null;
    let roadNames = [];
    let routingEngine = 'OSM A*';

    // 1. Try OSRM full street-level routing (includes residential lanes, bridges, roundabouts)
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${origCoords[1]},${origCoords[0]};${destCoords[1]},${destCoords[0]}?overview=full&geometries=geojson&steps=true`;
      const osrmRes = await fetch(osrmUrl, { signal: controller.signal });
      clearTimeout(timeout);

      if (osrmRes.ok) {
        const osrmJson = await osrmRes.json();
        if (osrmJson && osrmJson.routes && osrmJson.routes[0]) {
          const r = osrmJson.routes[0];
          const pts = r.geometry.coordinates.map(([lon, lat]) => [lat, lon]);
          if (pts.length >= 2) {
            roadCoords = [origCoords, ...pts, destCoords];
            roadDistKm = Number((r.distance / 1000).toFixed(2));
            osrmDurationMin = r.duration / 60;
            if (r.legs && r.legs[0] && Array.isArray(r.legs[0].steps)) {
              roadNames = [...new Set(r.legs[0].steps.map(s => (s.name || '').trim()).filter(Boolean))];
            }
            routingEngine = 'OSRM Full Street Network';
          }
        }
      }
    } catch (e) {
      // Fallback to local GeoJSON graph
    }

    // 2. Fallback to local Dhaka OSM arterial graph if OSRM unavailable
    if (!roadCoords) {
      const osmRoute = buildOsmRouteGeometry([origCoords, destCoords]);
      roadCoords = osmRoute.coordinates && osmRoute.coordinates.length >= 2
        ? [origCoords, ...osmRoute.coordinates, destCoords]
        : [origCoords, destCoords];

      if (osmRoute.segments && osmRoute.segments.length > 0) {
        roadDistKm = osmRoute.segments.reduce((acc, s) => acc + (s.distance_km || 0), 0);
      } else {
        for (let i = 1; i < roadCoords.length; i++) {
          roadDistKm += haversineKm(roadCoords[i - 1], roadCoords[i]);
        }
      }

      if (roadDistKm < directDistKm * 1.05) {
        roadDistKm = directDistKm * 1.32;
      }

      roadNames = osmRoute.segments
        ? [...new Set(osmRoute.segments.map(s => s.name).filter(n => n && !n.includes('Road Segment') && !n.includes('Primary Corridor')))]
        : [];
    }

    // Realistic Dhaka traffic velocity calibration
    const stats = getDashboardStats();
    const rawCitySpeed = (stats && stats.avgSpeedKmh) ? Number(stats.avgSpeedKmh) : 22.0;
    const effectiveSpeed = Math.min(34, Math.max(14, rawCitySpeed > 36 ? 24.5 : rawCitySpeed));

    const freeFlowMin = osrmDurationMin
      ? Math.max(1, Math.round(osrmDurationMin))
      : Math.max(1, Math.round((roadDistKm / 38) * 60));

    const estTimeMin = Math.max(freeFlowMin, Math.round((roadDistKm / effectiveSpeed) * 60));
    const delayMin = Math.max(0, estTimeMin - freeFlowMin);

    res.json({
      success: true,
      data: {
        road_distance_km: Number(roadDistKm.toFixed(2)),
        direct_distance_km: Number(directDistKm.toFixed(2)),
        coordinates: roadCoords,
        est_travel_time_min: estTimeMin,
        free_flow_time_min: freeFlowMin,
        delay_min: delayMin,
        city_speed_kmh: Number(effectiveSpeed.toFixed(1)),
        roads: roadNames.slice(0, 4),
        engine: routingEngine
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 7b3. Real-Time Road Geometry Provider for Transit & Bus Map
const ROUTE_GEOM_SERVER_CACHE = new Map();

app.get('/api/route-geometry', async (req, res) => {
  try {
    const { fromLat, fromLng, toLat, toLng, mode = 'driving' } = req.query;
    if (!fromLat || !fromLng || !toLat || !toLng) {
      return res.status(400).json({ success: false, error: 'Missing coordinates' });
    }

    const p1 = [parseFloat(fromLat), parseFloat(fromLng)];
    const p2 = [parseFloat(toLat), parseFloat(toLng)];
    const profile = mode === 'walking' || mode === 'foot' ? 'foot' : 'driving';
    const cacheKey = `${profile}_${p1[0].toFixed(4)},${p1[1].toFixed(4)}_${p2[0].toFixed(4)},${p2[1].toFixed(4)}`;

    if (ROUTE_GEOM_SERVER_CACHE.has(cacheKey)) {
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.json({ success: true, from_cache: true, coordinates: ROUTE_GEOM_SERVER_CACHE.get(cacheKey) });
    }

    let coords = null;

    // 1. Try OSM Germany routed engine with fast 1200ms timeout
    try {
      const svc = profile === 'foot' ? 'routed-foot' : 'routed-car';
      const profName = profile === 'foot' ? 'foot' : 'driving';
      const url = `https://routing.openstreetmap.de/${svc}/route/v1/${profName}/${p1[1]},${p1[0]};${p2[1]},${p2[0]}?overview=full&geometries=geojson`;
      const r = await fetch(url, { signal: AbortSignal.timeout(1200) });
      if (r.ok) {
        const j = await r.json();
        if (j?.routes?.[0]?.geometry?.coordinates?.length >= 2) {
          coords = j.routes[0].geometry.coordinates.map(([lon, lat]) => [lat, lon]);
        }
      }
    } catch (_) {}

    // 2. Try Project-OSRM public engine with fast 1200ms timeout
    if (!coords) {
      try {
        const url = `https://router.project-osrm.org/route/v1/${profile}/${p1[1]},${p1[0]};${p2[1]},${p2[0]}?overview=full&geometries=geojson`;
        const r = await fetch(url, { signal: AbortSignal.timeout(1200) });
        if (r.ok) {
          const j = await r.json();
          if (j?.routes?.[0]?.geometry?.coordinates?.length >= 2) {
            coords = j.routes[0].geometry.coordinates.map(([lon, lat]) => [lat, lon]);
          }
        }
      } catch (_) {}
    }

    // 3. Guaranteed instant local Dhaka GeoJSON road graph A* (2,805 road segments)
    if (!coords || coords.length < 2) {
      const osmRoute = buildOsmRouteGeometry([p1, p2]);
      if (osmRoute.coordinates && osmRoute.coordinates.length >= 2) {
        coords = osmRoute.coordinates;
      }
    }

    if (coords && coords.length >= 2) {
      ROUTE_GEOM_SERVER_CACHE.set(cacheKey, coords);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.json({ success: true, coordinates: coords });
    }

    return res.status(500).json({ success: false, error: 'Could not resolve road geometry' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 7c. Live Weather from OpenWeatherMap API
app.get('/api/weather', async (req, res) => {
  try {
    const weather = await getLiveWeatherService();
    res.json({ success: true, data: weather });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 7d. Engine Telemetry & API Key Status
app.get('/api/engine-status', (req, res) => {
  try {
    const status = getEngineStatusService();
    res.json({ success: true, data: status });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 8. OpenStreetMap Road Network GeoJSON Summary
app.get('/api/roads/summary', (req, res) => {
  try {
    const summary = getGeoJsonRoadSummary();
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.json({ success: true, data: summary });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 8b. Verified Official Monitored Corridors (R01-R50) routed along OSM roads with CSV/live telemetry
app.get('/api/corridors/osm-overlay', (req, res) => {
  try {
    const corridors = getMonitoredCorridorsOsmOverlay();
    res.json({ success: true, count: corridors.length, corridors });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 8c. Route-Wise Bus Network API (Dhaka Metropolitan Transit & DTCA Permitted Services)
app.get('/api/buses', (req, res) => {
  try {
    const { from, to, ...rest } = req.query || {};
    if (from && to) {
      const matchResult = findBusesBetween(from, to);
      return res.json({ success: true, ...matchResult });
    }
    const buses = getAllBuses(rest);
    res.json({ success: true, count: buses.length, data: buses });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/buses/stops', (req, res) => {
  try {
    const stops = getBusStops();
    res.json({ success: true, count: stops.length, data: stops });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/buses/:id', (req, res) => {
  try {
    const bus = getBusById(req.params.id);
    if (!bus) {
      return res.status(404).json({ success: false, error: `Bus service '${req.params.id}' not found` });
    }
    res.json({ success: true, data: bus });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 9. Health & System Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    uptime_seconds: Math.floor((Date.now() - SERVER_START_TIME) / 1000),
    service: 'Dhaka Traffic Prediction & Bypass Engine API',
    version: '1.0.0'
  });
});

// 10. Server Performance & Telemetry Diagnostics
app.get('/api/server-info', (req, res) => {
  const mem = process.memoryUsage();
  res.json({
    success: true,
    server: {
      uptime_seconds: Math.floor((Date.now() - SERVER_START_TIME) / 1000),
      node_version: process.version,
      platform: process.platform,
      arch: process.arch,
      pid: process.pid,
      memory: {
        rss_mb: Math.round(mem.rss / (1024 * 1024)),
        heap_used_mb: Math.round(mem.heapUsed / (1024 * 1024)),
        heap_total_mb: Math.round(mem.heapTotal / (1024 * 1024))
      }
    },
    features: {
      compression: 'gzip/brotli enabled (threshold: 1KB)',
      caching: 'In-memory TTL for routes (20s), weather (5m), and journey queries (3m)',
      concurrent_runners: 'Dual server & client runner enabled via npm run dev'
    }
  });
});

// Serve logo and favicon requests
app.get(['/favicon.ico', '/favicon.svg'], (req, res) => {
  const iconPath = path.resolve(__dirname, '../frontend/public/logo/logo.svg');
  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile(iconPath);
});

// Serve frontend build if dist folder exists
const distPath = path.resolve(__dirname, '../dist');
app.use(express.static(distPath));

// Fallback to React index.html for client-side routing
app.use((req, res, next) => {
  // If it's an API route that wasn't matched, return 404 JSON instead of HTML
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ success: false, error: `API route ${req.path} not found` });
  }

  const indexHtml = path.join(distPath, 'index.html');
  res.sendFile(indexHtml, (err) => {
    if (err) {
      res.status(404).send('Frontend static files not yet built. Please run "npm run dev" or "npm run build".');
    }
  });
});

// Centralized Error Handling Middleware
app.use((err, req, res, next) => {
  console.error('[API Error]', err.stack || err.message);
  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message
  });
});

const HOST = process.env.HOST || '0.0.0.0';

const server = app.listen(PORT, HOST, () => {
  console.log(`🚀 Dhaka Traffic Node.js API Server running on http://127.0.0.1:${PORT} and http://localhost:${PORT}`);
  // Start continuous reinforcement learning evaluation worker
  startRlBackgroundWorker(3 * 60 * 1000);
  // Start OSRM continuous road data collector (autonomous, every 5 minutes)
  startOsrmContinuousCollector(5 * 60 * 1000);

  // ── Render Free Tier Keep-Alive: Self-ping every 14 minutes to prevent cold-start sleep ──
  // Render.com free services sleep after 15 minutes of inactivity.
  // This internal self-ping ensures the process stays warm 24/7 at zero extra cost.
  if (process.env.NODE_ENV === 'production') {
    const RENDER_PUBLIC_URL = process.env.RENDER_EXTERNAL_URL || 'https://traffic-prediction-q1yl.onrender.com';
    const PING_INTERVAL_MS = 14 * 60 * 1000; // 14 minutes
    const selfPing = async () => {
      try {
        const { default: https } = await import('https');
        https.get(`${RENDER_PUBLIC_URL}/api/health`, (res) => {
          console.log(`[KeepAlive] Self-ping → ${res.statusCode}`);
          res.resume(); // consume the response body
        }).on('error', (err) => {
          console.warn('[KeepAlive] Self-ping failed:', err.message);
        });
      } catch (err) {
        console.warn('[KeepAlive] Self-ping error:', err.message);
      }
    };
    // First ping after 1 minute, then every 14 minutes
    setTimeout(() => {
      selfPing();
      setInterval(selfPing, PING_INTERVAL_MS);
    }, 60 * 1000);
    console.log('[KeepAlive] Render keep-alive daemon started (ping every 14 min)');
  }
});

// Graceful shutdown
const shutdown = (signal) => {
  console.log(`\n[API Server] Received ${signal}, closing HTTP server gracefully...`);
  server.close(() => {
    console.log('[API Server] Closed HTTP server.');
    process.exit(0);
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
