# 01 · Giả định, câu hỏi và risk register

## Đã xác nhận
Repo public `ngoclp2000/mmo` chưa có commit tại thời điểm audit 2026-11-16; hai file Markdown là nguồn yêu cầu tham chiếu. Không có code, CI, runtime hay schema hiện hữu để tương thích.

## Chưa xác nhận
Thị trường VN, niche sản phẩm, tenant/workspace semantics, ngân sách/tháng, tải ban đầu, thời gian freshness, mục tiêu KPI, loại tài khoản Shopee/TikTok và quyền lưu trữ/redistribution. Stack trong tài liệu là preference, chưa phải ADR được duyệt.

## Quyết định cần chủ repo
- Duyệt mock E2E ở tài liệu 08 và domain boundaries ở 03.
- Chọn niche và phạm vi địa lý; chốt tenant là workspace và một người có thể thuộc nhiều tenant.
- Chốt quy tắc giá: observed/listed tách estimated payable; lịch sử từ lần quan sát hợp lệ đầu tiên.
- Chốt success criteria và cost envelope trước benchmark có tính cam kết.
- Trước real connector: cung cấp bằng chứng quyền API và điều khoản; không gửi secret qua issue/commit.

## Checklist xác minh mỗi provider
Lưu official URL và ngày kiểm tra, app registration, territory, account holder, OAuth scope thực tế, endpoints/fields/SKU semantics, pagination/batch, quota và 429, storage/retention, redistribution, disclosure, price/voucher eligibility, reporting/attribution, webhook, revoke/deletion. Mỗi mục cần người kiểm tra và bằng chứng; thiếu → unverified/disabled.

| Rủi ro | Tác động | Giảm thiểu / điều kiện mở |
|---|---|---|
| Không được cấp API phù hợp | Chặn nguồn thật | Mock trước; chỉ chọn nguồn có bằng chứng |
| Sai SKU/điều kiện voucher | Cảnh báo sai | Exact SKU, so sánh cùng điều kiện, confidence |
| Rò rỉ tenant/token | Lộ dữ liệu | Deny-default, scoped queries, secret references, isolation tests |
| SSRF/open redirect | Truy cập nội bộ, phishing | Allowlist, không fetch trong slice 1, validation trước mỗi hop khi bổ sung resolver |
| Quota/chi phí vượt tải | Đồng bộ trễ | Provider budget, back-pressure, đo trước nâng cấp |
| Dữ liệu hết quyền lưu | Vi phạm retention | Policy registry, purge cả backups theo chính sách |

Owner xử lý rủi ro là vai trò Product/Engineering/Security; chưa gán cá nhân vì chưa có thông tin nhóm. Tất cả rủi ro đang OPEN.
