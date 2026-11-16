import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import staticFiles from '@fastify/static';
import { Redis } from 'ioredis';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { z } from 'zod';
import { openapi } from './openapi.js';
import type { RowDataPacket } from 'mysql2/promise';
import {
  assertDemoRuntime,
  config,
} from '../../../packages/core/src/config.js';
import {
  pool,
  rows,
  transaction,
  write,
} from '../../../packages/core/src/db.js';
import {
  authorize,
  getSession,
  login,
  tokenHash,
} from '../../../packages/core/src/auth.js';
import {
  audit,
  createWatch,
  dashboard,
  enqueueJob,
  getWatch,
  recordClick,
  updateWatch,
} from '../../../packages/core/src/commerce.js';
import {
  fixtures,
  resolveUrl,
  scenarios,
} from '../../../packages/core/src/mock.js';
import { DomainError } from '../../../packages/core/src/security.js';

const paramsSchema = z.object({ tenantId: z.uuid(), id: z.uuid().optional() });
const tracking = z.object({
  targetPrice: z.number().int().positive().max(1_000_000_000),
  consent: z.boolean(),
});
const requestKey = z
  .string()
  .min(8)
  .max(80)
  .regex(/^[a-zA-Z0-9:_-]+$/);
export async function buildApp() {
  assertDemoRuntime();
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? 'warn',
      redact: [
        'req.headers.cookie',
        'req.headers.authorization',
        'res.headers["set-cookie"]',
      ],
    },
    bodyLimit: 16 * 1024,
  });
  const redis = process.env.REDIS_URL
    ? new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 1 })
    : undefined;
  if (redis) {
    redis.on('error', () => app.log.warn('Redis unavailable'));
    app.addHook('onClose', async () => {
      await redis.quit();
    });
  }
  await app.register(cookie);
  await app.register(rateLimit, {
    max: 120,
    timeWindow: '1 minute',
    redis,
    skipOnError: false,
    nameSpace: process.env.RATE_LIMIT_NAMESPACE ?? 'commerceos-rate:',
  });
  app.addHook('onRequest', async (req, reply) => {
    reply
      .header('X-Content-Type-Options', 'nosniff')
      .header('Referrer-Policy', 'no-referrer')
      .header('X-Frame-Options', 'DENY');
    reply.header(
      'Content-Security-Policy',
      "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
    );
    if (req.url.startsWith('/api/')) reply.header('Cache-Control', 'no-store');
    if (
      req.url.startsWith('/api/') &&
      !['GET', 'HEAD', 'OPTIONS'].includes(req.method)
    ) {
      if (req.headers.origin !== config.origin)
        throw new DomainError(403, 'Origin không được phép.');
      if (req.url !== '/api/login') {
        const session = await getSession(req.cookies.session);
        if (req.headers['x-csrf-token'] !== session.csrf_token)
          throw new DomainError(403, 'CSRF token không hợp lệ.');
      }
    }
  });
  app.setErrorHandler((error, req, reply) => {
    if (error instanceof z.ZodError)
      return reply.code(400).send({
        message: 'Dữ liệu không hợp lệ.',
        issues: error.issues.map((i) => ({
          path: i.path,
          message: i.message,
        })),
      });
    const normalized =
      error instanceof Error ? error : new Error('Unknown error');
    const status =
      error instanceof DomainError
        ? error.statusCode
        : 'statusCode' in normalized &&
            typeof normalized.statusCode === 'number'
          ? normalized.statusCode
          : 500;
    if (status >= 500)
      req.log.error({ code: 'REQUEST_FAILED' }, 'Request failed');
    return reply.code(status).send({
      message:
        status >= 500 ? 'Dịch vụ tạm thời không sẵn sàng.' : normalized.message,
    });
  });
  app.get('/api/openapi.json', async () => openapi);
  app.get('/healthz', async () => {
    await pool.query('SELECT 1');
    if (redis) await redis.ping();
    return { status: 'ok', mode: 'demo' };
  });
  app.post(
    '/api/login',
    { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (req, reply) => {
      const body = z
        .object({
          email: z.email().max(254),
          password: z.string().min(1).max(256),
        })
        .parse(req.body);
      const result = await login(body.email, body.password);
      reply.setCookie('session', result.token, {
        httpOnly: true,
        secure: false,
        sameSite: 'strict',
        path: '/',
        maxAge: config.sessionSeconds,
      });
      return { csrfToken: result.csrf };
    },
  );
  app.get('/api/session', async (req) => {
    const session = await getSession(req.cookies.session);
    const memberships = await rows<RowDataPacket>(
      pool,
      'SELECT t.id,t.name,m.role FROM tenants t JOIN memberships m ON m.tenant_id=t.id WHERE m.user_id=? ORDER BY t.name',
      [session.user_id],
    );
    return {
      user: { name: session.name, email: session.email },
      csrfToken: session.csrf_token,
      workspaces: memberships,
      mode: 'demo',
    };
  });
  app.post('/api/logout', async (req, reply) => {
    await getSession(req.cookies.session);
    await write(pool, 'DELETE FROM sessions WHERE token_hash=?', [
      tokenHash(req.cookies.session!),
    ]);
    reply.clearCookie('session', { path: '/' });
    return { ok: true };
  });
  app.get('/api/workspaces/:tenantId/dashboard', async (req) => {
    const { tenantId } = paramsSchema.parse(req.params);
    await authorize(await getSession(req.cookies.session), tenantId);
    return dashboard(tenantId);
  });
  app.get('/api/workspaces/:tenantId/fixtures', async (req) => {
    const { tenantId } = paramsSchema.parse(req.params);
    await authorize(await getSession(req.cookies.session), tenantId);
    return {
      fixtures,
      synthetic: true,
      capabilities: {
        mock: 'available',
        shopee: 'unverified',
        tiktok: 'unverified',
      },
    };
  });
  app.post('/api/workspaces/:tenantId/resolve', async (req) => {
    const { tenantId } = paramsSchema.parse(req.params);
    await authorize(await getSession(req.cookies.session), tenantId);
    const { url } = z.object({ url: z.string().max(2048) }).parse(req.body);
    return { fixture: resolveUrl(url), synthetic: true, networkFetch: false };
  });
  app.post('/api/workspaces/:tenantId/watches', async (req, reply) => {
    const { tenantId } = paramsSchema.parse(req.params);
    const session = await getSession(req.cookies.session);
    await authorize(session, tenantId);
    const body = tracking.extend({ skuId: z.string().max(80) }).parse(req.body);
    const id = await createWatch(
      tenantId,
      session.user_id,
      body.skuId,
      body.targetPrice,
      body.consent,
    );
    return reply.code(201).send({ id, synthetic: true });
  });
  app.patch('/api/workspaces/:tenantId/watches/:id', async (req) => {
    const { tenantId, id } = paramsSchema.required().parse(req.params);
    const session = await getSession(req.cookies.session);
    await authorize(session, tenantId);
    const body = tracking.extend({ active: z.boolean() }).parse(req.body);
    await updateWatch(
      tenantId,
      session.user_id,
      id,
      body.targetPrice,
      body.consent,
      body.active,
    );
    return { ok: true };
  });
  app.get('/api/workspaces/:tenantId/watches/:id/history', async (req) => {
    const { tenantId, id } = paramsSchema.required().parse(req.params);
    await authorize(await getSession(req.cookies.session), tenantId);
    await getWatch(tenantId, id);
    const history = await rows<RowDataPacket>(
      pool,
      'SELECT id,amount,currency,observed_at,received_at,region,basis,synthetic FROM observations WHERE tenant_id=? AND watch_id=? ORDER BY observed_at DESC LIMIT 100',
      [tenantId, id],
    );
    return { history };
  });
  app.post(
    '/api/workspaces/:tenantId/watches/:id/check',
    async (req, reply) => {
      const { tenantId, id } = paramsSchema.required().parse(req.params);
      const session = await getSession(req.cookies.session);
      await authorize(session, tenantId);
      const body = z
        .object({ scenario: z.enum(scenarios), requestKey })
        .parse(req.body);
      return reply.code(202).send({
        id: await enqueueJob(
          tenantId,
          session.user_id,
          id,
          body.scenario,
          body.requestKey,
        ),
      });
    },
  );
  app.post('/api/workspaces/:tenantId/watches/:id/click', async (req) => {
    const { tenantId, id } = paramsSchema.required().parse(req.params);
    const session = await getSession(req.cookies.session);
    await authorize(session, tenantId);
    return recordClick(
      tenantId,
      session.user_id,
      id,
      z.object({ requestKey }).parse(req.body).requestKey,
    );
  });
  app.post('/api/workspaces/:tenantId/jobs/:id/replay', async (req) => {
    const { tenantId, id } = paramsSchema.required().parse(req.params);
    const session = await getSession(req.cookies.session);
    await authorize(session, tenantId, true);
    await transaction(async (db) => {
      const [job] = await rows<RowDataPacket>(
        db,
        'SELECT * FROM sync_jobs WHERE tenant_id=? AND id=? FOR UPDATE',
        [tenantId, id],
      );
      if (!job) throw new DomainError(404, 'Không tìm thấy job.');
      if (job.status !== 'dead')
        throw new DomainError(409, 'Chỉ replay job dead-letter.');
      await write(
        db,
        "UPDATE sync_jobs SET status='pending',attempts=0,last_error=NULL,available_at=UTC_TIMESTAMP(6),lease_until=NULL,lease_token=NULL WHERE tenant_id=? AND id=?",
        [tenantId, id],
      );
      await audit(db, tenantId, session.user_id, 'JobReplayed', id);
    });
    return { ok: true };
  });
  app.get('/api/workspaces/:tenantId/audit', async (req) => {
    const { tenantId } = paramsSchema.parse(req.params);
    await authorize(await getSession(req.cookies.session), tenantId, true);
    return {
      entries: await rows<RowDataPacket>(
        pool,
        'SELECT action,resource_id,created_at FROM audit_logs WHERE tenant_id=? ORDER BY created_at DESC LIMIT 100',
        [tenantId],
      ),
    };
  });
  const webRoot = resolve('apps/web/dist');
  if (existsSync(webRoot)) {
    await app.register(staticFiles, { root: webRoot, prefix: '/' });
    app.setNotFoundHandler(async (req, reply) =>
      req.url.startsWith('/api/')
        ? reply.code(404).send({ message: 'Không có API này.' })
        : reply.type('text/html').sendFile('index.html'),
    );
  }
  return app;
}
