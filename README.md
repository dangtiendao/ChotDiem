# Chốt Điểm - Web App Ghi Nhận & Tính Điểm Theo Ván

Ứng dụng web ghi nhận và tính điểm nhanh theo từng ván cho các buổi chơi đối kháng nhiều người, sử dụng **Google Apps Script** làm backend và **Google Sheets** làm cơ sở dữ liệu.

---

## 🌟 Tính Năng Cốt Lõi (Phase 1 & Phase 2)

- **Mô hình Ván đấu linh hoạt:** Mỗi ván có 1 Người cầm đầu ($A$) và nhiều Người đối đầu ($opp$).
- **Nguyên tắc bảo toàn điểm số (Zero-sum):** $\Delta_A + \sum \Delta_{opp} = 0$.
- **Lưu trữ nguyên tử:** Mỗi ván đấu được lưu trên **đúng một dòng duy nhất** trong sheet `VAN_DAU`.
- **Hỗ trợ số lượng người chơi thay đổi tự do:** Mảng chi tiết kết quả đối đầu được mã hóa dưới dạng chuỗi JSON trong cột `CHI_TIET_JSON`.
- **Cơ chế khóa đồng thời (LockService):** Chống xung đột dữ liệu khi nhiều người dùng cùng thao tác.
- **Xếp hạng chuẩn thể thao (Competition Ranking):** Tính thứ hạng theo quy tắc `1, 2, 2, 4` với các tiêu chí phụ sắp xếp hiển thị.
- **Xóa mềm (Soft delete):** Không xóa vật lý dữ liệu lịch sử (`NGUNG_CHOI`, `DA_HUY`).

---

## 📁 Cấu Trúc Dự Án

```
├── appsscript.json        # Apps Script Manifest (V8, Asia/Ho_Chi_Minh)
├── Config.gs              # Hằng số, Tên sheet, Header, Enums & Error codes
├── Utils.gs               # Tiện ích chung, LockService, ID generator, Response wrapper
├── PlayerService.gs       # Quản lý người chơi (get, add, update, deactivate, reorder)
├── GameService.gs         # Nghiệp vụ ván đấu (save, history, update, cancel, restore)
├── SummaryService.gs      # Tổng kết và xếp hạng (getScoreboard, rebuildSummarySheet)
├── Code.gs                # Điểm vào chính, setupApp(), getAppStatus(), Web App API
├── Test.gs                # Bộ test thủ công trực tiếp trên Apps Script Console
├── docs/
│   ├── phase-1-business-and-data-design.md
│   └── phase-2-backend-guide.md
├── src/                   # Core Pure logic modules (hỗ trợ test cục bộ)
└── tests/
    ├── phase1.test.js     # Test suite Phase 1 (21/21 tests passed)
    └── phase2.test.js     # Test suite Phase 2 Mock Engine (18/18 tests passed)
```

---

## 🚀 Hướng Dẫn Cài Đặt & Chạy Thử

### 1. Kiểm thử cục bộ
```bash
npm test
```

### 2. Triển khai lên Google Apps Script
Chi tiết xem tại tài liệu: [docs/phase-2-backend-guide.md](docs/phase-2-backend-guide.md)

1. Mở Google Sheet > **Tiện ích mở rộng** > **Apps Script**.
2. Sao chép toàn bộ các file `.gs` và `appsscript.json` vào dự án Apps Script.
3. Chạy hàm `setupApp()` để tự động tạo cấu trúc 4 Sheet: `CAU_HINH`, `NGUOI_CHOI`, `VAN_DAU`, `TONG_KET`.
4. Chạy hàm `runPhase2Tests()` từ file `Test.gs` để kiểm thử toàn bộ backend.

---

## 📄 Bản Quyền
Giấy phép MIT.
