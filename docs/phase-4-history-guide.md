# HƯỚNG DẪN LỊCH SỬ PHIÊN CHƠI (PHASE 4)
## DỰ ÁN: WEB APP "CHỐT ĐIỂM"

- **Phiên bản:** 4.0.0
- **Phạm vi thi công:** Phase 4 - Quản lý lịch sử ván đấu, xem chi tiết, bộ lọc đa điều kiện, sửa / hủy / khôi phục ván kèm audit log và hoàn tác nhanh (Quick Undo).
- **Tác giả:** Senior Full-stack Developer

---

## 1. TỔNG QUAN KIẾN TRÚC PHASE 4

Phase 4 hoàn thiện vòng đời toàn diện của một ván đấu và cung cấp các tính năng quản lý lịch sử chuyên sâu cho người dùng trên thiết bị di động:

```
├── Config.gs              # Thêm SHEET_NAMES.LICH_SU_THAY_DOI, ROUND_STATUS.DA_CHINH_SUA, QUICK_UNDO_TIMEOUT_MS, Error codes
├── Utils.gs               # generateNextAuditId(), recordAuditLog()
├── GameService.gs         # getGameHistory(filters, paging), getGameDetail(gameId), updateGame(), cancelGame(), restoreGame(), undoGame()
├── SummaryService.gs      # Tính điểm cho cả HOP_LE và DA_CHINH_SUA, loại trừ DA_HUY, rebuildSummarySheet()
├── Code.gs                # Khởi tạo sheet LICH_SU_THAY_DOI trong setupApp(), router API doGet / doPost
├── Index.html             # Bộ lọc lịch sử Collapsible, Modal Chi tiết, Modal Sửa, Modal Xác nhận, Quick Undo Banner
├── Styles.html            # CSS Mobile-First cho Modals, Filter Bar, Quick Undo Banner, Status Badges
├── Scripts.html           # Router, Filter state, Detail & Edit workflows, Confirmation dialogs, 8s Countdown Undo
└── tests/
    └── phase4.test.js     # 13/13 test cases tự động kiểm tra toàn bộ tính năng Phase 4
```

---

## 2. NỘI DUNG 5 NHIỆM VỤ ĐÃ HOÀN THÀNH

### Task 4.1: Danh sách toàn bộ ván
- API `getGameHistory(filters, paging)` trả về danh sách ván sắp xếp mới nhất lên đầu (`gameNumber DESC`).
- Mỗi ván hiển thị rõ: Số ván, Thời gian chốt, Tên người cầm đầu ($A$) kèm biến động điểm, Tags kết quả từng đối thủ, Tổng giao dịch `transactionTotal` = $\sum |\Delta_{opp}|$.
- Badge trạng thái trực quan: `HỢP LỆ` (xanh lá), `ĐÃ SỬA` (vàng), `ĐÃ HỦY` (đỏ, mờ card nhưng vẫn đọc được nội dung).

### Task 4.2: Xem chi tiết ván
- Chạm vào bất kỳ ván nào trong danh sách sẽ mở **Modal Bottom Sheet Chi tiết**:
  - Thông tin tổng quan: Mã ván, Số ván, Trạng thái, Thời gian, Tổng giao dịch, Ghi chú.
  - Bảng danh sách người tham gia: Tên, Vai trò ($A$ cầm đầu / Đối đầu), Kết quả (Thắng/Hòa/Thua), Mức cược thực tế, Biến động điểm $\Delta$.
  - Nút hành động tương ứng theo quyền trạng thái: "Sửa ván", "Hủy ván", "Khôi phục ván", "Đóng".

### Task 4.3: Bộ lọc lịch sử đa điều kiện (AND Filter)
- Thanh lọc có thể thu gọn (Collapsible Filter Panel) với badge đếm số lượng bộ lọc đang kích hoạt.
- Hỗ trợ lọc theo:
  1. **Người chơi:** Lọc ván mà người đó tham gia (cả vai trò Leader lẫn Opponent).
  2. **Người cầm đầu:** Lọc ván mà người đó làm $A$.
  3. **Kết quả:** Thắng (+), Hòa (0), Thua (-) của người chơi được chọn (hoặc bất kỳ ai nếu chưa chọn người chơi).
  4. **Khoảng số ván:** Từ ván $\to$ Đến ván (kiểm tra $from \le to$).
  5. **Trạng thái ván:** Hợp lệ / Tất cả / Đã chỉnh sửa / Đã hủy.
- Nút "Áp dụng" và "Xóa bộ lọc" phản hồi tức thì.

### Task 4.4: Sửa, hủy và khôi phục ván kèm Audit Log
- **Trạng thái ván:** `HOP_LE` (Active), `DA_CHINH_SUA` (Edited), `DA_HUY` (Cancelled).
- **Sheet Audit `LICH_SU_THAY_DOI`:** Lưu vết tự động mỗi khi có thay đổi (`MA_AUDIT`, `MA_VAN`, `HANH_DONG`, `DU_LIEU_TRUOC`, `DU_LIEU_SAU`, `THOI_GIAN`, `NGUOI_THUC_HIEN`, `LY_DO`, `VERSION`).
- **Sửa ván (`updateGame`):** Hộp thoại cảnh báo $\to$ Cho phép sửa A, kết quả đối thủ, cược riêng, ghi chú $\to$ Lưu snapshot `EDIT` vào audit $\to$ Đổi trạng thái sang `DA_CHINH_SUA` $\to$ Tự động rebuild `TONG_KET`.
- **Hủy ván (`cancelGame`):** Hộp thoại xác nhận $\to$ Lưu snapshot `CANCEL` $\to$ Đổi trạng thái sang `DA_HUY` (không xóa dòng vật lý) $\to$ Tự động rebuild `TONG_KET`.
- **Khôi phục ván (`restoreGame`):** Hộp thoại xác nhận $\to$ Lưu snapshot `RESTORE` $\to$ Đổi trạng thái về `HOP_LE` (hoặc `DA_CHINH_SUA`) $\to$ Tự động rebuild `TONG_KET`.

### Task 4.5: Hoàn tác nhanh sau khi chốt ván (Quick Undo)
- Cấu hình `CONFIG.DEFAULTS.QUICK_UNDO_TIMEOUT_MS = 8000` (8 giây).
- Ngay sau khi chốt ván thành công ở màn hình Ván mới:
  - Hiển thị Floating Banner ở đáy màn hình: "Đã chốt ván #X" kèm nút **"Hoàn tác (8s)"** và thanh tiến trình đếm ngược.
  - Khi người dùng chạm nút Hoàn tác: Gọi `undoGame(gameId)` $\to$ Ván chuyển sang `DA_HUY`, ghi audit `UNDO` với lý do `QUICK_UNDO` $\to$ Rebuild tổng điểm $\to$ Thông báo hoàn tác thành công.
  - Sau 8 giây: Banner tự động thu lại và hủy timer. Dọn timer cũ khi có ván mới tiếp theo.

---

## 3. KẾT QUẢ KIỂM THỬ TOÀN DIỆN

Chạy lệnh: `npm test`
- **Phase 1 (Core Scoring & Data Design):** 21/21 passed.
- **Phase 2 (Backend Services & Sheet Engine):** 18/18 passed.
- **Phase 3 (Mobile-First UI Structure):** 6/6 passed.
- **Phase 4 (History, Details, Filters, Audit & Undo):** 13/13 passed.
- **Tổng cộng:** **58/58 Test Cases PASSED (100%)**.
