# 02 · Ma trận năng lực nguồn

Không có official documentation hay granted scopes được kiểm chứng trong đợt setup. Bảng dưới không khẳng định API tồn tại hoặc được cấp.

| Capability | Shopee | TikTok Shop | Mock fixture |
|---|---|---|---|
| Listing và SKU lookup | UNVERIFIED | UNVERIFIED | AVAILABLE, synthetic |
| Giá listed theo SKU | UNVERIFIED | UNVERIFIED | AVAILABLE, synthetic |
| Checkout/voucher cá nhân/shipping | UNVERIFIED | UNVERIFIED | UNAVAILABLE |
| Tìm kiếm toàn sàn/flash sale | UNVERIFIED | UNVERIFIED | UNAVAILABLE |
| Affiliate offer/link | UNVERIFIED | UNVERIFIED | DEMO only |
| Conversion/commission report | UNVERIFIED | UNVERIFIED | UNAVAILABLE |
| Seller/creator metrics | UNVERIFIED | UNVERIFIED | UNAVAILABLE |
| OAuth/refresh/revoke/webhook | UNVERIFIED | UNVERIFIED | Không có OAuth thật |
| Quota, batch, phí, territory | UNVERIFIED | UNVERIFIED | Local configurable test limits |
| Retention/redistribution | UNVERIFIED | UNVERIFIED | Chỉ fixture do dự án tạo |

Registry đề xuất: provider, accountRef, capability, field, territory, grantedScopes, authorizationHolder, consentAt, policyVersion, evidenceUrl, checkedAt, quotaWindow, quotaLimit, batchSize, freshnessTTL, retentionDays, redistributionAllowed, status. Giá trị thiếu là unknown, không dùng true hoặc unlimited mặc định.

`available` chỉ khi capability, account consent và policy còn hiệu lực. `unavailable` khi nguồn không cung cấp; `unverified` khi chưa có bằng chứng; `estimate` chỉ cho trường tính toán có giả định; `stale` khi vượt freshnessTTL. Các trạng thái không thay thế provenance và timestamps.

Real adapter bị tắt nếu thiếu một điều kiện authorization/terms bắt buộc. Seller scopes và affiliate scopes không hoán đổi. Cập nhật bảng bằng bằng chứng riêng cho từng account và trường dữ liệu trước tích hợp.
