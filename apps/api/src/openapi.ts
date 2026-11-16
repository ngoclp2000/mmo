const json = (schema: object) => ({ 'application/json': { schema } });
const object = (properties: object, required: string[] = []) => ({
  type: 'object',
  properties,
  required,
  additionalProperties: false,
});
const str = { type: 'string' };
const id = { type: 'string', format: 'uuid' };
const money = { type: 'integer', minimum: 1, maximum: 1_000_000_000 };
const bool = { type: 'boolean' };
const key = {
  type: 'string',
  minLength: 8,
  maxLength: 80,
  pattern: '^[a-zA-Z0-9:_-]+$',
};
const tracking = { targetPrice: money, consent: bool };
function operation(
  summary: string,
  options: {
    body?: object;
    tenant?: boolean;
    item?: boolean;
    post?: boolean;
    public?: boolean;
    response?: object;
  } = {},
) {
  return {
    summary,
    security: options.public ? [] : [{ session: [] }],
    parameters: [
      ...(options.tenant
        ? [{ in: 'path', name: 'tenantId', required: true, schema: id }]
        : []),
      ...(options.item
        ? [{ in: 'path', name: 'id', required: true, schema: id }]
        : []),
      ...(options.post && !options.public
        ? [{ in: 'header', name: 'X-CSRF-Token', required: true, schema: str }]
        : []),
      ...(options.post
        ? [
            {
              in: 'header',
              name: 'Origin',
              required: true,
              schema: { type: 'string', format: 'uri' },
            },
          ]
        : []),
    ],
    ...(options.body
      ? { requestBody: { required: true, content: json(options.body) } }
      : {}),
    responses: {
      [options.response ? '200' : 'default']: {
        description: options.response
          ? 'Successful response'
          : 'JSON response; see endpoint notes',
        content: json(options.response ?? { type: 'object' }),
      },
      '400': { description: 'Invalid request' },
      '401': { description: 'Login required' },
      '403': { description: 'Tenant/RBAC, Origin or CSRF rejected' },
      '404': { description: 'Resource unavailable in this tenant' },
      '409': { description: 'Conflicting state or idempotency key' },
      '429': { description: 'Rate limited; respect Retry-After' },
    },
  };
}
export const openapi = {
  openapi: '3.1.0',
  info: {
    title: 'CommerceOS synthetic demo API',
    version: '0.1.0',
    description:
      'Local demo only. APP_ORIGIN must match the browser origin. Mutations require Origin and (except login) X-CSRF-Token from /api/session. Prices synthetic, affiliate destination fixed local; no production credentials or real provider endpoints.',
  },
  servers: [{ url: '/' }],
  components: {
    securitySchemes: {
      session: { type: 'apiKey', in: 'cookie', name: 'session' },
    },
  },
  paths: {
    '/healthz': {
      get: operation('MySQL and configured Redis readiness', {
        public: true,
        response: object({ status: str, mode: str }),
      }),
    },
    '/api/login': {
      post: operation(
        'Create HttpOnly SameSite=Strict demo session; 10 attempts/minute',
        {
          public: true,
          post: true,
          body: object(
            {
              email: { type: 'string', format: 'email' },
              password: { type: 'string', maxLength: 256 },
            },
            ['email', 'password'],
          ),
          response: object({ csrfToken: str }),
        },
      ),
    },
    '/api/session': {
      get: operation('Current user, memberships and CSRF token', {
        response: { type: 'object' },
      }),
    },
    '/api/logout': {
      post: operation('Revoke session', {
        post: true,
        response: object({ ok: bool }),
      }),
    },
    '/api/workspaces/{tenantId}/dashboard': {
      get: operation(
        'Tenant-scoped watches (numeric VND, boolean consent/active), delivered inbox alerts, last 20 jobs and demo clicks',
        { tenant: true, response: { type: 'object' } },
      ),
    },
    '/api/workspaces/{tenantId}/fixtures': {
      get: operation(
        'Synthetic product fixtures and unverified real capabilities',
        { tenant: true, response: { type: 'object' } },
      ),
    },
    '/api/workspaces/{tenantId}/resolve': {
      post: operation('Parse exact fixture URL locally; no fetch', {
        tenant: true,
        post: true,
        body: object({ url: { type: 'string', maxLength: 2048 } }, ['url']),
        response: { type: 'object' },
      }),
    },
    '/api/workspaces/{tenantId}/watches': {
      post: {
        ...operation(
          'Create tracking (201); same tenant/SKU returns existing id without changing rule',
          {
            tenant: true,
            post: true,
            body: object({ ...tracking, skuId: str }, [
              'targetPrice',
              'consent',
              'skuId',
            ]),
          },
        ),
        responses: {
          '201': {
            description: 'Watch id',
            content: json(object({ id, synthetic: { const: true } })),
          },
        },
      },
    },
    '/api/workspaces/{tenantId}/watches/{id}': {
      patch: operation('Update target, active state and notification consent', {
        tenant: true,
        item: true,
        post: true,
        body: object({ ...tracking, active: bool }, [
          'targetPrice',
          'consent',
          'active',
        ]),
        response: object({ ok: bool }),
      }),
    },
    '/api/workspaces/{tenantId}/watches/{id}/history': {
      get: operation(
        'Latest 100 synthetic observations; exact tenant/SKU; chronological chart in UI',
        { tenant: true, item: true, response: { type: 'object' } },
      ),
    },
    '/api/workspaces/{tenantId}/watches/{id}/check': {
      post: {
        ...operation(
          'Queue synthetic scenario (202); reused key with different body returns 409',
          {
            tenant: true,
            item: true,
            post: true,
            body: object(
              {
                scenario: {
                  enum: [
                    'steady',
                    'drop',
                    'stale',
                    'currency',
                    'rate-limit',
                    'failure',
                  ],
                },
                requestKey: key,
              },
              ['scenario', 'requestKey'],
            ),
          },
        ),
        responses: {
          '202': { description: 'Job accepted', content: json(object({ id })) },
        },
      },
    },
    '/api/workspaces/{tenantId}/watches/{id}/click': {
      post: operation(
        'Record idempotent synthetic click; fixed /demo-destination, no merchant redirect',
        {
          tenant: true,
          item: true,
          post: true,
          body: object({ requestKey: key }, ['requestKey']),
          response: object({
            id,
            destination: { const: '/demo-destination' },
            synthetic: { const: true },
            disclosure: str,
          }),
        },
      ),
    },
    '/api/workspaces/{tenantId}/jobs/{id}/replay': {
      post: operation(
        'Admin only; requeue dead-letter retaining job identity',
        {
          tenant: true,
          item: true,
          post: true,
          response: object({ ok: bool }),
        },
      ),
    },
    '/api/workspaces/{tenantId}/audit': {
      get: operation('Admin only; latest 100 tenant audit entries', {
        tenant: true,
        response: { type: 'object' },
      }),
    },
  },
};
