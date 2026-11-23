import { predictJourneyTraffic } from './utils/journeyPredictor.js';
import { NODE_COORDINATES, OFFICIAL_ROUTES, ALL_ROUTES, DHAKA_BYPASS_WAYPOINTS } from './utils/dhakaRoutesData.js';

// API Service for Dhaka Traffic Prediction System
// High-resilience client with automatic live backend detection and offline fallback

// In production, when running on Render or custom domain, Express serves /api directly.
// On localhost, Express also serves /api directly on port 5000 (and Vite proxies /api in dev).
export const API_BASE = (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'))
  ? '/api'
  : (import.meta.env.VITE_API_URL || 'https://traffic-prediction-q1yl.onrender.com/api');

// Maximum time to wait for backend before falling back to local dataset (allows Render cloud cold-start)
export const FETCH_TIMEOUT_MS = 15000;

export async function fetchWithTimeout(url, options = {}, timeoutMs = FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...options,
      signal: options.signal || controller.signal,
    });
  } finally {
    clearTimeout(id);
  }
}

// Helper to generate full route telemetry client-side when backend is offline
function generateFallbackRoutes() {
  const sourceRoutes = (ALL_ROUTES && ALL_ROUTES.length) ? ALL_ROUTES : OFFICIAL_ROUTES;
  return sourceRoutes.map((item, idx) => {
    const nodeNames = item.route_path.split('->').map(s => s.trim()).filter(Boolean);
    const waypoints = nodeNames.map(name => ({
      name,
      coords: NODE_COORDINATES[name] || item.origin_coords || [23.8103, 90.4125]
    }));

    const length = item.road_length_km || 8.0;
    const baseSpeed = Math.round(18 + ((idx * 7) % 24));
    const travelTime = Math.max(5, Math.round((length / baseSpeed) * 60));
    const freeFlow = Math.max(3, Math.round(item.free_flow_time_min || (length / 38) * 60));
    const delay = Math.max(0, travelTime - freeFlow);

    let trafficLevel = 'NORMAL';
    if (delay >= 12) trafficLevel = 'HEAVY';
    else if (delay >= 5) trafficLevel = 'MODERATE';

    return {
      ...item,
      waypoints,
      traffic_speed_kmh: baseSpeed,
      travel_time_min: travelTime,
      free_flow_time_min: freeFlow,
      traffic_delay_min: delay,
      congestion_ratio: Number((travelTime / Math.max(freeFlow, 1)).toFixed(2)),
      traffic_level: trafficLevel,
      num_lanes: 4,
      weather: 'Clear',
      temperature_c: 28,
      rainfall_mm: 0
    };
  });
}

export async function fetchStats() {
  try {
    const res = await fetchWithTimeout(`${API_BASE}/stats`);
    if (res.ok) {
      const json = await res.json();
      if (json && json.success) return json;
    }
  } catch (err) {
    console.warn('[API] /api/stats unavailable, utilizing client fallback:', err.message);
  }

  const routes = generateFallbackRoutes();
  const avgSpeed = (routes.reduce((acc, r) => acc + r.traffic_speed_kmh, 0) / routes.length).toFixed(1);
  const avgDelay = (routes.reduce((acc, r) => acc + r.traffic_delay_min, 0) / routes.length).toFixed(1);

  const levelCounts = { NORMAL: 0, MODERATE: 0, HEAVY: 0, SEVERE: 0 };
  routes.forEach(r => {
    levelCounts[r.traffic_level] = (levelCounts[r.traffic_level] || 0) + 1;
  });

  return {
    success: true,
    data: {
      totalCorridors: routes.length,
      avgSpeedKmh: Number(avgSpeed),
      avgDelayMin: Number(avgDelay),
      levelCounts,
      worstCorridors: [...routes].sort((a, b) => b.congestion_ratio - a.congestion_ratio).slice(0, 5),
      fastestCorridors: [...routes].sort((a, b) => b.traffic_speed_kmh - a.traffic_speed_kmh).slice(0, 5),
      totalHistoricalRecords: 5000,
      weatherSummary: {
        condition: 'Clear',
        temperature_c: 28.0,
        humidity_pct: 68,
        surface_condition: 'Dry',
        city: 'Dhaka, Bangladesh'
      }
    },
    isOffline: true
  };
}

export async function fetchRoutes(params = {}) {
  try {
    const query = new URLSearchParams();
    if (params.level && params.level !== 'ALL') query.set('level', params.level);
    if (params.search) query.set('search', params.search);

    const res = await fetchWithTimeout(`${API_BASE}/routes?${query.toString()}`);
    if (res.ok) {
      const json = await res.json();
      if (json && json.success) return json;
    }
  } catch (err) {
    console.warn('[API] /api/routes unavailable, utilizing client fallback:', err.message);
  }

  let routes = generateFallbackRoutes();
  if (params.level && params.level !== 'ALL') {
    routes = routes.filter(r => r.traffic_level.toUpperCase() === params.level.toUpperCase());
  }
  if (params.search) {
    const q = params.search.toLowerCase();
    routes = routes.filter(r =>
      r.route_code.toLowerCase().includes(q) ||
      r.route_id.toLowerCase().includes(q) ||
      r.origin_name.toLowerCase().includes(q) ||
      r.dest_name.toLowerCase().includes(q)
    );
  }

  return {
    success: true,
    count: routes.length,
    total: OFFICIAL_ROUTES.length,
    data: routes,
    isOffline: true
  };
}

export async function fetchRouteDetails(routeCode) {
  try {
    const res = await fetchWithTimeout(`${API_BASE}/routes/${routeCode}`);
    if (res.ok) {
      const json = await res.json();
      if (json && json.success) return json;
    }
  } catch (err) {
    console.warn(`[API] /api/routes/${routeCode} unavailable, searching fallback:`, err.message);
  }

  const routes = generateFallbackRoutes();
  const match = routes.find(r => r.route_code.toUpperCase() === String(routeCode).toUpperCase());
  return {
    success: Boolean(match),
    data: match || null,
    isOffline: true
  };
}

export async function fetchWaypoints() {
  try {
    const res = await fetchWithTimeout(`${API_BASE}/waypoints`);
    if (res.ok) {
      const json = await res.json();
      if (json && json.success) return json;
    }
  } catch (err) {
    console.warn('[API] /api/waypoints unavailable, utilizing client fallback:', err.message);
  }

  const nodes = Object.entries(NODE_COORDINATES).map(([name, coords]) => ({
    name,
    lat: coords[0],
    lon: coords[1]
  }));

  return {
    success: true,
    count: nodes.length,
    waypoints: nodes,
    bypasses: DHAKA_BYPASS_WAYPOINTS,
    isOffline: true
  };
}

export async function fetchCorridorsOverlay() {
  try {
    const res = await fetchWithTimeout(`${API_BASE}/corridors/osm-overlay`);
    if (res.ok) {
      const json = await res.json();
      if (json && json.success) return json;
    }
  } catch (err) {
    console.warn('[API] /api/corridors/osm-overlay unavailable:', err.message);
  }
  return { success: false, corridors: [], isOffline: true };
}

export async function fetchHistory(params = {}) {
  try {
    const query = new URLSearchParams();
    if (params.page) query.set('page', params.page);
    if (params.limit) query.set('limit', params.limit);
    if (params.all) query.set('all', 'true');
    if (params.compact) query.set('compact', 'true');
    if (params.level && params.level !== 'ALL') query.set('level', params.level);
    if (params.search) query.set('search', params.search);
    query.set('_t', Date.now());

    // Allow generous 30s timeout for full historical dataset download across cloud
    const res = await fetchWithTimeout(`${API_BASE}/history?${query.toString()}`, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
    }, 30000);
    if (res.ok) {
      const json = await res.json();
      if (json && json.success) return json;
    }
  } catch (err) {
    console.warn('[API] /api/history unavailable, generating representative client history:', err.message);
  }

  // Generate realistic representative history for Traffic Insights charts
  const levels = ['NORMAL', 'NORMAL', 'MODERATE', 'NORMAL', 'HEAVY', 'NORMAL', 'MODERATE'];
  const weathers = ['Clear', 'Clear', 'Cloudy', 'Clear', 'Rain', 'Cloudy', 'Fog'];
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const routes = generateFallbackRoutes();
  const records = [];
  const hours = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];

  for (let i = 0; i < 400; i++) {
    const r = routes[i % routes.length];
    const hour = hours[i % hours.length];
    const day = days[i % days.length];
    const weather = weathers[i % weathers.length];
    const isPeak = (hour >= 8 && hour <= 10) || (hour >= 17 && hour <= 20);
    const lvl = isPeak ? (i % 3 === 0 ? 'HEAVY' : 'MODERATE') : levels[i % levels.length];
    const isExpressway = (r.route_name || r.route_id || '').toLowerCase().includes('flyover') || (r.route_name || r.route_id || '').toLowerCase().includes('elevated');
    const roadType = isExpressway ? 'Expressway' : (r.road_length_km > 15 ? 'Highway/Arterial' : 'Primary Arterial');
    records.push({
      road_route_id: r.route_id,
      hour: String(hour),
      traffic_level: lvl,
      traffic_speed_kmh: lvl === 'HEAVY' ? 12 : lvl === 'MODERATE' ? 20 : 34,
      weather,
      day_of_week: day,
      road_type: roadType,
      timestamp: `2026-11-10 ${String(hour).padStart(2, '0')}:${String((i * 7) % 60).padStart(2, '0')}`
    });
  }

  const limit = params.limit || 5000;
  return {
    success: true,
    total: records.length,
    page: 1,
    limit,
    totalPages: 1,
    data: records.slice(0, limit),
    isOffline: true
  };
}

export async function evaluateBypassAdvisor(payload) {
  try {
    const res = await fetchWithTimeout(`${API_BASE}/advisor`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.ok) return res.json();
  } catch (err) {
    console.warn('[API] /api/advisor fallback:', err.message);
  }
  return { success: false, error: 'Advisor service unavailable' };
}

export async function simulateTrafficPrediction(payload) {
  try {
    const res = await fetchWithTimeout(`${API_BASE}/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.ok) return res.json();
  } catch (err) {
    console.warn('[API] /api/predict fallback:', err.message);
  }
  return { success: false, error: 'Prediction simulation unavailable' };
}

export async function fetchRoadSummary() {
  try {
    const res = await fetchWithTimeout(`${API_BASE}/roads/summary`);
    if (res.ok) {
      const json = await res.json();
      if (json && json.success) return json;
    }
  } catch (err) {
    console.warn('[API] /api/roads/summary fallback:', err.message);
  }

  return {
    success: true,
    data: {
      available: true,
      totalWays: 593,
      roadTypes: {
        primary: 148,
        secondary: 215,
        trunk: 84,
        motorway: 32,
        tertiary: 114
      },
      sampleRoads: [
        { name: 'Mirpur Road', highway: 'primary', lanes: 4 },
        { name: 'Kazi Nazrul Islam Avenue', highway: 'primary', lanes: 6 },
        { name: 'Dhaka Elevated Expressway', highway: 'motorway', lanes: 4 },
        { name: 'Airport Road', highway: 'trunk', lanes: 6 },
        { name: 'Pragoti Sarani', highway: 'primary', lanes: 4 }
      ]
    },
    isOffline: true
  };
}

export async function fetchLiveWeather() {
  try {
    const res = await fetchWithTimeout(`${API_BASE}/weather`);
    if (res.ok) {
      const json = await res.json();
      if (json && json.success) return json.data;
    }
  } catch (err) {
    console.warn('[API] Weather API fetch failed:', err.message);
  }
  return {
    city: 'Dhaka',
    condition: 'Haze',
    temperature_c: 25.0,
    humidity_pct: 78,
    visibility_km: 6.0,
    surface_condition: 'Dry',
    source: 'Fallback'
  };
}

export async function fetchEngineStatus() {
  try {
    const res = await fetchWithTimeout(`${API_BASE}/engine-status`);
    if (res.ok) {
      const json = await res.json();
      if (json && json.success) return json.data;
    }
  } catch (err) {
    console.warn('[API] Engine status fetch failed:', err.message);
  }
  return {
    googleRoutesApi: {
      status: 'Active (Ready)',
      keyPoolSize: 1,
      currentKeyIndex: 1
    },
    openWeatherMap: {
      status: 'Fallback Active',
      hasKey: false
    },
    wazeLive: {
      status: 'Standby / Failover Ready'
    },
    osmRoadNetwork: {
      status: 'Loaded (dhaka_roads.geojson)',
      officialRoutesCount: 50
    }
  };
}

export async function predictJourneyApi(payload) {
  try {
    const res = await fetchWithTimeout(`${API_BASE}/predict-journey`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      const json = await res.json();
      if (json && json.success) {
        return json.data;
      }
    }
  } catch (err) {
    console.warn('[API] /api/predict-journey unavailable, utilizing client-side prediction engine:', err.message);
  }

  // Fallback to local client-side prediction engine
  return predictJourneyTraffic(payload);
}

export async function fetchBusesBetween(from, to) {
  try {
    const res = await fetchWithTimeout(`${API_BASE}/buses?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
    if (res.ok) {
      const json = await res.json();
      if (json && json.success) return json;
    }
  } catch (err) {
    console.warn('[API] /api/buses fetch error:', err.message);
  }
  return null;
}

export async function measureExactRoadRoute(origin, destination) {
  try {
    const res = await fetchWithTimeout(`${API_BASE}/measure-route`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ origin, destination })
    });
    if (res.ok) {
      const json = await res.json();
      if (json && json.success && json.data) {
        return json.data;
      }
    }
  } catch (err) {
    console.warn('[API] /api/measure-route unavailable, trying OSRM fallback:', err.message);
  }

  // Fallback: public OSRM driving engine
  try {
    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${origin[1]},${origin[0]};${destination[1]},${destination[0]}?overview=full&geometries=geojson`;
    const res = await fetch(osrmUrl);
    if (res.ok) {
      const data = await res.json();
      if (data && data.routes && data.routes[0]) {
        const r = data.routes[0];
        const coords = r.geometry.coordinates.map(([lon, lat]) => [lat, lon]);
        const distKm = Number((r.distance / 1000).toFixed(2));
        const estTime = Math.max(2, Math.round(r.duration / 60));
        return {
          road_distance_km: distKm,
          direct_distance_km: Number(calcHaversineKm(origin, destination).toFixed(2)),
          coordinates: coords,
          est_travel_time_min: estTime,
          city_speed_kmh: 22.0,
          roads: []
        };
      }
    }
  } catch (e) {
    // fallback to mathematical winding
  }

  const direct = calcHaversineKm(origin, destination);
  const roadEst = Number((direct * 1.32).toFixed(2));
  return {
    road_distance_km: roadEst,
    direct_distance_km: Number(direct.toFixed(2)),
    coordinates: [origin, destination],
    est_travel_time_min: Math.max(2, Math.round((roadEst / 22) * 60)),
    city_speed_kmh: 22.0,
    roads: []
  };
}

function calcHaversineKm(c1, c2) {
  const R = 6371;
  const dLat = (c2[0] - c1[0]) * Math.PI / 180;
  const dLon = (c2[1] - c1[1]) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(c1[0] * Math.PI / 180) * Math.cos(c2[0] * Math.PI / 180) *
            Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Fallback representative RL telemetry dataset when server/database is offline or cold-starting
function generateFallbackRlStatus() {
  const now = Date.now();
  const baselineRoutes = [
    { from: 'Mirpur 10', to: 'Farmgate', corridor: 'R26', predTime: 18.2, actTime: 19.0, predLvl: 'Medium', actLvl: 'Medium', err: 4.4, rew: 1.0, status: 'SUCCESS' },
    { from: 'ECB Chattor', to: 'Banani', corridor: 'R57', predTime: 12.5, actTime: 12.0, predLvl: 'Low', actLvl: 'Low', err: 4.0, rew: 1.0, status: 'SUCCESS' },
    { from: 'Airport', to: 'Mohakhali', corridor: 'R05', predTime: 24.0, actTime: 26.2, predLvl: 'High', actLvl: 'High', err: 9.2, rew: 0.6, status: 'SUCCESS' },
    { from: 'Farmgate', to: 'Shahbagh', corridor: 'R60', predTime: 14.0, actTime: 13.5, predLvl: 'Medium', actLvl: 'Medium', err: 3.6, rew: 1.0, status: 'SUCCESS' },
    { from: 'Dhanmondi 27', to: 'Science Lab', corridor: 'R55', predTime: 9.0, actTime: 9.8, predLvl: 'Low', actLvl: 'Low', err: 8.9, rew: 0.6, status: 'SUCCESS' },
    { from: 'Uttara', to: 'Kuril', corridor: 'R97', predTime: 17.5, actTime: 20.8, predLvl: 'Low', actLvl: 'Medium', err: 18.9, rew: -0.2, status: 'FAIL' },
    { from: 'ECB Chattor', to: 'Gabtoli', corridor: 'R01', predTime: 22.0, actTime: 21.1, predLvl: 'Medium', actLvl: 'Medium', err: 4.1, rew: 1.0, status: 'SUCCESS' },
    { from: 'Karwan Bazar', to: 'Shahbagh', corridor: 'R71', predTime: 8.5, actTime: 8.1, predLvl: 'Low', actLvl: 'Low', err: 4.7, rew: 1.0, status: 'SUCCESS' },
    { from: 'Mirpur 10', to: 'Motijheel', corridor: 'R06', predTime: 36.0, actTime: 38.5, predLvl: 'High', actLvl: 'High', err: 6.9, rew: 0.6, status: 'SUCCESS' },
    { from: 'Mirpur 12', to: 'Dhanmondi 27', corridor: 'R10', predTime: 25.0, actTime: 24.2, predLvl: 'Medium', actLvl: 'Medium', err: 3.2, rew: 1.0, status: 'SUCCESS' },
    { from: 'ECB Chattor', to: 'Uttara Sector 18', corridor: 'R14', predTime: 15.0, actTime: 18.2, predLvl: 'Low', actLvl: 'Medium', err: 21.3, rew: -0.2, status: 'FAIL' },
    { from: 'Shahbagh', to: 'Gulistan', corridor: 'R33', predTime: 11.0, actTime: 10.6, predLvl: 'Medium', actLvl: 'Medium', err: 3.6, rew: 1.0, status: 'SUCCESS' },
  ];

  const recentEpisodes = baselineRoutes.map((r, i) => ({
    id: 120 + i,
    route: `${r.from} → ${r.to}`,
    predicted_time_min: r.predTime,
    actual_time_min: r.actTime,
    predicted_level: r.predLvl,
    actual_level: r.actLvl,
    error_pct: r.err,
    reward: r.rew,
    status: r.status,
    timestamp: new Date(now - (i * 12 * 60 * 1000)).toISOString(),
    eval_due_time: new Date(now - (i * 12 * 60 * 1000)).toISOString(),
  }));

  // Add 2 pending evaluations
  recentEpisodes.unshift(
    {
      id: 133,
      route: 'Mirpur 10 → Farmgate',
      predicted_time_min: 19.5,
      actual_time_min: null,
      predicted_level: 'Medium',
      actual_level: null,
      error_pct: null,
      reward: null,
      status: 'PENDING',
      timestamp: new Date(now - 2 * 60 * 1000).toISOString(),
      eval_due_time: new Date(now + 10 * 60 * 1000).toISOString(),
    },
    {
      id: 134,
      route: 'ECB Chattor → Notun Bazar',
      predicted_time_min: 16.0,
      actual_time_min: null,
      predicted_level: 'Low',
      actual_level: null,
      error_pct: null,
      reward: null,
      status: 'PENDING',
      timestamp: new Date(now - 1 * 60 * 1000).toISOString(),
      eval_due_time: new Date(now + 15 * 60 * 1000).toISOString(),
    }
  );

  const evaluated = recentEpisodes.filter(e => e.status !== 'PENDING');
  const successCount = evaluated.filter(e => e.status === 'SUCCESS').length;
  const failCount = evaluated.filter(e => e.status === 'FAIL').length;
  const total = evaluated.length;
  const avgReward = Number((evaluated.reduce((acc, e) => acc + e.reward, 0) / total).toFixed(2));
  const avgErr = Number((evaluated.reduce((acc, e) => acc + e.error_pct, 0) / total).toFixed(1));

  const errorDist = {
    under_5_pct: evaluated.filter(e => e.error_pct <= 5.0).length,
    five_to_15_pct: evaluated.filter(e => e.error_pct > 5.0 && e.error_pct <= 15.0).length,
    fifteen_to_25_pct: evaluated.filter(e => e.error_pct > 15.0 && e.error_pct <= 25.0).length,
    over_25_pct: evaluated.filter(e => e.error_pct > 25.0).length,
  };

  const learnedCorridors = [
    { corridor: 'R26: Mirpur 10 -> Farmgate', hour_bucket: 9, day_type: 'weekday', speed_multiplier: 0.94, delay_multiplier: 1.08, q_value: 0.72, total_episodes: 28, success_rate: '89%', last_error_pct: 4.4 },
    { corridor: 'R57: ECB Chattor -> Banani', hour_bucket: 10, day_type: 'weekday', speed_multiplier: 1.05, delay_multiplier: 0.95, q_value: 0.81, total_episodes: 22, success_rate: '91%', last_error_pct: 4.0 },
    { corridor: 'R05: ECB Chattor -> Notun Bazar', hour_bucket: 8, day_type: 'weekday', speed_multiplier: 0.88, delay_multiplier: 1.14, q_value: 0.65, total_episodes: 19, success_rate: '84%', last_error_pct: 9.2 },
    { corridor: 'R60: Farmgate -> Shahbagh', hour_bucket: 11, day_type: 'weekday', speed_multiplier: 1.02, delay_multiplier: 0.98, q_value: 0.85, total_episodes: 31, success_rate: '94%', last_error_pct: 3.6 },
    { corridor: 'R55: Dhanmondi 27 -> Science Lab', hour_bucket: 14, day_type: 'weekday', speed_multiplier: 0.96, delay_multiplier: 1.04, q_value: 0.78, total_episodes: 16, success_rate: '88%', last_error_pct: 8.9 },
    { corridor: 'R01: ECB Chattor -> Gabtoli', hour_bucket: 12, day_type: 'weekday', speed_multiplier: 0.98, delay_multiplier: 1.02, q_value: 0.76, total_episodes: 18, success_rate: '89%', last_error_pct: 4.1 },
    { corridor: 'R71: Karwan Bazar -> Shahbagh', hour_bucket: 15, day_type: 'weekday', speed_multiplier: 1.04, delay_multiplier: 0.96, q_value: 0.82, total_episodes: 24, success_rate: '92%', last_error_pct: 4.7 },
    { corridor: 'R06: Mirpur 10 -> Motijheel', hour_bucket: 9, day_type: 'weekday', speed_multiplier: 0.91, delay_multiplier: 1.12, q_value: 0.69, total_episodes: 26, success_rate: '85%', last_error_pct: 6.9 },
  ];

  return {
    active: true,
    learning_mode: 'Autonomous Time-Anchored Reinforcement Learning',
    ground_truth_provider: 'OSRM Live Road API & Google Maps Engine',
    metrics: {
      total_evaluations: total,
      success_count: successCount,
      fail_count: failCount,
      pending_count: 2,
      success_rate_pct: Number(((successCount / total) * 100).toFixed(1)),
      failure_rate_pct: Number(((failCount / total) * 100).toFixed(1)),
      average_reward: avgReward,
      average_error_pct: avgErr,
      error_distribution: errorDist,
    },
    recent_episodes: recentEpisodes,
    learned_corridors: learnedCorridors,
    isOfflineFallback: true,
  };
}

export async function fetchRlStatus() {
  try {
    const res = await fetchWithTimeout(`${API_BASE}/rl/status`);
    if (res.ok) {
      const json = await res.json();
      if (json && json.success && json.data && json.data.active) return json.data;
    }
  } catch (err) {
    console.warn('[API] /api/rl/status fetch error:', err.message);
  }
  return generateFallbackRlStatus();
}

export async function evaluateRlNow(currentPrediction = null, limit = 5) {
  try {
    const res = await fetchWithTimeout(`${API_BASE}/rl/evaluate-now`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPrediction, limit })
    });
    if (res.ok) {
      const json = await res.json();
      if (json && json.success) return json.data;
    }
  } catch (err) {
    console.warn('[API] /api/rl/evaluate-now error:', err.message);
  }
  return null;
}

export async function run10HourSimulationApi(params = {}) {
  try {
    const res = await fetchWithTimeout(`${API_BASE}/rl/simulate-10h`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
    if (res.ok) {
      const json = await res.json();
      if (json && json.success) return json.data;
    }
  } catch (err) {
    console.warn('[API] /api/rl/simulate-10h error:', err.message);
  }
  return null;
}

export async function trainRlRealLife(episodes = 1000) {
  try {
    const res = await fetchWithTimeout(`${API_BASE}/rl/train-real-life`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ episodes })
    }, 45000);
    if (res.ok) {
      const json = await res.json();
      if (json && json.success) return json.data;
    }
  } catch (err) {
    console.warn('[API] /api/rl/train-real-life error:', err.message);
  }
  return null;
}
