# CHECKLIST BÀN GIAO HỆ THỐNG DỮ LIỆU SẠCH (HANDOVER CHECKLIST)
## DỰ ÁN: WEB APP "CHỐT ĐIỂM"

- **Ngày bàn giao:** 02/09/2026
- **Phiên bản:** 7.0.0
- **Trạng thái:** Sẵn sàng đưa vào sử dụng thực tế (Production-Ready)

---

## 1. BẢNG KIỂM TRA ĐIỀU KIỆN BÀN GIAO

| STT | Hạng Mục Kiểm Tra | Kết Quả Mong Đợi | Trạng Thái |
| :---: | :--- | :--- | :---: |
| 1 | **Spreadsheet kết nối** | Mở đúng Spreadsheet liên kết, không lỗi quyền truy cập | ✅ ĐẠT |
| 2 | **Cấu trúc 6 Sheet bắt buộc** | Đầy đủ: `CAU_HINH`, `NGUOI_CHOI`, `VAN_DAU`, `TONG_KET`, `LICH_SU_THAY_DOI`, `NHAT_KY` | ✅ ĐẠT |
| 3 | **Header các sheet** | Đúng chuẩn 100% cột theo tài liệu thiết kế Phase 1-7, đã freeze dòng 1 | ✅ ĐẠT |
| 4 | **Cấu hình phiên ban đầu** | Tên app: *Chốt Điểm*, Slogan: *Chạm nhanh, tính chuẩn, vui trọn cuộc chơi*, Cược: 5 | ✅ ĐẠT |
| 5 | **Dọn dẹp dữ liệu thử** | Đã chạy `cleanupTestData()`, không còn ván thử hoặc người chơi mẫu `TEST_` | ✅ ĐẠT |
| 6 | **Bất biến Zero-Sum** | Tổng điểm toàn phiên bằng đúng 0, bảng tổng kết khớp 100% với lịch sử | ✅ ĐẠT |
| 7 | **Sheet Protection** | Đã chạy `protectSystemSheets()`, ngăn ngừa xóa/sửa nhầm các sheet hệ thống | ✅ ĐẠT |
| 8 | **Lớp ghi log `NHAT_KY`** | Hoạt động bình thường, tự động che giấu thông tin nhạy cảm | ✅ ĐẠT |
| 9 | **Web App Entry Point** | `doGet(e)` phản hồi giao diện HTML5 Mobile-First mượt mà, không lỗi 500 | ✅ ĐẠT |
| 10 | **Đa thiết bị & Chống trùng** | `expectedLatestGameNumber` phát hiện `STALE_DATA`, `requestId` chống gửi trùng | ✅ ĐẠT |
| 11 | **Xuất dữ liệu** | Đã kiểm tra tính năng Xuất CSV (BOM UTF-8 tiếng Việt) và JSON | ✅ ĐẠT |
| 12 | **Bản sao lưu trước bàn giao** | Đã tạo bản sao lưu snapshot dự phòng ban đầu | ✅ ĐẠT |

---

## 2. QUY TRÌNH CHUẨN BỊ PHIÊN CHƠI MỚI CHO NGƯỜI DÙNG

1. **Khởi tạo bảng sạch**: Chạy hàm `prepareCleanSpreadsheet({ sessionName: "Tên Buổi Chơi", defaultBet: 5 })`.
2. **Thêm danh sách người chơi thật**: Mở tab "Người chơi" trên Web App và nhập tên từng người chơi thực tế.
3. **Bảo vệ hệ thống**: Chạy hàm `protectSystemSheets()`.
4. **Gửi liên kết Web App URL**: Chia sẻ link Web App đã deploy cho nhóm chơi để bắt đầu ghi điểm.
