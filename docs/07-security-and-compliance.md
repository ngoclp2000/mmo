# 07 · Security & compliance

PROPOSED threat model; chưa phải đánh giá pháp lý hay kết quả pentest.

| Trust boundary / threat | Control | Kiểm chứng yêu cầu khi triển khai |
|---|---|---|
| Browser → API: tenant spoof/IDOR | Session identity, membership check, deny default, composite FK | Tenant A không đọc/ghi/watch SKU-private của B |
| URL → resolver: SSRF | No network in mock; allowlist; egress/DNS/redirect validation khi fetch | localhost, metadata, IPv6, rebinding, userinfo, suffix-host |
| Provider → UI: XSS/prompt injection | Treat text as untrusted, escape HTML, không thực thi chỉ dẫn nguồn | Payload HTML/script không chạy |
| Token store → worker: secret leakage | Secret reference, encrypted at rest, least privilege, redacted logs | Scan logs và revoke scenario |
| Link redirect → destination | Server-side trusted mapping, HTTPS allowlist, parameter minimization | Reject arbitrary next/url và expired links |
| Queue → delivery: duplicate/spam | Opt-in, recheck opt-out tại send, idempotency, rate cap | Retry không gửi lặp chủ ý; ambiguous delivery có reconciliation |
| Admin → audit/deletion | Audited access, append-only records, retention policy | Audit không chứa token/PII thừa; deletion drill |

Authentication proposal: standards-based OIDC hoặc framework identity đã kiểm tra; không tự chế token. Cookie session HttpOnly/Secure/SameSite theo topology, CSRF protection cho state-changing endpoints; CORS explicit origin, request size/rate limits. Local dev identity nếu có phải chặn ngoài Development.

Public catalog và private integration/commission có policy riêng; ban đầu fixtures private theo tenant. Không expose email/membership hay analytics tenant khác qua public projection.

Affiliate disclosure phải hiển thị; synthetic demo luôn có nhãn, demo click không tạo commission. Quyền lưu/redistribute cần evidence theo field/account. Unknown policy chặn real ingestion. Legal/privacy review VN và thị trường thực tế trước production, không coi robots.txt là giấy phép dữ liệu.

CI dự kiến secret scanning, dependency review, unit/integration/E2E phù hợp; rotate nếu lộ secret. Không đưa token vào issue, fixture hay source. AI/seller/publishing chưa bật và không thuộc kiểm chứng slice 1.
