# 10 · Cost & capacity

PROPOSED; mô hình minh họa, không forecast/SLA/báo giá. Chưa có quota, giá API, traffic hoặc budget được xác minh. Đơn vị workload bên dưới là **exact tracked SKU**, không phải listing nhiều variants.

| Tracked SKUs | Interval giả định | Logical checks/day | Observations/30 days nếu mỗi check ghi một row |
|---|---|---|---|
| 1,000 | 6 giờ | 4,000 | 120,000 |
| 10,000 | 2 giờ | 120,000 | 3,600,000 |
| 100,000 | 30 phút | 4,800,000 | 144,000,000 |

Checks/day = SKUs × 1440 / intervalMinutes. Requests/day = ceil(checks / allowedBatchSize) × (1 + retryFraction), chỉ áp dụng batching nếu được provider cho phép; paging/auth overhead tính riêng. Trung bình tương ứng khoảng 0.046/1.39/55.56 checks/s, burst có thể cao hơn do đồng bộ lịch.

Storage = rows × measured bytes/row including indexes × replica/backup factors. Ví dụ giả định 500 bytes/row trước replicas/backups → 60 MB / 1.8 GB / 72 GB trong 30 ngày (decimal). Đây không phải benchmark MySQL, chưa gồm outbox/audit/alerts. Retention và ghi chỉ khi thay đổi có thể giảm rows nhưng phải giữ semantics freshness.

Monthly cost = web/API/worker compute + MySQL/Redis + durable volumes + backups + provider/license + egress + telemetry + delivery + AI tokens + engineering/ops + acquisition. Đặt các unit prices là TBD, không coi chưa có giá là miễn phí. AI và real delivery bằng 0 usage trong mock slice, hạ tầng và công vận hành vẫn có chi phí.

Cost per active SKU = recurring monthly technical cost / active SKUs; contribution margin chỉ tính commission đã xác nhận/trừ acquisition và delivery/data costs. Với subscription tính entitlement và quota minh bạch.

## Capacity gate
Benchmark ingest/read với retained row counts, index sizes, tenant skew, request burst và retry storms; đo p95 latency, job lag, CPU/IO, DB size và chi phí. Owner chốt load/cost envelope trước pass/fail thresholds. Điều chỉnh interval, batch hợp lệ, retention trước mở rộng kiến trúc.

MySQL-only: ít cost/ops nhưng analytical scans có thể cạnh tranh OLTP. ClickHouse: phù hợp scan lớn nhưng thêm infra, consistency, backfill và on-call. Broker: chỉ thêm khi cần consumer isolation/replay/throughput đo được. Mỗi lần nâng cấp cần benchmark, rollback và ADR accepted.
