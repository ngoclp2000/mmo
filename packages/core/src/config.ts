import 'dotenv/config';
export const config = {
  demo: process.env.APP_MODE === 'demo',
  origin: process.env.APP_ORIGIN ?? 'http://localhost:5173',
  sessionSeconds: 8 * 60 * 60,
  freshnessMs: 6 * 60 * 60 * 1000,
  baselineWindowMs: 7 * 24 * 60 * 60 * 1000,
  minSamples: 2,
  maxAttempts: 3,
  leaseSeconds: 30,
};
export function assertDemoRuntime() {
  if (!config.demo || process.env.NODE_ENV === 'production') {
    throw new Error(
      'This slice is local demo only. Set APP_MODE=demo and NODE_ENV=development. Production is not enabled.',
    );
  }
}
