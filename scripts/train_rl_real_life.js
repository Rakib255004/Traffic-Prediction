#!/usr/bin/env node
/**
 * Dhaka Traffic Reinforcement Learning Real-World Stress-Test Runner
 * =================================================================
 * Evaluates and trains the Q-learning policy agent against 1,000 to 2,000+
 * authentic ground-truth journeys from data/traffic_data.csv across Dhaka.
 *
 * Usage:
 *   node scripts/train_rl_real_life.js --episodes 1000
 *   npm run rl:train -- --episodes 2000
 */

import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load root .env
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const args = process.argv.slice(2);
let targetEpisodes = 1000;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--episodes' || args[i] === '-e') {
    const val = parseInt(args[i + 1], 10);
    if (!isNaN(val) && val > 0) targetEpisodes = val;
  }
}

async function main() {
  console.log('\n' + '='.repeat(78));
  console.log('  🧠 DHAKA TRAFFIC REINFORCEMENT LEARNING REAL-LIFE TRAINING ENGINE');
  console.log('  Evaluating Q-Learning Multipliers Against 211,680 Real-World Observations');
  console.log('='.repeat(78));
  console.log(`\n[1/3] Target Episodes: ${targetEpisodes.toLocaleString()} real-life corridor journeys`);
  console.log('[2/3] Ingesting ground-truth dataset and initializing Q-policy weights...');

  const t0 = Date.now();
  const { trainWithRealLifeData } = await import('../server/rlEngine.js');

  try {
    const result = await trainWithRealLifeData({ sampleCount: targetEpisodes });
    const durationSec = ((Date.now() - t0) / 1000).toFixed(2);

    console.log(`[3/3] Training completed in ${durationSec}s!\n`);
    console.log('='.repeat(78));
    console.log('  TRAINING & EVALUATION BENCHMARK RESULTS');
    console.log('='.repeat(78));
    console.log(`  • Total Real-Life Journeys Tested : ${result.total_episodes.toLocaleString()}`);
    console.log(`  • Initial Batch Mean Error Rate   : ${result.initial_error_pct}%`);
    console.log(`  • Final Batch Mean Error Rate     : ${result.final_error_pct}%`);
    console.log(`  • Error Reduction Improvement     : -${result.error_reduction_pct}%`);
    console.log(`  • Overall Model Success Rate      : ${result.overall_success_rate_pct}% (<= 15% tolerance)`);
    console.log(`  • Calibrated Policy Weight Slots  : ${result.policies_updated} corridor-hour-day slots`);
    console.log('='.repeat(78));

    console.log('\nSample Recent Episodes:');
    (result.recent_episodes || []).slice(-6).forEach(e => {
      const icon = e.status === 'SUCCESS' ? '✅' : '❌';
      const rew = e.reward >= 0 ? `+${e.reward}` : `${e.reward}`;
      console.log(`  ${icon} [${e.status}] ${e.route.padEnd(38)} | Pred: ${e.predicted_time_min}m | Act: ${e.actual_time_min}m | Err: ${e.error_pct}% | Rew: ${rew}`);
    });

    console.log('\nAll updated Q-values and policy multipliers have been persisted into Supabase PostgreSQL.');
    console.log('Open Reinforcement Learning tab in the web UI to inspect the live updated dashboard!\n');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Training error:', err.message);
    process.exit(1);
  }
}

main();
