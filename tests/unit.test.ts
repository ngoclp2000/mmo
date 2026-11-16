import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveUrl } from '../packages/core/src/mock.js';
import { scorePrice, type Price } from '../packages/core/src/scoring.js';
import { passwordHash, verifyPassword } from '../packages/core/src/auth.js';
const now = new Date('2026-11-16T10:00:00Z');
const price: Price = {
  amount: 75,
  currency: 'VND',
  region: 'VN',
  basis: 'listed:no-shipping:no-voucher',
  observedAt: now,
};
const history = [100, 100].map((amount, i) => ({
  ...price,
  amount,
  observedAt: new Date(now.getTime() - (i + 1) * 60000),
}));
test('resolves exact synthetic SKU fixture, no network required', () => {
  assert.equal(resolveUrl('https://shopee.vn/mock/sneaker').skus.length, 2);
  assert.equal(resolveUrl('https://www.shopee.vn/mock/sneaker').id, 'sneaker');
});
test('rejects SSRF, suffix host, credentials, redirect parameters and unsupported URLs', () => {
  for (const url of [
    'http://shopee.vn/mock/sneaker',
    'https://127.0.0.1/mock/sneaker',
    'https://[::1]/mock/sneaker',
    'https://169.254.169.254/',
    'https://shopee.vn.evil.test/mock/sneaker',
    'https://user:secret@shopee.vn/mock/sneaker',
    'https://shopee.vn:8443/mock/sneaker',
    'https://shopee.vn/mock/sneaker?next=https://evil.test',
    'https://shopee.vn/mock/sneaker#frag',
    'https://shopee.vn/real-product',
    'file:///etc/passwd',
    'https://shopee.vn\\@evil.test/mock/sneaker',
  ])
    assert.throws(() => resolveUrl(url));
});
test('same-context median yields explainable score, excludes current/future observations', () => {
  const result = scorePrice(
    price,
    [
      ...history,
      price,
      { ...price, amount: 1, observedAt: new Date(now.getTime() + 60000) },
    ],
    now,
  );
  assert.equal(result.baseline, 100);
  assert.equal(result.score, 25);
  assert.equal(result.samples, 2);
});
test('insufficient samples or incompatible contexts never fabricate score', () => {
  assert.equal(scorePrice(price, [history[0]], now).status, 'unavailable');
  for (const altered of [
    { currency: 'USD' },
    { region: 'US' },
    { basis: 'checkout' },
  ])
    assert.equal(
      scorePrice({ ...price, ...altered }, history, now).status,
      'unavailable',
    );
  assert.equal(
    scorePrice(
      price,
      history.map((p) => ({ ...p, currency: 'USD' })),
      now,
    ).status,
    'unavailable',
  );
});
test('stale and invalid future timestamps cannot qualify', () => {
  assert.equal(
    scorePrice(
      { ...price, observedAt: new Date(now.getTime() - 24 * 3600000) },
      history,
      now,
    ).status,
    'stale',
  );
  assert.equal(
    scorePrice(
      { ...price, observedAt: new Date(now.getTime() + 120000) },
      history,
      now,
    ).status,
    'stale',
  );
});
test('score is clamped and zero/nonpositive baseline inputs are excluded', () => {
  assert.equal(scorePrice({ ...price, amount: 150 }, history, now).score, 0);
  assert.equal(
    scorePrice(
      price,
      history.map((p) => ({ ...p, amount: 0 })),
      now,
    ).status,
    'unavailable',
  );
});
test('password hashes are salted and wrong password fails', async () => {
  const hash = await passwordHash('local-demo-password');
  assert.notEqual(hash, await passwordHash('local-demo-password'));
  assert.equal(await verifyPassword('local-demo-password', hash), true);
  assert.equal(await verifyPassword('wrong', hash), false);
});
