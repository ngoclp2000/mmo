# 09 · ADR index

Các ADR kiến trúc vẫn **PROPOSED**, trừ lựa chọn Node.js/TypeScript được chủ repo cho phép trực tiếp ngày 2026-11-16. Chủ repo đã yêu cầu triển khai slice đầu; không suy ra phê duyệt connector thật hoặc production.

| ADR | Đề xuất / lý do | Alternative và trade-off | Migration path | Security / cost |
|---|---|---|---|---|
| 001 | Modular monolith + worker: ít deploy units | Microservices độc lập nhưng tốn distributed ops | Tách module theo contracts/outbox | Fewer trust boundaries; lower baseline ops |
| 002 | Vue 3/TS/Vite: preference, client dashboard | Nuxt SEO/SSR nhưng thêm server runtime | SSR public pages khi có nhu cầu đo được | Escape untrusted content; static hosting nhỏ |
| 003 · ACCEPTED | Node.js 24 LTS + TypeScript/Fastify cho API và worker: chủ repo cho phép Node; dùng chung domain/DTO với một runtime | ASP.NET Core là preference gốc; dùng cả hai sẽ tăng build/deploy và contract overhead | Giữ REST/OpenAPI và SQL schema; có thể thay runtime theo từng module khi có lý do thực tế | Scrypt + server-side session, patch dependencies; một runtime giảm công vận hành, không khẳng định tiết kiệm theo giá chưa đo |
| 004 | MySQL system of record, bounded snapshots | ClickHouse tốt analytical scans nhưng thêm pipeline | Outbox projection, backfill/checksum/rollback | Tenant FK, encrypted backup; retention controls cost |
| 005 | MySQL outbox/inbox + worker scheduler | Broker giúp throughput/replay nhưng thêm ops | Publish outbox sang broker khi benchmark cần | At-least-once + dedupe; no exactly-once claim |
| 006 | Tenant_id + membership/policy + composite FK | DB-per-tenant isolation mạnh, cost/migration lớn | Dedicated DB cho tenant có yêu cầu | Cross-tenant tests bắt buộc; economical shared DB |
| 007 | Capability-first, mock-first connectors | Code real connector sớm dễ đoán sai scopes | Bật từng capability sau evidence review | Unknown quyền → disabled; không phát sinh phí API thật |
| 008 | Inbox demo, opt-in và allowlisted demo affiliate | Email/Telegram thật cần consent và credentials | Adapter delivery sau approval/test | Giảm spam và token exposure; phí demo local nhỏ |

Trước accept: ghi owner, ngày, scope, bằng chứng và hệ quả đã đánh giá. Không tự đổi status vì code được merge. Phiên bản runtime, MySQL/Redis licensing và chi phí nhà cung cấp cần kiểm tra tại implementation time.
