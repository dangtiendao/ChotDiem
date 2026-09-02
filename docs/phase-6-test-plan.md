# KẾ HOẠCH KIỂM THỬ TOÀN DIỆN (PHASE 6 TEST PLAN)
## DỰ ÁN: WEB APP "CHỐT ĐIỂM"

- **Tên ứng dụng:** Chốt Điểm
- **Slogan:** *Chạm nhanh, tính chuẩn, vui trọn cuộc chơi.*
- **Phiên bản:** 6.0.0
- **Phạm vi kiểm thử:** Phase 6 - Kiểm thử Logic tính điểm, Toàn vẹn dữ liệu (Zero-Sum Invariant), Giao diện & Responsive, Xử lý đồng thời & Mạng (STALE_DATA, Idempotency, Optimistic Concurrency).
- **Trách nhiệm:** Senior QA Engineer & Apps Script Developer

---

## 1. MỤC TIÊU & PHẠM VI KIỂM THỬ

### 1.1. Phạm vi trong kế hoạch (In-Scope)
1. **Task 6.1: Kiểm thử Logic nghiệp vụ**:
   - Trận 2 người chơi (Thắng, Thua, Hòa).
   - Trận nhiều người chơi (Tổ hợp Thắng/Thua/Hòa, thứ tự khác nhau, tên có dấu tiếng Việt, tên hiển thị giống nhau khác ID).
   - Trường hợp biên: Tất cả cùng thắng, tất cả cùng thua, tất cả cùng hòa.
   - Mức cược riêng từng người, cược 0, từ chối cược âm, cược số thực, `NaN`, chuỗi rỗng.
   - Vòng đời: Đổi người cầm đầu (A), thêm người giữa phiên, cho nghỉ chơi (soft deactivate).
   - Quản lý ván: Sửa ván cũ, Hủy ván cũ, Khôi phục ván và Hoàn tác nhanh (Quick Undo).

2. **Task 6.2: Kiểm thử Tính toàn vẹn dữ liệu**:
   - Bất biến Zero-Sum: $\Delta_A + \sum \Delta_{opp} = 0$ cho mọi ván và tổng điểm toàn phiên luôn triệt tiêu về 0.
   - Đối soát độc lập: Quét toàn bộ ván có hiệu lực để tính lại bảng điểm và so sánh với sheet `TONG_KET`.
   - Chống ván trùng: Kiểm tra `requestId` idempotency key.
   - Bảo toàn lịch sử: Không xóa vật lý dữ liệu (Soft deletes qua `TRANG_THAI = 'DA_HUY'`).
   - Ngăn chặn người chơi vô danh hoặc dữ liệu mồ côi.

3. **Task 6.3: Kiểm thử Giao diện & Responsive**:
   - Kiểm tra ma trận Viewport: Android (320px, 375px, 390px, 412px), iPhone (SE 375px, 13/14/15 Pro 390px safe area), Tablet (768px, 1024px), Desktop (1200px+).
   - Checklist: Vùng chạm $\ge 48\text{px}$, nút Win/Draw/Lose to rõ, không cuộn ngang, modal bottom sheet cuộn/đóng, safe area padding.
   - Trạng thái lỗi và loading.

4. **Task 6.4: Kiểm thử Đồng thời & Mạng**:
   - Nhiều thiết bị mở app cùng lúc.
   - Hai thiết bị cùng lưu: `LockService` chống race condition `gameNumber`.
   - Phát hiện dữ liệu cũ: Kiểm tra `expectedLatestGameNumber` trả về lỗi `STALE_DATA` và bảo lưu form.
   - Optimistic concurrency: Kiểm tra `expectedVersion` trả về `VERSION_CONFLICT` khi ván đã bị sửa từ máy khác.
   - Stress test nhẹ (50 ván liên tiếp).

### 1.2. Ngoài phạm vi (Out-of-Scope)
- Không phát triển các tính năng nghiệp vụ mới ngoài phạm vi kiểm thử.
- Không thử nghiệm trên dữ liệu thật của người dùng (chỉ sử dụng mock và test fixtures cô lập).

---

## 2. MÔI TRƯỜNG & TEST FIXTURES

- **Môi trường chạy test tự động:** Node.js V8 runtime với bộ giả lập Google Apps Script & Google Sheets (`MockSpreadsheet`, `MockSheet`, `MockRange`, `MockLock`).
- **Test Runner:** `tests/phase1.test.js` đến `tests/phase6.test.js`.
- **Dữ liệu mẫu Fixture:**
  - Phiên: `QA Test Session`, cược mặc định = 5.
  - Người chơi mẫu: `P001` (Đào), `P002` (Tiến), `P003` (Bình), `P004` (Cường), `P005` (Dũng), `P006` (Hải).
  - Khả năng Teardown / Cleanup: Khởi tạo lại sau mỗi suite, không để lại rác dữ liệu.

---

## 3. TIÊU CHÍ BẮT ĐẦU & HOÀN THÀNH

- **Tiêu chí bắt đầu (Entry Criteria):**
  - Nhánh Git `phase-6-testing` đã được tạo từ mã nguồn mới nhất.
  - Mã nguồn Backend và Frontend Phase 1-5 đã sẵn sàng.
- **Tiêu chí hoàn thành (Exit Criteria):**
  - 100% test cases (77/77 tests) trong toàn bộ 6 test suite đều PASSED.
  - Không có lỗi bảo toàn điểm số nào tồn tại.
  - Đã có báo cáo kiểm thử và checklist thiết bị.
  - Tất cả thay đổi được commit cục bộ trên nhánh riêng (Chưa push).
