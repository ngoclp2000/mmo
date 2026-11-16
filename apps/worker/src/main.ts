import { writeFile } from 'node:fs/promises';
import { setTimeout as sleep } from 'node:timers/promises';
import { assertDemoRuntime } from '../../../packages/core/src/config.js';
import { pool } from '../../../packages/core/src/db.js';
import { tick } from '../../../packages/core/src/worker.js';
assertDemoRuntime();
console.log('Worker ready (synthetic fixtures only)');
let running = true;
for (const signal of ['SIGTERM', 'SIGINT'])
  process.on(signal, () => {
    running = false;
  });
while (running) {
  try {
    await tick();
    await writeFile('/tmp/commerceos-worker-heartbeat', String(Date.now()));
  } catch {
    console.error(
      'Worker tick failed; retrying without logging sensitive payloads',
    );
  }
  await sleep(300);
}
await pool.end();
