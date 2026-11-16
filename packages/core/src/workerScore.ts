import { scorePrice } from './scoring.js';
import type { RowDataPacket } from 'mysql2/promise';
import type { mockObservation } from './mock.js';
export function scoreFrom(
  price: ReturnType<typeof mockObservation>,
  history: RowDataPacket[],
) {
  return scorePrice(
    price,
    history.map((p) => ({
      amount: Number(p.amount),
      currency: p.currency,
      observedAt: new Date(p.observed_at),
      region: p.region,
      basis: p.basis,
    })),
  );
}
