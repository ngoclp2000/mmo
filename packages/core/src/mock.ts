import { DomainError } from './security.js';
export const fixtures = [
  {
    id: 'sneaker',
    title: 'Everyday Runner',
    category: 'Giày thể thao',
    source: 'shopee.vn',
    path: '/mock/sneaker',
    color: '#e5dcca',
    skus: [
      { id: 'sneaker-38', variant: 'Kem · Size 38', price: 1290000 },
      { id: 'sneaker-39', variant: 'Kem · Size 39', price: 1350000 },
    ],
  },
  {
    id: 'headphones',
    title: 'Studio Quiet',
    category: 'Âm thanh',
    source: 'shop.tiktok.com',
    path: '/mock/headphones',
    color: '#d8dfec',
    skus: [
      {
        id: 'headphones-black',
        variant: 'Graphite · Không dây',
        price: 1890000,
      },
    ],
  },
  {
    id: 'bag',
    title: 'Daily Carry',
    category: 'Phụ kiện',
    source: 'shopee.vn',
    path: '/mock/bag',
    color: '#dce6d9',
    skus: [{ id: 'bag-olive', variant: 'Olive · 18L', price: 790000 }],
  },
];
export function resolveUrl(raw: string) {
  if (raw.length > 2048) throw new DomainError(400, 'URL quá dài.');
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new DomainError(400, 'URL không hợp lệ.');
  }
  const allowed = ['shopee.vn', 'www.shopee.vn', 'shop.tiktok.com'];
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.port ||
    !allowed.includes(url.hostname) ||
    url.search ||
    url.hash ||
    [...raw].some((c) => c.charCodeAt(0) <= 32 || c === String.fromCharCode(92))
  )
    throw new DomainError(
      400,
      'Chỉ nhận URL HTTPS mẫu, đúng host, không thông tin đăng nhập/query/fragment.',
    );
  const fixture = fixtures.find(
    (f) =>
      f.source === url.hostname.replace(/^www\./, '') &&
      f.path === url.pathname,
  );
  if (!fixture)
    throw new DomainError(
      422,
      'Mock chỉ hỗ trợ URL mẫu trong thư viện. Không truy cập website thật.',
    );
  return fixture;
}
export function fixtureSku(id: string) {
  for (const f of fixtures) {
    const sku = f.skus.find((s) => s.id === id);
    if (sku) return { ...sku, listing: f };
  }
  throw new DomainError(404, 'Không có SKU mẫu này.');
}
export const scenarios = [
  'steady',
  'drop',
  'stale',
  'currency',
  'rate-limit',
  'failure',
] as const;
export type Scenario = (typeof scenarios)[number];
export function mockObservation(
  skuId: string,
  scenario: Scenario,
  attempts: number,
) {
  const sku = fixtureSku(skuId);
  if (scenario === 'failure' || (scenario === 'rate-limit' && attempts === 1))
    throw new Error(
      scenario === 'rate-limit' ? 'MOCK_429' : 'MOCK_PROVIDER_FAILURE',
    );
  return {
    amount: scenario === 'drop' ? Math.round(sku.price * 0.75) : sku.price,
    currency: scenario === 'currency' ? 'USD' : 'VND',
    observedAt:
      scenario === 'stale'
        ? new Date(Date.now() - 24 * 60 * 60 * 1000)
        : new Date(),
    region: 'VN',
    basis: 'listed:no-shipping:no-voucher',
  };
}
