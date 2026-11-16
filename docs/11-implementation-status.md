# 11 · Implementation status — mock vertical slice

Ngày 2026-11-16. Chủ repo yêu cầu triển khai theo master prompt và cho phép họ Node.js thay .NET. Phạm vi đã thực hiện là foundation + thin E2E mock, không phải toàn bộ roadmap.

## Các thay đổi

- Vue 3/TS responsive UI: login, workspace overview, URL/SKU selection, watchlist/search, history chart, explainable score, opt-in toggle, pause/resume, inbox alerts, demo affiliate destination, jobs/dead-letter replay và audit admin.
- Node 24 LTS/Fastify REST API, Zod input validations, OpenAPI 3.1 endpoint, pure TS DTO shared với frontend. Chọn CSS/SVG tự xây thay component suite lớn cho 6 màn hình nhỏ; trade-off là tự duy trì accessibility/style, không có thêm UI dependency.
- Scrypt salted password, random server-side sessions (hash token trong DB), HttpOnly/SameSite strict cookie, CSRF token/Origin, tenant authorization, admin permissions, login/API rate limits. Hai seed user thuộc hai workspace riêng.
- MySQL migrations có checksum và lock; initial observation, baseline 7 ngày/min 2 previous samples, freshness 6 giờ; decimal money/UTC. Các con số này là defaults demo, không SLA/API policy.
- Transactional outbox/inbox; MySQL job claim `FOR UPDATE SKIP LOCKED`, lease token/expiry, bounded retries/backoff/jitter, 429 simulation, dead-letter và admin replay. Observation uniqueness theo job/source key, alert uniqueness theo exact price state; worker kiểm opt-out lại lúc giao inbox.
- Demo click request idempotency, server-fixed local destination, không conversion/commission. Synthetic labels và quyền Shopee/TikTok `unverified` hiển thị rõ.
- Docker Compose cho web/API/worker/MySQL/Redis, nginx reverse proxy, health checks, npm lockfile, ESLint/Prettier/typecheck, unit/integration/browser tests và GitHub Actions.

## Rationale và trade-offs

Một TypeScript backend/runtime dùng chung services giúp slice nhỏ dễ chạy và review. REST/OpenAPI và MySQL làm ranh giới để thay runtime sau này. Worker là process riêng; không có custom DSL, Kafka hoặc generalized plugin runtime. MySQL durable queue giảm số dịch vụ nhưng cạnh tranh IO với API nếu scale; đo trước tách broker. Redis hiện chỉ bảo vệ API request budget, không giữ observation/job nguồn chân lý. Fixture provider không dùng API quota hay OAuth.

Identity là local-demo implementation, không OIDC production. Không endpoint đăng ký/reset password/mời thành viên; không dùng demo identity cho production. Module boundaries ở code/services và bảng sở hữu; chưa tuyên bố hoàn thành mọi DDD context trong roadmap.

## Acceptance coverage

- Unit: exact fixture resolution, SSRF-style URL rejection (không fetch), baseline contextual comparison, freshness/future time, insufficient sample, score clamp và password salting.
- MySQL integration: unauthenticated/CSRF/origin checks, cross-tenant read/write denial, FK-safe tracking, transaction/outbox E2E, duplicate job/replay stability, one alert per price state, click idempotency, stale/currency no-alert, opt-out trước delivery, 429 retry, exhausted retries/replay RBAC, expired lease/reclaim, login throttling và session revocation.
- Playwright: login → invalid URL → exact SKU → tracking → second observation → drop → score → delivered inbox → demo click → additional cards → desktop/mobile screenshots → operations → logout. Kiểm tra không overflow ngang tại viewport 390px và không có JS runtime errors.

Kết quả chạy thực tế và screenshot được ghi trong PR/CI; không coi test file hoặc workflow config tự nó là bằng chứng đã pass trên GitHub. Screenshot do E2E tạo ở `test-results/screenshots/`, bản review được lưu dưới `docs/screenshots/` nếu có.

## Known limitations / scope còn lại

- Chỉ 3 synthetic listings; không real catalog ingestion, canonical matching hoặc verified checkout price. URL ngoài exact fixture bị từ chối, shortlinks không được mở.
- Worker chạy check ban đầu và scenario thủ công, chưa scheduler định kỳ/adaptive quota. Không gọi external API, chưa OAuth/refresh/revoke lifecycle thật hoặc full capability registry.
- Inbox được lưu MySQL trong transaction; semantics này không chứng minh exactly-once delivery cho email/Telegram bên ngoài. Retry có thể tạo trạng thái ambiguous khi tích hợp provider thật; cần reconciliation.
- Chưa automated backup job/restore drill, production secret management, telemetry exporter, penetration test hay load benchmark. Heartbeat/readiness + structured API logs là mức local cơ bản.
- Chưa pricing/billing entitlements, AI, seller metrics, commission reporting hoặc marketplace coverage. Không coi click là conversion.
- Không có final cost estimate/SLA; local mock không phát sinh phí API/AI/delivery thật, vẫn cần compute/storage/engineering. Model 10 giữ đơn giá TBD.
- Migration 001 là initial DDL auto-commit; không tự rollback schema khi crash nửa chừng. Không sửa migration đã applied; thêm migration mới khi đổi schema.
- API `healthz` query DB/Redis, worker heartbeat xác nhận loop; chưa giám sát toàn bộ SLO hoặc event lag production.

## Next slice đề xuất

Hardening local operations: periodic mock schedule có budget, restore drill, retention purge, pagination/tenant load benchmarks và review auth deployment. Connector thật chỉ bắt đầu sau evidence scopes/account/terms/retention/redistribution được xác minh cho đúng provider/territory. Không đoán endpoints/quotas/phí.

## Verification thực tế ngày 2026-11-16
- `npm run lint`, `npm run typecheck`, `npm run build`: pass.
- `npm test`: 7/7 unit tests pass.
- Integration: 5/5 nhóm kiểm thử pass trên MySQL 8.4 và Redis thật (namespace riêng), có chạy lại sau sửa lỗi.
- Playwright Chromium: 1/1 E2E pass trên frontend build với API/worker tách process; desktop 1440px và mobile 390px. Screenshot đã kiểm tra trực quan; điều chỉnh hero mobile để không che chữ.
- `npm audit --omit=dev`: 0 vulnerabilities sau nâng `@fastify/static` lên bản vá.
- Docker backend và web build đã chạy được bằng session CA secret (môi trường cloud có TLS proxy). Bản Dockerfile trong repo giữ trust mặc định cho máy thường/CI, không chứa CA hoặc tắt TLS verification. Trạng thái Compose cuối cùng xem PR.

Full `docker compose up` chưa được xác nhận trong cloud này: storage driver VFS và ổ 7.9 GB hết dung lượng khi tạo container migration, dù cả hai image build thành công. Đã dọn các image/cache trung gian của phiên để trả lại dung lượng; không xóa volume MySQL/Redis. API/worker build đã được kiểm chứng bằng process Node với MySQL/Redis Docker thật. Cần smoke-test toàn bộ Compose trên runner/máy đủ dung lượng trước khi coi full-stack container runtime là verified.
