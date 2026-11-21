import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

export let supabase = null;

if (SUPABASE_URL && SUPABASE_ANON_KEY) {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false },
    });
    console.log('[Database] PostgreSQL (Supabase) client initialized successfully.');
  } catch (err) {
    console.warn('[Database] Supabase client initialization skipped (' + err.message + '). Operating in local file mode.');
  }
} else {
  console.log('[Database] Operating in local CSV file mode (SUPABASE_URL not configured).');
}

/**
 * Health check for the PostgreSQL database connection
 */
export async function checkDatabaseHealth() {
  if (!supabase) {
    return { connected: false, error: 'Database client not initialized' };
  }
  try {
    const { count, error } = await supabase
      .from('traffic_snapshots')
      .select('*', { count: 'exact', head: true });

    if (error) throw error;

    return {
      connected: true,
      provider: 'PostgreSQL (Supabase)',
      project: 'trafficpulse-dhaka',
      region: 'ap-south-1 (Mumbai)',
      traffic_records_count: count ?? 0,
    };
  } catch (err) {
    return { connected: false, error: err.message };
  }
}
