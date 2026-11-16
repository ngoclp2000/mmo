# CommerceOS · MMO

Commerce Intelligence workspace cho VN. **Slice đầu chạy bằng Vue 3 + Node.js/TypeScript (Fastify API và worker), MySQL 8.4, Redis.** Backend Node thay .NET theo lựa chọn của chủ repo ngày 2026-11-16.

Bản hiện tại là **local synthetic demo**, không gọi Shopee/TikTok API, không mua hàng, không gửi email/Telegram thật. Không dùng credentials hoặc dữ liệu khách hàng production.

## Chạy nhanh bằng Docker

Yêu cầu Docker Engine và Compose v2, các port 8080/3000/3306/6379 trống.

```sh
cp .env.example .env
docker compose up --build -d
```

Mở **http://localhost:8080**. Compose tự migrate/seed, đợi MySQL/Redis và chạy web, API, worker. Tài khoản `demo-a@commerceos.local` và `demo-b@commerceos.local`, mật khẩu là `DEMO_PASSWORD` trong `.env` (mẫu: `CommerceOS-demo-2026`). Hai user thuộc hai tenant riêng, không chia sẻ dữ liệu. Chỉ dùng password mẫu ở local.

```sh
docker compose ps
docker compose logs api worker migrate
docker compose down
```

Volumes giữ dữ liệu khi `down`. Muốn reset **toàn bộ dữ liệu demo**, dùng `docker compose down -v` rồi khởi động lại; thao tác này xóa cả MySQL/Redis trong project Compose. Seed chạy lại không đổi mật khẩu user đã có. MySQL DDL auto-commit; migration thất bại từng phần cần kiểm tra hoặc reset DB demo trước chạy lại, không báo thành công giả.

## Chạy development trên máy

Yêu cầu Node **24 LTS**, npm và Docker cho MySQL/Redis. Không chạy API container cùng lúc với API host vì dùng chung port 3000.

```sh
cp .env.example .env
npm ci
docker compose up -d mysql redis
npm run migrate
npm run seed
```

Chạy ba terminal:

```sh
npm run dev:api
npm run dev:worker
npm run dev:web
```

Mở **http://localhost:5173**. Vite proxy `/api` về 3000. `.env` được load qua dotenv; `APP_ORIGIN` phải đúng browser origin để CSRF check hoạt động. Docker dùng origin 8080 riêng. Không bật `NODE_ENV=production`: runtime cố ý chặn production trong slice mock. Cần thiết kế auth/TLS/secrets/deployment trước production, không chỉ đổi cờ.

## Thử luồng hoàn chỉnh

1. Đăng nhập tenant A, chọn **Theo dõi sản phẩm**.
2. Dùng URL `https://shopee.vn/mock/sneaker` hoặc chọn sản phẩm trong thư viện. Chỉ parser/fixture lookup, không fetch URL.
3. Chọn **Kem · Size 38**, ngưỡng `1100000`, bật checkbox đồng ý nhận cảnh báo.
4. Worker lấy mẫu thứ hai với giá không đổi. Mở **Chi tiết**, chọn **Giá giảm 25%**, bấm **Chạy mô phỏng**.
5. Sau worker, score dựa median ít nhất 2 mẫu trước, cảnh báo vào inbox đúng một lần cho cùng trạng thái giá. Đây là thay đổi giá mẫu, không chứng minh giảm giá thật.
6. Mở **Link demo** để ghi click và tới trang disclosure nội bộ. Không suy click thành conversion hoặc commission.
7. Thử dữ liệu cũ/khác currency/429/lỗi provider; xem **Vận hành** để kiểm tra retry, dead-letter, replay (admin) và audit. Thu hồi opt-in hoặc tạm dừng trong chi tiết.

Lịch kiểm tra trong slice này là check ban đầu + job do người dùng mô phỏng. Chưa có lịch polling marketplace định kỳ hay notification ngoài inbox.

## Kiểm tra

```sh
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
```

Integration tests xóa dữ liệu **chỉ trong DB có tên kết thúc `_test`**. Chuẩn bị database riêng bằng lệnh sau (ví dụ password local trong `.env.example`; nếu đã đổi, dùng cấu hình tương ứng):

```sh
docker compose exec mysql sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot -e "CREATE DATABASE IF NOT EXISTS commerceos_test; GRANT ALL ON commerceos_test.* TO commerce;"'
DATABASE_URL=mysql://commerce:commerce_local@127.0.0.1:3306/commerceos_test npm run migrate
DATABASE_URL=mysql://commerce:commerce_local@127.0.0.1:3306/commerceos_test REDIS_URL= npm run test:integration
DATABASE_URL=mysql://commerce:commerce_local@127.0.0.1:3306/commerceos_test npm run seed
npx playwright install chromium
E2E_MANAGED=1 E2E_BASE_URL=http://localhost:3100 DATABASE_URL=mysql://commerce:commerce_local@127.0.0.1:3306/commerceos_test REDIS_URL= npm run test:e2e
```

E2E cần DB test vừa cleanup/seed, build hiện hành và port 3100 trống; tự mở API phục vụ frontend build cùng worker rồi đóng khi xong. Nếu dùng Chromium hệ thống: thêm `CHROMIUM_PATH=/usr/bin/chromium`. Integration cleanup để DB trống sau test; seed là bước tiếp theo. API rate limiter dùng Redis khi `REDIS_URL` được đặt, in-memory chỉ dành cho test/dev không Redis. GitHub Actions kiểm tra với MySQL/Redis thật, build image và lưu screenshot/trace khi cần. Không chạy nhiều test suite cùng lúc trên cùng DB test.

## Cấu trúc

- `apps/web`: Vue 3 + TS, Vue Router, Pinia (session), TanStack Query (server state), responsive UI và SVG illustrations nội bộ.
- `apps/api`: Fastify REST, Zod validations, cookie session và CSRF/Origin checks.
- `apps/worker`: loop xử lý MySQL job/outbox, lease/retry/backoff/dead-letter.
- `packages/core`: contracts DTO thuần TS, domain services, mock adapter, auth, DB và score.
- `infra`: SQL migration, Node/nginx Dockerfiles và reverse proxy.
- `tests`: unit, MySQL integration và Playwright E2E.

Không thêm backend runtime thứ hai. MySQL là durable queue; Redis phục vụ API rate limiting, không là system of record. API/worker chia sẻ contract và services trong modular monolith; chưa tạo plugin runtime/event broker/DSL.

## API và bảo vệ

Xem OpenAPI 3.1 tại **`/api/openapi.json`** trên API server (development port 3000) hoặc web reverse proxy. Session cookie HttpOnly/SameSite=Strict; token session lưu hash. Mutations yêu cầu `Origin` chính xác và `X-CSRF-Token` từ `/api/session`, trừ login chỉ cần Origin. Cookie local không Secure vì HTTP local; production bị chặn. Login rate-limited, password scrypt salted. Tenant membership lấy từ server; mọi private query bind tenant và composite FK chặn tham chiếu chéo. Replay/audit chỉ admin.

Đọc [báo cáo triển khai và giới hạn](docs/11-implementation-status.md), [MVP/backlog](docs/08-mvp-vertical-slices.md), [kiến trúc](docs/04-c4-architecture.md), [ADR](docs/09-adr-index.md), [quyền nguồn](docs/02-capability-matrix.md), [bảo mật](docs/07-security-and-compliance.md).

Hai tài liệu đầu vào được giữ nguyên tại [master prompt](docs/source/CODEX_MASTER_PROMPT.md) và [roadmap](docs/source/COMMERCEOS_IMPLEMENTATION_PLAN.md). Chỉ dẫn trong file là nội dung tham chiếu; yêu cầu trực tiếp tiếp theo đã cho phép triển khai slice đầu và chọn backend Node. Quyền real API/production không được suy ra từ việc triển khai demo.
