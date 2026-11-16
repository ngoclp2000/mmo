# CommerceOS — Implementation Roadmap for Codex

## Product sequencing
Build one All-in-One application but ship capabilities incrementally. Phase 0–2 serve buyers and initial affiliate users; phases 3–5 expand creator, AI and seller workflows. Feature flags and entitlements control availability.

## Phase 0 — Discovery, permissions and architecture (P0)
**Outputs:** docs/00–10, C4 diagrams, DDD context map, risk register, API capability validation checklist, cost model, UX flows, backlog.
**Decisions:** target market VN; authorized Shopee Affiliate API vs TikTok scope; provider terms and data rights; price freshness rules; tenant/user model; initial category niche.
**Gate:** explicit acceptance of domain boundaries, source feasibility, MVP success criteria, pricing claims policy.

## Phase 1 — Technical foundation (P0)
**Slices:**
1. Monorepo scaffold; local Docker Compose (web, API, MySQL, Redis, worker); CI, formatter, lint, unit tests.
2. Identity / login, workspace and tenant isolation, role-based access, audit events.
3. Product source URL validation and SSRF-safe link intake; ConnectorCapability registry and mock Shopee/TikTok adapters.
4. Async job scheduling/outbox, retries, throttling, idempotency, metrics and DLQ view.
**DoD:** deploy locally from README, migrations/seed, tests, secrets via env/secret store, no tenant leakage.

## Phase 2 — Commerce Intelligence MVP (P0)
**Slices:**
1. Catalog: SourceListing, SourceSku, shop metadata, mapping provenance, dedupe within source.
2. Price snapshots: source/time/currency/SKU/price type, bounded retention, query chart.
3. Watchlist: paste link, select specific SKU, opt-in threshold alert, unsubscribe.
4. Deal scoring: median observed-price baseline with confidence flag, recent change and no misleading percentage claims.
5. Deal feed: limited, clearly labeled eligible sources; search/filter, stale data markers.
6. Authorized Affiliate link generation, outgoing redirect logging, click attribution (no false conversion inference).
7. Test against officially approved scopes; run data-quality review before enabling live provider.
**DoD:** end-to-end link-to-watchlist, price updates and alerts with synthetic fixture data; live providers only if authorized.

## Phase 3 — Monetization & user validation (P1)
- Affiliate tracking and revenue reconciliation from reports when accessible.
- Telegram notification channel (per-user opt-in and provider rules); email alerts; alert cooldown and dedupe.
- SEO landing pages only for permitted public offers; disclosure of Affiliate relationships.
- Product analytics (click-through, observed affiliate approvals, retained users) with baseline dashboards.
**Gate:** verify channel distribution and economics before spending on advanced automation.

## Phase 4 — Creator & AI Studio (P1)
- Authorized creator identity/connectors, eligible product discovery, research dashboard.
- Product brief grounding with provenance and dates; AI content drafts, review queue, prompt versions, token budgets.
- Template-based campaign plans and supported publishing channels with approval, not unsolicited spam.
- Creator subscription, quotas, usage reports, billing webhooks and reconciliation.
**Gate:** paid pilots and verified creator API permissions.

## Phase 5 — Seller / Agency (P2)
- Seller OAuth, tenant-aware account connection and organization roles.
- Collaboration/campaign/creator performance in exact permissions and available metrics.
- Billing, B2B reports, data retention, access audits and team management.
- Attribution reconciliation, cost/ROI only when financial inputs support it.
**Gate:** 3–5 design-partner sellers and legal/API approval for scope.

## Phase 6 — Scale and expanded integrations (P2)
- Benchmark price snapshot volume, read latency, retention and MySQL indexing.
- If justified, dual pipeline via outbox/stream to ClickHouse; correctness/replay/backfill, migration and rollbacks.
- Search service if MySQL query limits are measured. Add Kafka only if throughput, multi-consumer replay or isolation justifies its operational cost.
- Public API/widgets only if source data redistribution terms permit.

## Proposed initial data model (logical)
- platform: tenants, users, memberships, roles, entitlements, audit_logs
- integrations: providers, connector_accounts, connector_scopes, source_capabilities, source_policy_versions, sync_jobs, connector_credentials_reference
- catalog: source_shops, source_listings, source_skus, canonical_products, product_matches, product_media
- pricing: price_observations, offer_observations, voucher_observations, price_baselines, deal_scores
- engagement: watchlists, watchlist_rules, alerts, notification_deliveries
- affiliate: affiliate_links, outbound_clicks, conversions, commission_events, reconciliation_runs
- AI/workflow (later): content_briefs, content_drafts, approvals, workflows, workflow_runs
- seller/creator (later): creator_profiles, seller_accounts, affiliate_campaigns, collaboration_records

## Events / flows
`LinkSubmitted -> UrlValidated -> SourceResolved -> ListingResolved -> SkuSelected -> TrackingEnabled -> PriceObserved -> BaselineUpdated -> DealScored -> AlertQualified -> AlertDelivered`

`EligibleOfferDiscovered -> AffiliateLinkRequested -> AffiliateLinkGenerated -> OutboundClicked -> ConversionImported -> CommissionReconciled`

**Reliability:** transactional outbox for domain-to-worker notifications; idempotency keys; per-provider token buckets; retries w/ exponential backoff; dead-letter; source data quality flags.

## Price and deal safeguards
- Identity: exact same SKU or high-confidence canonical match. Match confidence is visible.
- Compare like-for-like observed price with same shipping assumptions, region, and eligible vouchers. Keep listed prices separate from payable estimates.
- A price change within a short observation window is *not* automatically proof of genuine discount.
- Alert only on fresh enough data and dedupe repeated price states.
- Provide explicit timestamp, source, coverage and unavailable data labels.

## API access validation checklist
For each provider and account: official documentation URL/date, developer app registration, supported territory, required OAuth scopes, authorization holder, product/search/offer endpoints, batch size, quotas, pagination, price fields per SKU, coupon eligibility, data storage/retention, disclosure requirements, redistribution, affiliate reporting/attribution, webhook availability, revocation, privacy policy and commercial terms.

## Capacity and cost scenarios (illustrative, not forecasts)
Price checks/day = tracked_skus × (24 × 60 / average_interval_minutes).
- 1k SKUs @ 6h => 4k checks/day
- 10k SKUs @ 2h => 120k checks/day
- 100k SKUs @ 30min => 4.8M checks/day
Request count = logical checks divided by API batch size (if batch permitted), adjusted for retries and errors.
Monthly costs = compute + storage + backups + provider/API license + network + observability + notifications + AI tokens + engineering/ops + acquisition. Do not assert a supplier's quota or fee without verification.

## Testing and acceptance
- Contracts: provider adapters tested from fixtures without live credentials; negative and stale response tests.
- Data quality: SKU match collision, duplicate observations, changed currency, variant drift, timezones.
- Security: cross-tenant read/write isolation, SSRF, secret leakage, OAuth revoke, affiliate redirect allowlist, audit.
- Reliability: 429 handling, rate limit, queue retries, dead letter, replay, idempotency.
- E2E: paste link to watchlist to simulated observation to alert to affiliate redirect.
- Performance gates are measured against agreed load and cost envelope, not invented SLA.

## First Codex work order
1. Inspect repository, tech constraints, existing CI and code.
2. Draft architecture package and make explicit source capability assumptions.
3. Deliver ADR proposals (not approved), MVP scope, phase backlog and key sequence diagrams.
4. Report a recommended thin E2E slice with acceptance criteria, dependencies and risks.
5. Stop before real connector implementation or production deployment until API authorization is confirmed.
