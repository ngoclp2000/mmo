import { assertDemoRuntime } from './config.js';
import { pool, transaction, write } from './db.js';
import { passwordHash } from './auth.js';
assertDemoRuntime();
const password = process.env.DEMO_PASSWORD;
if (!password || password.length < 12)
  throw new Error('Set DEMO_PASSWORD (at least 12 characters) for local seed');
try {
  const hash = await passwordHash(password);
  await transaction(async (db) => {
    for (const [suffix, name] of [
      ['a', 'Studio North'],
      ['b', 'Workspace B'],
    ]) {
      const tenant = `00000000-0000-4000-8000-00000000000${suffix}`;
      const user = `10000000-0000-4000-8000-00000000000${suffix}`;
      await write(db, 'INSERT IGNORE INTO tenants VALUES (?,?)', [
        tenant,
        name,
      ]);
      await write(db, 'INSERT IGNORE INTO users VALUES (?,?,?,?)', [
        user,
        `demo-${suffix}@commerceos.local`,
        suffix === 'a' ? 'Minh Anh' : 'Demo B',
        hash,
      ]);
      await write(db, 'INSERT IGNORE INTO memberships VALUES (?,?,?)', [
        tenant,
        user,
        'admin',
      ]);
    }
  });
  console.log('Synthetic demo workspaces ready (existing passwords unchanged)');
} finally {
  await pool.end();
}
