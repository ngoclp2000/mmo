import { randomUUID } from 'node:crypto';
import type { RowDataPacket } from 'mysql2/promise';
import { pool, rows, transaction, write } from './db.js';
import { config } from './config.js';
import { audit, emit, getWatch } from './commerce.js';
import { mockObservation, type Scenario } from './mock.js';
import { scoreFrom } from './workerScore.js';

interface Job extends RowDataPacket {
  id: string;
  tenant_id: string;
  watch_id: string;
  scenario: Scenario;
  attempts: number;
  lease_token: string;
}

export async function processOutbox() {
  return transaction(async (db) => {
    const [event] = await rows<RowDataPacket>(
      db,
      'SELECT * FROM outbox WHERE published_at IS NULL ORDER BY created_at,id LIMIT 1 FOR UPDATE SKIP LOCKED',
    );
    if (!event) return false;
    const consumer = 'local-workflow-v1';
    const result = await write(
      db,
      'INSERT IGNORE INTO inbox VALUES (?,?,UTC_TIMESTAMP(6))',
      [consumer, event.id],
    );
    if (result.affectedRows) {
      if (event.kind === 'TrackingEnabled') {
        await write(
          db,
          "INSERT IGNORE INTO sync_jobs (id,tenant_id,watch_id,request_key,scenario,available_at,created_at) VALUES (?,?,?,?,'steady',UTC_TIMESTAMP(6),UTC_TIMESTAMP(6))",
          [
            randomUUID(),
            event.tenant_id,
            event.aggregate_id,
            `outbox:${event.id}`,
          ],
        );
      } else if (event.kind === 'AlertQualified') {
        const payload =
          typeof event.payload === 'string'
            ? JSON.parse(event.payload)
            : event.payload;
        const watch = await getWatch(
          event.tenant_id,
          event.aggregate_id,
          db,
          true,
        );
        const eligible = Boolean(
          watch.consent &&
          watch.active &&
          Number(payload.amount) <= Number(watch.target_price) &&
          Date.now() - new Date(payload.observedAt).getTime() <=
            config.freshnessMs,
        );
        await write(
          db,
          'INSERT IGNORE INTO notification_deliveries VALUES (?,?,?,?,?)',
          [
            randomUUID(),
            event.tenant_id,
            payload.alertId,
            eligible ? 'delivered' : 'suppressed',
            eligible ? new Date() : null,
          ],
        );
        await audit(
          db,
          event.tenant_id,
          null,
          eligible ? 'AlertDelivered' : 'AlertSuppressed',
          payload.alertId,
        );
      }
    }
    await write(
      db,
      'UPDATE outbox SET published_at=UTC_TIMESTAMP(6) WHERE id=?',
      [event.id],
    );
    return true;
  });
}
export async function claimJob(): Promise<Job | undefined> {
  return transaction(async (db) => {
    const [job] = await rows<Job>(
      db,
      `SELECT * FROM sync_jobs WHERE (status='pending' AND available_at<=UTC_TIMESTAMP(6)) OR (status='processing' AND lease_until<UTC_TIMESTAMP(6)) ORDER BY available_at,id LIMIT 1 FOR UPDATE SKIP LOCKED`,
    );
    if (!job) return;
    if (job.attempts >= config.maxAttempts) {
      await write(
        db,
        "UPDATE sync_jobs SET status='dead',last_error='LEASE_EXHAUSTED',lease_token=NULL,lease_until=NULL WHERE id=?",
        [job.id],
      );
      return;
    }
    const token = randomUUID();
    await write(
      db,
      "UPDATE sync_jobs SET status='processing',attempts=attempts+1,lease_token=?,lease_until=DATE_ADD(UTC_TIMESTAMP(6), INTERVAL ? SECOND) WHERE id=?",
      [token, config.leaseSeconds, job.id],
    );
    return { ...job, attempts: job.attempts + 1, lease_token: token };
  });
}
export async function runJob(job: Job) {
  try {
    const watchOutside = await getWatch(job.tenant_id, job.watch_id);
    const price = mockObservation(
      watchOutside.sku_id,
      job.scenario,
      job.attempts,
    );
    await transaction(async (db) => {
      const [lease] = await rows<RowDataPacket>(
        db,
        "SELECT id FROM sync_jobs WHERE id=? AND status='processing' AND lease_token=? AND lease_until>UTC_TIMESTAMP(6) FOR UPDATE",
        [job.id, job.lease_token],
      );
      if (!lease) return;
      const watch = await getWatch(job.tenant_id, job.watch_id, db, true);
      if (!watch.active) {
        await write(
          db,
          "UPDATE sync_jobs SET status='cancelled',lease_until=NULL,lease_token=NULL WHERE id=?",
          [job.id],
        );
        return;
      }
      const [existing] = await rows<RowDataPacket>(
        db,
        'SELECT id FROM observations WHERE tenant_id=? AND source_key=?',
        [job.tenant_id, job.id],
      );
      if (!existing) {
        const observationId = randomUUID();
        const history = await rows<RowDataPacket>(
          db,
          'SELECT amount,currency,observed_at,region,basis FROM observations WHERE tenant_id=? AND watch_id=? AND observed_at>=? ORDER BY observed_at',
          [
            job.tenant_id,
            job.watch_id,
            new Date(Date.now() - config.baselineWindowMs),
          ],
        );
        const score = scoreFrom(price, history);
        await write(
          db,
          'INSERT INTO observations VALUES (?,?,?,?,?,?,?,?,?,?,TRUE)',
          [
            observationId,
            job.tenant_id,
            job.watch_id,
            job.id,
            price.amount,
            price.currency,
            price.observedAt,
            new Date(),
            price.region,
            price.basis,
          ],
        );
        await write(
          db,
          `INSERT INTO deal_scores VALUES (?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE observation_id=VALUES(observation_id),status=VALUES(status),score=VALUES(score),change_pct=VALUES(change_pct),baseline=VALUES(baseline),samples=VALUES(samples),explanation=VALUES(explanation)`,
          [
            job.tenant_id,
            job.watch_id,
            observationId,
            score.status,
            score.score,
            score.changePct,
            score.baseline,
            score.samples,
            score.explanation,
          ],
        );
        await emit(db, job.tenant_id, 'PriceObserved', job.watch_id, {
          observationId,
          jobId: job.id,
          status: score.status,
        });
        if (
          score.status === 'available' &&
          score.changePct! > 0 &&
          price.amount <= Number(watch.target_price) &&
          watch.consent
        ) {
          const alertId = randomUUID();
          const state = `${job.watch_id}:${price.currency}:${price.amount}:VN:listed`;
          const alert = await write(
            db,
            'INSERT IGNORE INTO alerts VALUES (?,?,?,?,?,UTC_TIMESTAMP(6))',
            [alertId, job.tenant_id, job.watch_id, state, price.amount],
          );
          if (alert.affectedRows)
            await emit(db, job.tenant_id, 'AlertQualified', job.watch_id, {
              alertId,
              amount: price.amount,
              observedAt: price.observedAt.toISOString(),
            });
        }
      }
      await write(
        db,
        "UPDATE sync_jobs SET status='completed',lease_until=NULL,lease_token=NULL,last_error=NULL WHERE id=?",
        [job.id],
      );
    });
  } catch (error) {
    const expected =
      error instanceof Error &&
      ['MOCK_429', 'MOCK_PROVIDER_FAILURE'].includes(error.message);
    const code =
      error instanceof Error && error.message === 'MOCK_429'
        ? 'MOCK_429'
        : expected
          ? 'PROVIDER_ERROR'
          : 'INTERNAL_ERROR';
    const delayMs =
      code === 'MOCK_429'
        ? 1000
        : Math.min(30000, 500 * 2 ** job.attempts) +
          Math.floor(Math.random() * 250);
    await write(
      pool,
      'UPDATE sync_jobs SET status=?,last_error=?,available_at=?,lease_until=NULL,lease_token=NULL WHERE id=? AND lease_token=?',
      [
        job.attempts >= config.maxAttempts ? 'dead' : 'pending',
        code,
        new Date(Date.now() + delayMs),
        job.id,
        job.lease_token,
      ],
    );
    if (!expected) throw error;
  }
}
export async function tick() {
  const event = await processOutbox();
  const job = await claimJob();
  if (job) await runJob(job);
  return event || Boolean(job);
}
