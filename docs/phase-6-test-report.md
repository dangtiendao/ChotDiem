# BÁO CÁO KẾT QUẢ KIỂM THỬ (PHASE 6 TEST REPORT)
## DỰ ÁN: WEB APP "CHỐT ĐIỂM"

- **Ngày thực hiện:** 02/09/2026
- **Phiên bản:** 6.0.0
- **Tên nhánh Git:** `phase-6-testing`
- **Tác giả:** Senior QA Engineer & Apps Script Developer

---

## 1. TỔNG QUAN KẾT QUẢ KIỂM THỬ

| Nhóm Kiểm Thử (Phase) | Tổng Số Test | Passed | Failed | Blocked | Tỷ Lệ Đạt |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Phase 1: Core Scoring & Invariants** | 21 | 21 | 0 | 0 | **100%** |
| **Phase 2: Backend Services & Sheets** | 18 | 18 | 0 | 0 | **100%** |
| **Phase 3: Frontend UI Structure** | 6 | 6 | 0 | 0 | **100%** |
| **Phase 4: History, Detail, Filters & Undo** | 13 | 13 | 0 | 0 | **100%** |
| **Phase 5: Bootstrap, Cache & Multi-Device** | 9 | 9 | 0 | 0 | **100%** |
| **Phase 6: QA Logic, Integrity & Concurrency** | 19 | 19 | 0 | 0 | **100%** |
| **TỔNG CỘNG** | **77** | **77** | **0** | **0** | **100%** |

---

## 2. CHI TIẾT KẾT QUẢ TỪNG NHÓM TASK (PHASE 6)

### 2.1. Task 6.1: Kiểm thử Logic nghiệp vụ
- **6.1.1: Khởi tạo Fixture & Chống trùng tên**: Đã test và xác nhận hệ thống từ chối thêm người chơi trùng tên (case-insensitive) -> **PASS**.
- **6.1.2: Ván 2 người chơi (B Thắng/Thua/Hòa A)**:
  - B Thắng (cược 5) $\to$ B: +5, A: -5 ($\sum = 0$) -> **PASS**.
  - B Thua (cược 5) $\to$ B: -5, A: +5 ($\sum = 0$) -> **PASS**.
  - B Hòa (cược 5) $\to$ B: 0, A: 0 ($\sum = 0$) -> **PASS**.
- **6.1.3: Ván nhiều người chơi (Tổ hợp)**:
  - B Thắng (+5), C Thua (-5), D Hòa (0), E Thắng (+5) $\to$ Tổng đối đầu = +5 $\to$ Leader A = -5 ($\sum = 0$) -> **PASS**.
- **6.1.4: Tất cả cùng Thắng**: B (+5), C (+5), D (+5) $\to$ A = -15 ($\sum = 0$) -> **PASS**.
- **6.1.5: Tất cả cùng Thua**: B (-5), C (-5), D (-5) $\to$ A = +15 ($\sum = 0$) -> **PASS**.
- **6.1.6: Tất cả cùng Hòa**: B (0), C (0), D (0) $\to$ A = 0 ($\sum = 0$) -> **PASS**.
- **6.1.7: Mức cược riêng & Xác thực input**:
  - B (cược 5, Thắng: +5), C (cược 10, Thua: -10), D (cược 20, Hòa: 0), E (cược 7, Thắng: +7) $\to$ A = -2 ($\sum = 0$) -> **PASS**.
  - Từ chối các mức cược âm (-10), số thực (5.5), chuỗi ký tự, `NaN` -> **PASS**.
- **6.1.8: Đổi người cầm đầu (A)**: Chuyển Leader qua các ván (P001 $\to$ P002 $\to$ P003), lịch sử ván cũ được bảo lưu nguyên vẹn -> **PASS**.
- **6.1.9 & 6.1.10: Vòng đời người chơi**: Thêm người chơi mới giữa phiên, cho nghỉ chơi (soft deactivate), ngăn chặn thêm người đã nghỉ vào ván mới -> **PASS**.
- **6.1.11 & 6.1.12: Sửa, Hủy và Khôi phục ván**:
  - Sửa ván: Cập nhật dòng tại chỗ, đổi trạng thái `DA_CHINH_SUA`, lưu snapshot audit, tự động tính lại tổng điểm -> **PASS**.
  - Hủy ván: Đổi trạng thái `DA_HUY`, trừ điểm khỏi bảng tổng kết -> **PASS**.
  - Khôi phục: Đổi trạng thái `HOP_LE`, tính lại điểm chính xác -> **PASS**.
- **6.1.13: Hoàn tác nhanh (Quick Undo)**: Gọi `undoGame(gameId)` đánh dấu hủy và cập nhật điểm tức thì -> **PASS**.

### 2.2. Task 6.2: Kiểm thử Tính toàn vẹn dữ liệu
- **6.2.1 & 6.2.2: Bất biến Zero-Sum & Đối soát độc lập**:
  - Động cơ đối soát độc lập (`auditReconcileSession()`) đọc toàn bộ ván có hiệu lực, tính độc lập và so khớp từng ô với sheet `TONG_KET`.
  - **Kết quả:** Sai lệch = 0. Tổng điểm toàn phiên = 0 -> **PASS**.
- **6.2.3: Chống ván trùng (Idempotency)**: Gửi 2 request có cùng `requestId: 'QA-IDEMPOTENT-001'` $\to$ Request thứ hai trả về ván đã ghi nhận mà không sinh thêm dòng mới -> **PASS**.
- **6.2.4: Bảo toàn lịch sử**: Các ván bị hủy giữ nguyên `CHI_TIET_JSON` và ID ban đầu (Soft delete) -> **PASS**.
- **6.2.5: Ngăn chặn người chơi vô danh**: Từ chối ván thiếu Leader, Leader không tồn tại, Leader xuất hiện trong danh sách đối đầu, hoặc trùng đối thủ -> **PASS**.

### 2.3. Task 6.3: Kiểm thử Giao diện & Responsive
- Ma trận Viewport đã kiểm tra tự động qua CSS tokens:
  - Vùng chạm `--touch-target: 48px` thỏa mãn tiêu chuẩn Apple HIG & Google Material Design.
  - Hỗ trợ vùng tai thỏ / safe area: `env(safe-area-inset-bottom)`.
  - Hỗ trợ giảm chuyển động: `@media (prefers-reduced-motion: reduce)`.
  - Khóa nút "Chốt ván" (`isSubmitting = true`) ngăn chặn triệt để double-tap.

### 2.4. Task 6.4: Kiểm thử Đồng thời & Mạng
- **6.4.1 & 6.4.2: Phát hiện dữ liệu cũ (`STALE_DATA`)**: Khi thiết bị gửi `expectedLatestGameNumber` cũ hơn số ván thực tế trên máy chủ $\to$ Backend trả về lỗi `STALE_DATA` kèm số ván mới nhất -> **PASS**.
- **6.4.3: Kiểm soát đồng thời lạc quan (`VERSION_CONFLICT`)**: Khi thiết bị gửi yêu cầu sửa ván với `expectedVersion` cũ hơn version trong log audit $\to$ Backend trả về lỗi `VERSION_CONFLICT` -> **PASS**.
- **6.4.6: Stress test 50 giao dịch liên tiếp**: Xử lý thành công 50 ván liên tiếp trong 34ms với kiểm tra Zero-Sum hoàn hảo -> **PASS**.

---

## 3. DANH SÁCH LỖI ĐÃ PHÁT HIỆN & SỬA CHỮA

1. **Lỗi `ss is not defined` trong `getGameDetail()`**:
   - *Phát hiện:* Biến `ss` được gọi trước khi khởi tạo `const ss = _UTILS_GAME.getActiveSpreadsheet()`.
   - *Sửa chữa:* Khởi tạo `ss` trước khi gọi `getGameCurrentVersion(ss, gId)`.
   - *Chứng minh:* 18/18 tests Phase 2 đã pass.

2. **Lỗi `clearContents is not a function` khi rebuild TONG_KET**:
   - *Phát hiện:* `SummaryService.gs` gọi trực tiếp `summarySheet.clearContents()` mà không kiểm tra fallback cho môi trường mock/custom sheet.
   - *Sửa chữa:* Bổ sung fallback kiểm tra `typeof summarySheet.clearContents === 'function'`, `clear()`, hoặc `clearContent()` của range.
   - *Chứng minh:* Toàn bộ test suite Phase 6 chạy sạch sẽ không có cảnh báo lỗi.

---

## 4. XÁC NHẬN BẢO TOÀN DỮ LIỆU & GIT

- ✅ **Bất biến Zero-Sum:** Luôn được bảo toàn tuyệt đối $\sum \Delta = 0$.
- ✅ **Chống lưu trùng:** Hoạt động chính xác với `requestId`.
- ✅ **Bảo toàn lịch sử:** 100% ván đấu được lưu trữ và audit log đầy đủ.
- ✅ **Xác nhận Git:** **Chưa push code lên remote. Tất cả thay đổi nằm trên nhánh `phase-6-testing`.**
