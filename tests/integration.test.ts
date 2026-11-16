import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { buildApp } from '../apps/api/src/app.js';
import { pool, rows, write } from '../packages/core/src/db.js';
import { passwordHash } from '../packages/core/src/auth.js';
import { config } from '../packages/core/src/config.js';
import {
  claimJob,
  runJob,
  processOutbox,
} from '../packages/core/src/worker.js';
import type { RowDataPacket } from 'mysql2/promise';

if (!new URL(process.env.DATABASE_URL ?? '').pathname.endsWith('_test'))
  throw new Error(
    'Integration tests require DATABASE_URL database name ending in _test',
  );
process.env.RATE_LIMIT_NAMESPACE = `integration-${randomUUID()}:`;
const app = await buildApp();
const tenantA = '00000000-0000-4000-8000-00000000000a';
const tenantB = '00000000-0000-4000-8000-00000000000b';
const userA = '10000000-0000-4000-8000-00000000000a';
const userB = '10000000-0000-4000-8000-00000000000b';
if (!new URL(process.env.DATABASE_URL ?? '').pathname.endsWith('_test'))
  throw new Error('Integration tests require a dedicated *_test database');
let cookieA = '';
let cookieB = '';
let csrfA = '';
let csrfB = '';
async function request(
  method: 'GET' | 'POST' | 'PATCH',
  path: string,
  body?: object,
  b = false,
  csrf = true,
) {
  return app.inject({
    method,
    url: path,
    headers: {
      origin: config.origin,
      cookie: b ? cookieB : cookieA,
      ...(csrf ? { 'x-csrf-token': b ? csrfB : csrfA } : {}),
    },
    ...(body ? { payload: body } : {}),
  });
}
async function drainOutbox() {
  for (let i = 0; i < 50; i++) if (!(await processOutbox())) return;
  throw new Error('Outbox did not drain');
}
async function executeOne() {
  const job = await claimJob();
  assert.ok(job, 'expected pending job');
  await runJob(job);
  return job.id;
}
async function enqueue(watchId: string, scenario: string, key = randomUUID()) {
  const result = await request(
    'POST',
    `/api/workspaces/${tenantA}/watches/${watchId}/check`,
    { scenario, requestKey: key },
  );
  assert.equal(result.statusCode, 202, result.body);
  return result.json().id as string;
}
async function count(table: string, where: string, args: string[]) {
  const [row] = await rows<RowDataPacket>(
    pool,
    `SELECT COUNT(*) n FROM ${table} WHERE ${where}`,
    args,
  );
  return Number(row.n);
}
before(async () => {
  for (const table of [
    'notification_deliveries',
    'alerts',
    'outbound_clicks',
    'inbox',
    'outbox',
    'sync_jobs',
    'deal_scores',
    'observations',
    'watchlists',
    'audit_logs',
    'sessions',
    'memberships',
    'users',
    'tenants',
  ])
    await pool.query(`DELETE FROM ${table}`);
  const hash = await passwordHash('Integration-demo-2026');
  for (const [tenant, user, email] of [
    [tenantA, userA, 'a@test.local'],
    [tenantB, userB, 'b@test.local'],
  ]) {
    await write(pool, 'INSERT INTO tenants VALUES (?,?)', [tenant, email]);
    await write(pool, 'INSERT INTO users VALUES (?,?,?,?)', [
      user,
      email,
      email,
      hash,
    ]);
    await write(pool, 'INSERT INTO memberships VALUES (?,?,?)', [
      tenant,
      user,
      'admin',
    ]);
  }
  for (const b of [false, true]) {
    const login = await app.inject({
      method: 'POST',
      url: '/api/login',
      headers: { origin: config.origin },
      payload: {
        email: b ? 'b@test.local' : 'a@test.local',
        password: 'Integration-demo-2026',
      },
    });
    assert.equal(login.statusCode, 200, login.body);
    const cookie = login.cookies[0];
    assert.equal(cookie.httpOnly, true);
    assert.equal(cookie.sameSite, 'Strict');
    if (b) {
      cookieB = `session=${cookie.value}`;
      csrfB = login.json().csrfToken;
    } else {
      cookieA = `session=${cookie.value}`;
      csrfA = login.json().csrfToken;
    }
  }
});
after(async () => {
  await app.close();
  for (const table of [
    'notification_deliveries',
    'alerts',
    'outbound_clicks',
    'inbox',
    'outbox',
    'sync_jobs',
    'deal_scores',
    'observations',
    'watchlists',
    'audit_logs',
    'sessions',
    'memberships',
    'users',
    'tenants',
  ])
    await pool.query(`DELETE FROM ${table}`);
  await pool.end();
});

test('auth, CSRF, origin and multi-tenant read/write isolation', async () => {
  const spec = await app.inject({ url: '/api/openapi.json' });
  assert.equal(spec.statusCode, 200);
  assert.equal(spec.json().openapi, '3.1.0');
  assert.equal(
    (await app.inject({ url: `/api/workspaces/${tenantA}/dashboard` }))
      .statusCode,
    401,
  );
  assert.equal(
    (
      await request(
        'GET',
        `/api/workspaces/${tenantA}/dashboard`,
        undefined,
        true,
      )
    ).statusCode,
    403,
  );
  assert.equal(
    (
      await request(
        'POST',
        `/api/workspaces/${tenantA}/resolve`,
        { url: 'https://shopee.vn/mock/sneaker' },
        true,
      )
    ).statusCode,
    403,
  );
  assert.equal(
    (
      await request(
        'POST',
        `/api/workspaces/${tenantA}/resolve`,
        { url: 'https://shopee.vn/mock/sneaker' },
        false,
        false,
      )
    ).statusCode,
    403,
  );
  assert.equal(
    (
      await app.inject({
        method: 'POST',
        url: '/api/login',
        headers: { origin: 'https://evil.test' },
        payload: { email: 'a@test.local', password: 'x' },
      })
    ).statusCode,
    403,
  );
  const invalid = await request('POST', `/api/workspaces/${tenantA}/resolve`, {
    url: 'https://169.254.169.254/',
  });
  assert.equal(invalid.statusCode, 400);
});

test('E2E transaction/outbox: exact SKU → baseline → alert → click, duplicate replay is stable', async () => {
  const create = () =>
    request('POST', `/api/workspaces/${tenantA}/watches`, {
      skuId: 'sneaker-38',
      targetPrice: 1100000,
      consent: true,
    });
  const created = await create();
  assert.equal(created.statusCode, 201, created.body);
  const watchId = created.json().id;
  assert.equal((await create()).json().id, watchId);
  await drainOutbox();
  await executeOne();
  await drainOutbox();
  const key = randomUUID();
  const jobId = await enqueue(watchId, 'drop', key);
  assert.equal(await enqueue(watchId, 'drop', key), jobId);
  assert.equal(
    (
      await request(
        'POST',
        `/api/workspaces/${tenantA}/watches/${watchId}/check`,
        { scenario: 'stale', requestKey: key },
      )
    ).statusCode,
    409,
  );
  const claimed = await claimJob();
  assert.ok(claimed);
  await runJob(claimed);
  await runJob(claimed);
  await drainOutbox();
  assert.equal(
    await count('observations', 'tenant_id=? AND source_key=?', [
      tenantA,
      jobId,
    ]),
    1,
  );
  assert.equal(
    await count('alerts', 'tenant_id=? AND watch_id=?', [tenantA, watchId]),
    1,
  );
  assert.equal(
    await count(
      'notification_deliveries',
      "tenant_id=? AND status='delivered'",
      [tenantA],
    ),
    1,
  );
  await enqueue(watchId, 'drop');
  await executeOne();
  await drainOutbox();
  assert.equal(
    await count('alerts', 'tenant_id=? AND watch_id=?', [tenantA, watchId]),
    1,
  );
  assert.equal(
    (
      await request(
        'GET',
        `/api/workspaces/${tenantB}/watches/${watchId}/history`,
        undefined,
        true,
      )
    ).statusCode,
    404,
  );
  assert.equal(
    (
      await request(
        'PATCH',
        `/api/workspaces/${tenantB}/watches/${watchId}`,
        { targetPrice: 1, consent: false, active: false },
        true,
      )
    ).statusCode,
    404,
  );
  const clickKey = randomUUID();
  const click = () =>
    request('POST', `/api/workspaces/${tenantA}/watches/${watchId}/click`, {
      requestKey: clickKey,
    });
  assert.equal((await click()).json().destination, '/demo-destination');
  await click();
  assert.equal(await count('outbound_clicks', 'tenant_id=?', [tenantA]), 1);
  const dashboard = (
    await request('GET', `/api/workspaces/${tenantA}/dashboard`)
  ).json();
  assert.equal(dashboard.watches[0].fixture.id, 'sneaker-38');
  assert.equal(dashboard.clicks, 1);
  assert.equal(dashboard.synthetic, true);
  assert.equal(
    (
      await request(
        'GET',
        `/api/workspaces/${tenantB}/dashboard`,
        undefined,
        true,
      )
    ).json().watches.length,
    0,
  );
  assert.ok((await count('audit_logs', 'tenant_id=?', [tenantA])) > 0);
});

test('stale/currency mismatch, opt-out at delivery, retry 429 and dead-letter/replay', async () => {
  const created = await request('POST', `/api/workspaces/${tenantA}/watches`, {
    skuId: 'headphones-black',
    targetPrice: 1600000,
    consent: true,
  });
  const watchId = created.json().id;
  await drainOutbox();
  await executeOne();
  await drainOutbox();
  for (const scenario of ['stale', 'currency']) {
    await enqueue(watchId, scenario);
    await executeOne();
    await drainOutbox();
  }
  assert.equal(
    await count('alerts', 'tenant_id=? AND watch_id=?', [tenantA, watchId]),
    0,
  );
  await enqueue(watchId, 'drop');
  await executeOne();
  const optout = await request(
    'PATCH',
    `/api/workspaces/${tenantA}/watches/${watchId}`,
    { targetPrice: 1600000, consent: false, active: true },
  );
  assert.equal(optout.statusCode, 200, optout.body);
  await drainOutbox();
  const [delivery] = await rows<RowDataPacket>(
    pool,
    'SELECT d.status FROM notification_deliveries d JOIN alerts a ON a.id=d.alert_id WHERE a.tenant_id=? AND a.watch_id=?',
    [tenantA, watchId],
  );
  assert.equal(delivery.status, 'suppressed');
  const retry = await enqueue(watchId, 'rate-limit');
  await executeOne();
  let [job] = await rows<RowDataPacket>(
    pool,
    'SELECT * FROM sync_jobs WHERE id=?',
    [retry],
  );
  assert.equal(job.status, 'pending');
  assert.equal(job.last_error, 'MOCK_429');
  await write(
    pool,
    'UPDATE sync_jobs SET available_at=UTC_TIMESTAMP(6) WHERE id=?',
    [retry],
  );
  await executeOne();
  [job] = await rows<RowDataPacket>(
    pool,
    'SELECT * FROM sync_jobs WHERE id=?',
    [retry],
  );
  assert.equal(job.status, 'completed');
  assert.equal(job.attempts, 2);
  const fail = await enqueue(watchId, 'failure');
  for (let i = 0; i < 3; i++) {
    await write(
      pool,
      'UPDATE sync_jobs SET available_at=UTC_TIMESTAMP(6) WHERE id=?',
      [fail],
    );
    await executeOne();
  }
  [job] = await rows<RowDataPacket>(
    pool,
    'SELECT * FROM sync_jobs WHERE id=?',
    [fail],
  );
  assert.equal(job.status, 'dead');
  await write(
    pool,
    "UPDATE memberships SET role='member' WHERE tenant_id=? AND user_id=?",
    [tenantA, userA],
  );
  assert.equal(
    (
      await request(
        'POST',
        `/api/workspaces/${tenantA}/jobs/${fail}/replay`,
        {},
      )
    ).statusCode,
    403,
  );
  await write(
    pool,
    "UPDATE memberships SET role='admin' WHERE tenant_id=? AND user_id=?",
    [tenantA, userA],
  );
  assert.equal(
    (
      await request(
        'POST',
        `/api/workspaces/${tenantA}/jobs/${fail}/replay`,
        {},
      )
    ).statusCode,
    200,
  );
  [job] = await rows<RowDataPacket>(
    pool,
    'SELECT * FROM sync_jobs WHERE id=?',
    [fail],
  );
  assert.equal(job.attempts, 0);
  assert.equal(job.status, 'pending');
});

test('expired leases cannot commit side effects and crashed jobs are reclaimed', async () => {
  const [watch] = await rows<RowDataPacket>(
    pool,
    'SELECT id FROM watchlists WHERE tenant_id=? LIMIT 1',
    [tenantA],
  );
  // Remove the deliberately replayed failure from the prior test queue.
  await write(
    pool,
    "UPDATE sync_jobs SET status='dead' WHERE scenario='failure'",
  );
  const id = await enqueue(watch.id, 'steady');
  const stale = await claimJob();
  assert.ok(stale);
  await write(
    pool,
    'UPDATE sync_jobs SET lease_until=DATE_SUB(UTC_TIMESTAMP(6),INTERVAL 1 SECOND) WHERE id=?',
    [id],
  );
  await runJob(stale);
  assert.equal(
    await count('observations', 'tenant_id=? AND source_key=?', [tenantA, id]),
    0,
  );
  const reclaimed = await claimJob();
  assert.ok(reclaimed);
  assert.notEqual(reclaimed.lease_token, stale.lease_token);
  await runJob(reclaimed);
  assert.equal(
    await count('observations', 'tenant_id=? AND source_key=?', [tenantA, id]),
    1,
  );
  await drainOutbox();
});

test('login rate limit and logout revocation', async () => {
  for (let i = 0; i < 10; i++)
    await app.inject({
      method: 'POST',
      url: '/api/login',
      headers: { origin: config.origin },
      payload: { email: 'nobody@test.local', password: 'wrong' },
    });
  assert.equal(
    (
      await app.inject({
        method: 'POST',
        url: '/api/login',
        headers: { origin: config.origin },
        payload: { email: 'nobody@test.local', password: 'wrong' },
      })
    ).statusCode,
    429,
  );
  assert.equal((await request('POST', '/api/logout', {})).statusCode, 200);
  assert.equal((await request('GET', '/api/session')).statusCode, 401);
});
