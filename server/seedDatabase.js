import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { supabase } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function seed() {
  if (!supabase) {
    console.error('Supabase client is not configured.');
    process.exit(1);
  }

  console.log('--- Starting PostgreSQL Seed for TrafficPulse Dhaka ---');

  // 1. Seed Bus Stops
  const stopsPath = path.resolve(__dirname, '../data/bus/bus_stops.json');
  if (fs.existsSync(stopsPath)) {
    const stopsJson = JSON.parse(fs.readFileSync(stopsPath, 'utf-8'));
    const stops = stopsJson.stops || [];
    console.log(`Seeding ${stops.length} bus stops...`);

    const stopRows = stops.map(s => ({
      name: s.name,
      latitude: s.coords[0],
      longitude: s.coords[1],
    }));

    const { error: stopsErr } = await supabase
      .from('bus_stops')
      .upsert(stopRows, { onConflict: 'name' });

    if (stopsErr) {
      console.error('Error seeding bus stops:', stopsErr.message);
    } else {
      console.log(`✓ Successfully seeded ${stopRows.length} bus stops.`);
    }
  }

  // 2. Fetch seeded bus stops map for foreign keys
  const { data: dbStops } = await supabase.from('bus_stops').select('id, name');
  const stopMap = new Map();
  (dbStops || []).forEach(s => stopMap.set(s.name.toLowerCase().trim(), s.id));

  // 3. Seed Bus Routes
  const routesPath = path.resolve(__dirname, '../data/bus/dhaka_bus_routes.json');
  if (fs.existsSync(routesPath)) {
    const routesJson = JSON.parse(fs.readFileSync(routesPath, 'utf-8'));
    const routes = routesJson.routes || [];
    console.log(`Seeding ${routes.length} bus routes...`);

    for (const r of routes) {
      const { data: routeData, error: routeErr } = await supabase
        .from('bus_routes')
        .upsert({
          route_code: r.route_code || r.id,
          bus_name: r.name,
          start_point: r.origin,
          end_point: r.destination,
          route_path: Array.isArray(r.stoppages) ? r.stoppages.join(' -> ') : '',
          total_stops: r.stoppages?.length || 0,
          min_fare: r.fare_min_bdt || 10,
          max_fare: r.fare_max_bdt || 50,
          is_active: true,
        }, { onConflict: 'route_code' })
        .select('id')
        .single();

      if (routeErr) {
        console.error(`Error seeding route ${r.name}:`, routeErr.message);
        continue;
      }

      // Link route stops sequence if available
      if (routeData && Array.isArray(r.stoppages)) {
        const routeStopRows = [];
        r.stoppages.forEach((stopName, seq) => {
          const stopId = stopMap.get(stopName.toLowerCase().trim());
          if (stopId) {
            routeStopRows.push({
              bus_route_id: routeData.id,
              bus_stop_id: stopId,
              stop_sequence: seq + 1,
            });
          }
        });

        if (routeStopRows.length > 0) {
          await supabase
            .from('bus_route_stops')
            .upsert(routeStopRows, { onConflict: 'bus_route_id,stop_sequence' });
        }
      }
    }
    console.log(`✓ Successfully seeded bus routes and route stop sequences.`);
  }

  // 4. Seed Recent Traffic Telemetry Snapshots
  const csvPath = path.resolve(__dirname, '../data/traffic_data.csv');
  if (fs.existsSync(csvPath)) {
    console.log('Reading recent records from traffic_data.csv...');
    const fileContent = fs.readFileSync(csvPath, 'utf-8');
    const lines = fileContent.split(/\r?\n/).filter(l => l.trim().length > 0);
    const headers = lines[0].split(',').map(h => h.trim());

    // Take the most recent 1,000 snapshots for instant DB readiness
    const recentLines = lines.slice(-1000);
    const snapshotRows = [];

    for (const line of recentLines) {
      const parts = line.split(',');
      if (parts.length < headers.length) continue;
      const row = {};
      headers.forEach((h, i) => { row[h] = parts[i]?.trim(); });

      snapshotRows.push({
        timestamp: row.timestamp ? new Date(row.timestamp).toISOString() : new Date().toISOString(),
        road_route_id: row.road_route_id || 'UNKNOWN',
        osm_id: row.osm_id || null,
        latitude: parseFloat(row.latitude) || null,
        longitude: parseFloat(row.longitude) || null,
        dest_latitude: parseFloat(row.dest_latitude) || null,
        dest_longitude: parseFloat(row.dest_longitude) || null,
        traffic_speed_kmh: parseFloat(row.traffic_speed_kmh) || null,
        travel_time_min: parseFloat(row.travel_time_min) || null,
        free_flow_time_min: parseFloat(row.free_flow_time_min) || null,
        traffic_delay_min: parseFloat(row.traffic_delay_min) || null,
        congestion_ratio: parseFloat(row.congestion_ratio) || null,
        traffic_level: row.traffic_level || 'NORMAL',
        day_of_week: row.day_of_week || null,
        hour: parseFloat(row.hour) || null,
        minute: parseFloat(row.minute) || null,
        is_weekend: row.is_weekend === 'Yes' || row.is_weekend === '1' || row.is_weekend === 'true',
        is_rush_hour: row.is_rush_hour === 'Yes' || row.is_rush_hour === '1' || row.is_rush_hour === 'true',
        weather: row.weather || 'Clear',
        temperature_c: parseFloat(row.temperature_c) || null,
        rainfall_mm: parseFloat(row.rainfall_mm) || null,
        road_type: row.road_type || null,
        road_length_km: parseFloat(row.road_length_km) || null,
        num_lanes: parseFloat(row.num_lanes) || null,
        traffic_volume_veh_hr: parseFloat(row.traffic_volume_veh_hr) || null,
        occupancy_rate_pct: parseFloat(row.occupancy_rate_pct) || null,
        surface_condition: row.surface_condition || 'Dry',
      });
    }

    console.log(`Uploading ${snapshotRows.length} recent telemetry snapshots to PostgreSQL in batches...`);
    const batchSize = 250;
    for (let i = 0; i < snapshotRows.length; i += batchSize) {
      const batch = snapshotRows.slice(i, i + batchSize);
      const { error: snapErr } = await supabase.from('traffic_snapshots').insert(batch);
      if (snapErr) {
        console.error(`Batch ${i / batchSize + 1} insert error:`, snapErr.message);
      }
    }
    console.log(`✓ Successfully seeded recent traffic telemetry snapshots.`);
  }

  console.log('--- PostgreSQL Database Seed Completed Successfully ---');
}

seed().catch(console.error);
