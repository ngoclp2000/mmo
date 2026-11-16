# 05 · Data architecture

PROPOSED. MySQL là system of record; Redis không giữ bản duy nhất của job, price hoặc consent.

## Khóa và quan hệ
`tenants(id)` → `memberships(tenant_id,user_id,role)`; `connector_accounts(tenant_id,id,provider,secret_ref,policy_version)`; `source_listings(tenant_id,id,provider,external_id)` → `source_skus(tenant_id,id,listing_id,external_sku)`; `watchlists(tenant_id,id,user_id,sku_id)` → `watchlist_rules`; `price_observations(tenant_id,id,sku_id,observed_at,amount,currency,region,shipping_basis,voucher_basis,source_event_id,policy_version)` → `price_baselines`, `deal_scores`; `alerts` → `notification_deliveries`; `affiliate_links` → `outbound_clicks`. Conversion/commission chỉ tạo từ authorized report về sau.

Tenant-owned parent/child dùng composite FK `(tenant_id,id)` để chặn cross-tenant reference. Identity được resolve từ session, không tin tenant_id từ request body. Global query filters cộng explicit policy checks, negative integration tests; raw SQL phải bind tenant.

## Index và tính đúng
- Unique membership `(tenant_id,user_id)`, source SKU `(tenant_id,provider,external_sku)` với định danh đủ namespace listing/account nếu provider chỉ unique trong listing.
- Price history `(tenant_id,sku_id,observed_at,id)`; dedupe `(tenant_id,provider,source_event_id)` hoặc stable adapter observation key.
- Rule `(tenant_id,sku_id,enabled)`; alert unique `(tenant_id,rule_id,price_state_key)`.
- Jobs `(status,available_at,id)`, outbox `(published_at,available_at,id)` và inbox unique `(consumer,event_id)`.
- Money DECIMAL với currency; UTC DATETIME(6); không dùng float cho tiền. Lưu observedAt và receivedAt riêng; reject future/out-of-order effects với policy rõ.

## Snapshot, baseline, retention
Append-only observations; baseline chỉ so cùng SKU/currency/region/shipping/voucher assumptions và thời gian đủ dữ liệu. Thiếu baseline → score unavailable. FreshnessTTL là rule/config được chốt, chưa có con số production.

Bắt đầu index + bounded retention purge theo batch. Chưa partition ngay: MySQL partitioning có hạn chế FK và unique key phải chứa partition key; benchmark và ADR riêng trước migration. Policy retentionDays phải được xác minh; không hiểu unknown là giữ vô hạn. Fixtures local có thể reset thủ công, real ingestion bị chặn nếu quyền lưu chưa rõ.

Backup đề xuất encrypted snapshot + binlog PITR; RPO/RTO và tần suất chờ ngân sách. Restore drill phải chạy trước production. Xóa dữ liệu có audit và backup expiry documented, không hứa xóa tức thì mọi backup.

ClickHouse chỉ là projection khi benchmark MySQL không đạt envelope đã duyệt. Backfill bằng watermark và eventId, replay idempotent, kiểm tra counts/checksums, dual-read so kết quả; cutover feature flag, rollback về MySQL. Không dual-write không transaction.
