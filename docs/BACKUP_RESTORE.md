# HƯỚNG DẪN SAO LƯU VÀ PHỤC HỒI DỮ LIỆU (BACKUP & RESTORE)
## DỰ ÁN: WEB APP "CHỐT ĐIỂM"

> **Slogan:** *Chạm nhanh, tính chuẩn, vui trọn cuộc chơi.*
> **Phiên bản:** 7.0.0
> **Tác giả:** Senior Software Engineer

---

## 1. CƠ CHẾ SAO LƯU DỮ LIỆU (BACKUP)

### A. Sao lưu Thủ công (Manual Backup)
Bất cứ lúc nào trước khi thực hiện chỉnh sửa lớn hoặc sau khi kết thúc buổi chơi quan trọng:

1. **Cách 1: Từ Apps Script Editor**
   - Chọn hàm `createSpreadsheetBackup` trong danh sách hàm và bấm **Chạy** (*Run*).
   - Bản sao của Spreadsheet sẽ được tạo tự động trên Google Drive với định dạng tên: `ChotDiem_Backup_YYYYMMDD_HHMMSS`.
   - Nhật ký sao lưu được tự động ghi nhận vào sheet `NHAT_KY`.

2. **Cách 2: Xuất tệp CSV/JSON từ Giao diện Web App**
   - Mở tab **Cài đặt** trên điện thoại.
   - Bấm nút **📥 Xuất Dữ Liệu (CSV Excel)** hoặc **📄 Xuất Dữ Liệu (JSON)**.
   - Trình duyệt sẽ tải về máy tệp báo cáo tổng hợp chi tiết toàn bộ lịch sử và bảng điểm (hỗ trợ hiển thị tiếng Việt UTF-8 chuẩn trên Microsoft Excel).

---

### B. Cài đặt Sao lưu Tự động Định kỳ (Automated Triggers)
Để hệ thống tự động tạo bản sao lưu mỗi ngày lúc 02:00 sáng:

1. Mở Apps Script Editor.
2. Chạy hàm: `installBackupTrigger('DAILY')` (hoặc `installBackupTrigger('WEEKLY')`).
3. Để gỡ bỏ sao lưu tự động khi không còn nhu cầu: Chạy hàm `removeBackupTrigger()`.

---

## 2. QUY TRÌNH PHỤC HỒI DỮ LIỆU (RESTORE)

### Trường hợp 1: Phục hồi Toàn bộ từ Bản sao lưu Google Drive
Khi Spreadsheet chính bị lỗi hỏng nặng hoặc dữ liệu bị phá hủy ngoài ý muốn:

1. Mở Google Drive, tìm tệp bản sao lưu gần nhất (ví dụ: `ChotDiem_Backup_20260902_140000`).
2. Mở file bản sao lưu này.
3. Vào **Tiện ích mở rộng** > **Apps Script**.
4. Thực hiện Triển khai lại Web App từ file bản sao lưu này (Xem [docs/DEPLOYMENT.md](DEPLOYMENT.md)).
5. Lấy URL Web App mới và gửi lại cho người dùng.

---

### Trường hợp 2: Khôi phục một Sheet bị Xóa hoặc Sửa nhầm
Nếu một sheet (ví dụ `TONG_KET` hoặc `VAN_DAU`) bị xóa nhầm:

1. **Nếu mất sheet `TONG_KET` (Bảng tổng kết)**:
   - Không cần lo lắng! Sheet `VAN_DAU` là nguồn dữ liệu chuẩn (Single Source of Truth).
   - Chỉ cần vào Web App > Tab Cài đặt > Bấm nút **🔄 Tính lại toàn bộ bảng điểm**.
   - Hoặc trong Apps Script Editor, chạy hàm `rebuildSummarySheet()`. Hệ thống sẽ tự động tạo lại sheet `TONG_KET` và điền điểm số chính xác 100%.
2. **Nếu mất một sheet hệ thống khác (`CAU_HINH`, `LICH_SU_THAY_DOI`, `NHAT_KY`)**:
   - Chạy hàm `prepareCleanSpreadsheet()` trong Apps Script Editor.
   - Hàm có tính chất bảo toàn an toàn: chỉ tạo lại các sheet bị thiếu và giữ nguyên vẹn toàn bộ dữ liệu của các sheet còn lại.

---

### Trường hợp 3: Khôi phục các Ván đấu bị Hủy nhầm
- Trong Web App, mở tab **Lịch sử**.
- Bật bộ lọc trạng thái: Chọn **Đã hủy** hoặc **Tất cả**.
- Chạm vào ván đấu đã hủy > Bấm nút **Khôi phục ván**.
- Hệ thống sẽ chuyển trạng thái ván về `HOP_LE` và tự động cộng điểm lại vào bảng xếp hạng.

---

## 3. BẢO VỆ SHEET HỆ THỐNG (SHEET PROTECTION)
Để ngăn ngừa người dùng vô tình chỉnh sửa trực tiếp vào các ô tính toán của Google Sheets:
- Chạy hàm `protectSystemSheets()` trong Apps Script.
- Toàn bộ các sheet `CAU_HINH`, `VAN_DAU`, `TONG_KET`, `LICH_SU_THAY_DOI`, `NHAT_KY` sẽ được gán cờ cảnh báo bảo vệ mà không làm gián đoạn quyền ghi của Web App.
