export interface Fixture {
  id: string;
  title: string;
  category: string;
  source: string;
  path: string;
  color: string;
  skus: { id: string; variant: string; price: number }[];
}
export interface Watch {
  id: string;
  sku_id: string;
  target_price: number;
  consent: boolean;
  active: boolean;
  current_price: number;
  currency: string;
  observed_at: string;
  score_status: 'available' | 'unavailable' | 'stale' | null;
  score: number | null;
  change_pct: number | null;
  baseline: number | null;
  samples: number | null;
  explanation: string | null;
  synthetic: true;
  freshness: 'fresh' | 'stale' | 'unavailable';
  fixture: { id: string; variant: string; price: number; listing: Fixture };
}
export interface Alert {
  id: string;
  watch_id: string;
  amount: number;
  created_at: string;
  status: string;
}
export interface Job {
  id: string;
  watch_id: string;
  scenario: string;
  status: string;
  attempts: number;
  last_error: string | null;
  created_at: string;
}
export interface Dashboard {
  watches: Watch[];
  alerts: Alert[];
  jobs: Job[];
  clicks: number;
  synthetic: true;
}
export interface Observation {
  id: string;
  amount: number;
  currency: string;
  observed_at: string;
  synthetic: boolean;
}
