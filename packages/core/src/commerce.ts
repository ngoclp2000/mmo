import { randomUUID } from 'node:crypto';
import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import { pool, rows, transaction, write } from './db.js';
import { fixtureSku } from './mock.js';
import { DomainError } from './security.js';
import type { Dashboard } from './contracts.js';

export interface Watch extends RowDataPacket {
  id: string;
  tenant_id: string;
  sku_id: string;
  target_price: string;
  consent: number;
  active: number;
}
export async function audit(
  db: PoolConnection,
  tenant: string,
  actor: string | null,
  action: string,
  id: string,
) {
  await write(
    db,
    'INSERT INTO audit_logs VALUES (?,?,?,?,?,UTC_TIMESTAMP(6))',
    [randomUUID(), tenant, actor, action, id],
  );
}
export async function emit(
  db: PoolConnection,
  tenant: string,
  kind: string,
  aggregate: string,
  payload: object,
) {
  await write(
    db,
    'INSERT INTO outbox VALUES (?,?,?,?,?,UTC_TIMESTAMP(6),NULL)',
    [
      randomUUID(),
      tenant,
      kind,
      aggregate,
      JSON.stringify({ ...payload, schemaVersion: 1, synthetic: true }),
    ],
  );
}
export async function getWatch(
  tenant: string,
  id: string,
  db = pool as typeof pool | PoolConnection,
  lock = false,
) {
  const [watch] = await rows<Watch>(
    db,
    `SELECT * FROM watchlists WHERE tenant_id=? AND id=?${lock ? ' FOR UPDATE' : ''}`,
    [tenant, id],
  );
  if (!watch) throw new DomainError(404, 'Không tìm thấy mục theo dõi.');
  return watch;
}
export async function createWatch(
  tenant: string,
  actor: string,
  skuId: string,
  target: number,
  consent: boolean,
) {
  const sku = fixtureSku(skuId);
  return transaction(async (db) => {
    // Serialize creates per tenant to make duplicate SKU submissions deterministic.
    await rows<RowDataPacket>(
      db,
      'SELECT id FROM tenants WHERE id=? FOR UPDATE',
      [tenant],
    );
    const [existing] = await rows<Watch>(
      db,
      'SELECT * FROM watchlists WHERE tenant_id=? AND sku_id=?',
      [tenant, skuId],
    );
    if (existing) return existing.id;
    const id = randomUUID();
    await write(
      db,
      'INSERT INTO watchlists (id,tenant_id,sku_id,target_price,consent,created_at) VALUES (?,?,?,?,?,UTC_TIMESTAMP(6))',
      [id, tenant, skuId, target, consent],
    );
    // Synthetic observation starts now. The first worker check supplies the second sample.
    await write(
      db,
      'INSERT INTO observations VALUES (?,?,?,?,?,?,UTC_TIMESTAMP(6),UTC_TIMESTAMP(6),?,?,TRUE)',
      [
        randomUUID(),
        tenant,
        id,
        `initial:${id}`,
        sku.price,
        'VND',
        'VN',
        'listed:no-shipping:no-voucher',
      ],
    );
    await emit(db, tenant, 'TrackingEnabled', id, { watchId: id });
    await audit(db, tenant, actor, 'TrackingEnabled', id);
    return id;
  });
}
export async function updateWatch(
  tenant: string,
  actor: string,
  id: string,
  target: number,
  consent: boolean,
  active: boolean,
) {
  await transaction(async (db) => {
    await getWatch(tenant, id, db, true);
    await write(
      db,
      'UPDATE watchlists SET target_price=?,consent=?,active=? WHERE tenant_id=? AND id=?',
      [target, consent, active, tenant, id],
    );
    await audit(
      db,
      tenant,
      actor,
      consent ? 'TrackingUpdated' : 'ConsentWithdrawn',
      id,
    );
  });
}
export async function enqueueJob(
  tenant: string,
  actor: string,
  watchId: string,
  scenario: string,
  requestKey: string,
) {
  return transaction(async (db) => {
    const watch = await getWatch(tenant, watchId, db, true);
    if (!watch.active)
      throw new DomainError(409, 'Mục theo dõi đang tạm dừng.');
    const [existing] = await rows<RowDataPacket>(
      db,
      'SELECT id,watch_id,scenario FROM sync_jobs WHERE tenant_id=? AND request_key=?',
      [tenant, requestKey],
    );
    if (existing) {
      if (existing.watch_id !== watchId || existing.scenario !== scenario)
        throw new DomainError(409, 'Idempotency key đã dùng cho yêu cầu khác.');
      return existing.id as string;
    }
    const id = randomUUID();
    await write(
      db,
      'INSERT INTO sync_jobs (id,tenant_id,watch_id,request_key,scenario,available_at,created_at) VALUES (?,?,?,?,?,UTC_TIMESTAMP(6),UTC_TIMESTAMP(6))',
      [id, tenant, watchId, requestKey, scenario],
    );
    await audit(db, tenant, actor, 'MockCheckRequested', id);
    return id;
  });
}
export async function dashboard(tenant: string): Promise<Dashboard> {
  const watches = await rows<RowDataPacket>(
    pool,
    `SELECT w.*, o.amount current_price,o.currency,o.observed_at,d.status score_status,d.score,d.change_pct,d.baseline,d.samples,d.explanation
    FROM watchlists w
    LEFT JOIN observations o ON o.id=(SELECT o2.id FROM observations o2 WHERE o2.tenant_id=w.tenant_id AND o2.watch_id=w.id AND o2.currency='VND' AND o2.region='VN' AND o2.basis='listed:no-shipping:no-voucher' ORDER BY o2.observed_at DESC,o2.received_at DESC LIMIT 1)
    LEFT JOIN deal_scores d ON d.tenant_id=w.tenant_id AND d.watch_id=w.id
    WHERE w.tenant_id=? ORDER BY w.created_at DESC`,
    [tenant],
  );
  const alerts = await rows<RowDataPacket>(
    pool,
    `SELECT a.id,a.watch_id,a.amount,a.created_at,d.status FROM alerts a JOIN notification_deliveries d ON d.tenant_id=a.tenant_id AND d.alert_id=a.id WHERE a.tenant_id=? AND d.status='delivered' ORDER BY a.created_at DESC LIMIT 50`,
    [tenant],
  );
  const jobs = await rows<RowDataPacket>(
    pool,
    'SELECT id,watch_id,scenario,status,attempts,last_error,created_at FROM sync_jobs WHERE tenant_id=? ORDER BY created_at DESC LIMIT 20',
    [tenant],
  );
  const [stats] = await rows<RowDataPacket>(
    pool,
    'SELECT COUNT(*) clicks FROM outbound_clicks WHERE tenant_id=?',
    [tenant],
  );
  return {
    watches: watches.map((w) => ({
      id: String(w.id),
      sku_id: String(w.sku_id),
      target_price: Number(w.target_price),
      consent: Boolean(w.consent),
      active: Boolean(w.active),
      current_price: Number(w.current_price),
      currency: String(w.currency),
      observed_at: new Date(w.observed_at).toISOString(),
      score_status: w.score_status ?? null,
      score: w.score === null ? null : Number(w.score),
      change_pct: w.change_pct === null ? null : Number(w.change_pct),
      baseline: w.baseline === null ? null : Number(w.baseline),
      samples: w.samples === null ? null : Number(w.samples),
      explanation: w.explanation ?? null,
      fixture: fixtureSku(w.sku_id),
      synthetic: true,
      freshness: !w.observed_at
        ? 'unavailable'
        : Date.now() - new Date(w.observed_at).getTime() > 6 * 60 * 60 * 1000
          ? 'stale'
          : 'fresh',
    })),
    alerts: alerts.map((a) => ({
      id: String(a.id),
      watch_id: String(a.watch_id),
      amount: Number(a.amount),
      created_at: new Date(a.created_at).toISOString(),
      status: String(a.status),
    })),
    jobs: jobs.map((j) => ({
      id: String(j.id),
      watch_id: String(j.watch_id),
      scenario: String(j.scenario),
      status: String(j.status),
      attempts: Number(j.attempts),
      last_error: j.last_error ?? null,
      created_at: new Date(j.created_at).toISOString(),
    })),
    clicks: Number(stats.clicks),
    synthetic: true,
  };
}
export async function recordClick(
  tenant: string,
  actor: string,
  watchId: string,
  requestKey: string,
) {
  return transaction(async (db) => {
    await getWatch(tenant, watchId, db, true);
    const [existing] = await rows<RowDataPacket>(
      db,
      'SELECT id,watch_id FROM outbound_clicks WHERE tenant_id=? AND request_key=?',
      [tenant, requestKey],
    );
    if (existing && existing.watch_id !== watchId)
      throw new DomainError(409, 'Idempotency key đã dùng cho mục khác.');
    const id = existing?.id ?? randomUUID();
    if (!existing) {
      await write(
        db,
        'INSERT INTO outbound_clicks VALUES (?,?,?,?,UTC_TIMESTAMP(6),TRUE)',
        [id, tenant, watchId, requestKey],
      );
      await audit(db, tenant, actor, 'DemoOutboundClicked', watchId);
    }
    // A fixed local destination. No user-provided redirect and no live merchant visit.
    return {
      id,
      destination: '/demo-destination',
      synthetic: true,
      disclosure: 'Link affiliate demo. Không có mua hàng hoặc hoa hồng thật.',
    };
  });
}
