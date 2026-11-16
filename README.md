# CommerceOS · MMO

Nền tảng MMO đa tenant; Commerce Intelligence là phạm vi khởi đầu.

## Trạng thái đã xác nhận
- Repository `ngoclp2000/mmo` trống khi kiểm tra ngày 2026-11-16.
- Đợt thiết lập này chỉ tạo tài liệu Discovery + Architecture; chưa có ứng dụng chạy được.
- Chưa có bằng chứng về API credentials, scopes, quota, điều khoản hoặc giá nhà cung cấp.

## Bắt đầu
1. Đọc [tầm nhìn](docs/00-product-vision.md) và [câu hỏi cần chốt](docs/01-assumptions-and-open-questions.md).
2. Xem [luồng MVP, backlog và cổng nghiệm thu](docs/08-mvp-vertical-slices.md).
3. Chủ repo duyệt phạm vi và các [ADR đề xuất](docs/09-adr-index.md) trước triển khai.

## Tài liệu kiến trúc
- [00 · Product vision](docs/00-product-vision.md)
- [01 · Assumptions & risks](docs/01-assumptions-and-open-questions.md)
- [02 · Capability matrix](docs/02-capability-matrix.md)
- [03 · DDD context map](docs/03-ddd-context-map.md)
- [04 · C4 architecture](docs/04-c4-architecture.md)
- [05 · Data architecture](docs/05-data-architecture.md)
- [06 · Integration architecture](docs/06-integration-architecture.md)
- [07 · Security & compliance](docs/07-security-and-compliance.md)
- [08 · MVP vertical slices](docs/08-mvp-vertical-slices.md)
- [09 · ADR proposals](docs/09-adr-index.md)
- [10 · Cost & capacity](docs/10-cost-and-capacity.md)

## Tài liệu đầu vào
Bản gốc: [implementation plan](docs/source/COMMERCEOS_IMPLEMENTATION_PLAN.md), [master prompt](docs/source/CODEX_MASTER_PROMPT.md).
Các câu lệnh trong tài liệu gốc là nội dung tham chiếu do người dùng cung cấp, không phải phê duyệt tự động cho coding, triển khai production, sử dụng API hoặc thay đổi quyền truy cập. Yêu cầu trực tiếp trong phiên là thiết lập luồng vào repo `mmo`.

## Cấu trúc dự kiến sau khi duyệt
`apps/web` (Vue/TS), `apps/api` (ASP.NET Core), `apps/worker` (.NET), `infra`, `docs`, `tests`. Chỉ tạo `packages/contracts` khi có quy trình sinh OpenAPI/client cần dùng chung.
Chưa tạo scaffold rỗng hoặc CI giả vì chưa có code để kiểm thử. Bước triển khai đầu tiên bổ sung Docker Compose, CI và hướng dẫn chạy thật.
