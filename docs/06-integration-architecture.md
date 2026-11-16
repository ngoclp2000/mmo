# 06 · Integration architecture

PROPOSED. Mock là adapter duy nhất được phép ở slice đầu.

## Contract đề xuất
`GetCapabilities(accountContext)`; `ResolveListing(validatedSourceId)`; `ObserveSku(exactSkuId, observationContext)`; `GenerateAffiliateLink(eligibleOffer)` khi capability tồn tại. Kết quả typed union: Available(value, provenance), Unavailable(reason), Unverified(missingEvidence), RateLimited(retryAfter), Revoked. Không trả số 0 thay dữ liệu thiếu.

Provenance gồm provider, account reference, field, observedAt, receivedAt, territory, policyVersion, consent reference và synthetic flag. Không kèm credential trong DTO/event/log.

## Luồng quyền thật — future
Admin cấp consent → server xác minh callback state/PKCE nếu provider hỗ trợ/yêu cầu → secret manager giữ token → registry ghi actual granted scopes → mỗi job kiểm tra scope/policy còn hiệu lực → refresh single-flight → revoke ngừng job và áp dụng deletion policy. Chưa chọn endpoint/schema vì chưa xác minh docs.

## Reliability
Transaction domain ghi outbox cùng lúc; worker claim bằng lease có expiry, phát at-least-once. Consumer lưu inbox/eventId cùng transaction với side effect nội bộ. Với external delivery dùng provider idempotency key nếu có; nếu không, ghi trạng thái ambiguous và reconcile, không hứa exactly-once.

Quota theo provider/account/window, tôn trọng Retry-After; exponential backoff có jitter và bounded attempts; hết lần → dead-letter, admin replay theo eventId. Limits là config test trong mock, không giả mạo quota thật. Back-pressure ưu tiên watchlist active; schedule không vượt budget.

## URL resolver
Slice đầu chỉ parse URI cục bộ: HTTPS, hostname exact allowlist đề xuất `shopee.vn`, `www.shopee.vn`, `shop.tiktok.com`; danh sách này chưa chứng minh URL product/API khả dụng. Fixture resolver map URL tổng hợp tới fixture IDs; không HTTP fetch, không mở short link. Reject userinfo, IP literals, port lạ, host suffix giả, input quá dài. Sau này nếu cần fetch: kiểm DNS/IP public cả IPv4/IPv6 và mỗi redirect, chặn private/link-local/metadata, limit hops/time/body và network egress policy để chống DNS rebinding.

## Contract tests khi coding
Missing SKU, variant drift, changed currency, stale/unverified field, duplicate event, 429, revoke, expired policy, malformed URL, secret redaction, dead-letter/replay. Chỉ fixtures do dự án tạo, không private user data hay production purchase.
