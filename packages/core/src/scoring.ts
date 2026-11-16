import { config } from './config.js';
export type Price = {
  amount: number;
  currency: string;
  observedAt: Date;
  region: string;
  basis: string;
};
export function scorePrice(current: Price, history: Price[], now = new Date()) {
  if (
    current.observedAt.getTime() > now.getTime() + 60_000 ||
    now.getTime() - current.observedAt.getTime() > config.freshnessMs
  ) {
    return {
      status: 'stale' as const,
      score: null,
      changePct: null,
      baseline: null,
      samples: 0,
      explanation:
        'Quan sát quá cũ hoặc thời gian không hợp lệ; không cảnh báo.',
    };
  }
  if (
    current.currency !== 'VND' ||
    current.region !== 'VN' ||
    current.basis !== 'listed:no-shipping:no-voucher'
  ) {
    return {
      status: 'unavailable' as const,
      score: null,
      changePct: null,
      baseline: null,
      samples: 0,
      explanation: 'Khác tiền tệ hoặc điều kiện giá; không so sánh.',
    };
  }
  const samples = history
    .filter(
      (p) =>
        p.currency === current.currency &&
        p.region === current.region &&
        p.basis === current.basis &&
        p.observedAt < current.observedAt &&
        current.observedAt.getTime() - p.observedAt.getTime() <=
          config.baselineWindowMs &&
        p.amount > 0,
    )
    .map((p) => p.amount)
    .sort((a, b) => a - b);
  if (samples.length < config.minSamples)
    return {
      status: 'unavailable' as const,
      score: null,
      changePct: null,
      baseline: null,
      samples: samples.length,
      explanation: 'Chưa đủ 2 mẫu trước đó cùng SKU/điều kiện.',
    };
  const middle = Math.floor(samples.length / 2);
  const baseline =
    samples.length % 2
      ? samples[middle]
      : (samples[middle - 1] + samples[middle]) / 2;
  const changePct =
    Math.round(((baseline - current.amount) / baseline) * 10000) / 100;
  return {
    status: 'available' as const,
    score: Math.max(0, Math.min(100, Math.round(changePct))),
    changePct,
    baseline,
    samples: samples.length,
    explanation: `So với trung vị ${samples.length} quan sát trước trong 7 ngày. Không chứng minh giảm giá thật; chưa gồm vận chuyển/voucher.`,
  };
}
