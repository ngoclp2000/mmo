# 00 · Tầm nhìn sản phẩm

Trạng thái: PROPOSED. VN là thị trường mục tiêu theo tài liệu đầu vào, chưa được chủ repo xác nhận trong phiên này.

| Persona | Journey | Giá trị và giới hạn |
|---|---|---|
| Buyer | Gửi URL → chọn SKU → theo dõi → nhận cảnh báo đã opt-in | Giá quan sát có thời điểm; không cam kết giá checkout |
| Affiliate/creator | Chọn offer đủ điều kiện → tạo link → ghi nhận click → đối soát | Click không phải conversion; commission phải có báo cáo |
| Seller/agency | Cấp quyền tài khoản → xem metric được phép → quản trị nhóm | Giai đoạn sau; không suy diễn metric thiếu |

## MVP đề xuất
Một workspace, nhiều membership theo tenant; synthetic fixtures; một nguồn mock; chọn đúng SKU; lưu lịch sử từ lần quan sát đầu; score có giải thích; cảnh báo trong inbox thử nghiệm; ghi nhận outbound click demo. Không lấy dữ liệu marketplace thật.

## KPI đề xuất, chưa chốt ngưỡng
Tỷ lệ URL hợp lệ đi đến theo dõi SKU, tỷ lệ observation đủ mới, độ trễ cảnh báo theo lịch đã chọn, tỷ lệ gửi trùng, tỷ lệ reconciliation thành công khi có báo cáo. Đo với mẫu và khoảng thời gian rõ ràng. Không lấy click làm doanh thu.

## Doanh thu giả định
Subscription theo entitlement, affiliate commission đã đối soát, B2B reporting sau khi có quyền dữ liệu. Tính cả chi phí dữ liệu, vận hành và acquisition trước quyết định giá.

## Ngoài phạm vi
Scraping/cookie/CAPTCHA bypass, marketplace-wide coverage, giao dịch mua thật, AI tự đăng, ROI thiếu chi phí, seller analytics, Kafka/ClickHouse mặc định. Thành công mock chứng minh luồng kỹ thuật, không chứng minh khả thi API hay nhu cầu thị trường.
