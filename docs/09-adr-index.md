# 09 · ADR index

Tất cả trạng thái **PROPOSED**; chưa ADR nào được chủ repo phê duyệt.

| ADR | Đề xuất / lý do | Alternative và trade-off | Migration path | Security / cost |
|---|---|---|---|---|
| 001 | Modular monolith + worker: ít deploy units | Microservices độc lập nhưng tốn distributed ops | Tách module theo contracts/outbox | Fewer trust boundaries; lower baseline ops |
| 002 | Vue 3/TS/Vite: preference, client dashboard | Nuxt SEO/SSR nhưng thêm server runtime | SSR public pages khi có nhu cầu đo được | Escape untrusted content; static hosting nhỏ |
| 003 | ASP.NET Core LTS: type-safe domain, một backend | Node có ecosystem integrations nhưng thêm runtime nếu dùng song song | Adapter riêng chỉ khi có lý do cụ thể | Patch LTS; kiểm support version khi coding |
| 004 | MySQL system of record, bounded snapshots | ClickHouse tốt analytical scans nhưng thêm pipeline | Outbox projection, backfill/checksum/rollback | Tenant FK, encrypted backup; retention controls cost |
| 005 | MySQL outbox/inbox + worker scheduler | Broker giúp throughput/replay nhưng thêm ops | Publish outbox sang broker khi benchmark cần | At-least-once + dedupe; no exactly-once claim |
| 006 | Tenant_id + membership/policy + composite FK | DB-per-tenant isolation mạnh, cost/migration lớn | Dedicated DB cho tenant có yêu cầu | Cross-tenant tests bắt buộc; economical shared DB |
| 007 | Capability-first, mock-first connectors | Code real connector sớm dễ đoán sai scopes | Bật từng capability sau evidence review | Unknown quyền → disabled; không phát sinh phí API thật |
| 008 | Inbox demo, opt-in và allowlisted demo affiliate | Email/Telegram thật cần consent và credentials | Adapter delivery sau approval/test | Giảm spam và token exposure; phí demo local nhỏ |

Trước accept: ghi owner, ngày, scope, bằng chứng và hệ quả đã đánh giá. Không tự đổi status vì code được merge. Phiên bản runtime, MySQL/Redis licensing và chi phí nhà cung cấp cần kiểm tra tại implementation time.
