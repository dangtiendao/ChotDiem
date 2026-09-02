# Chốt Điểm - Web App Ghi Nhận & Tính Điểm Theo Ván

Ứng dụng web ghi nhận và tính điểm nhanh theo từng ván cho các buổi chơi đối kháng nhiều người, sử dụng **Google Apps Script** làm backend, **Google Sheets** làm cơ sở dữ liệu và **Mobile-First HTML5/CSS3 Web App** cho giao diện người dùng.

---

## 🌟 Tính Năng Hoàn Chỉnh (Phase 1, 2, 3 & 4)

- **Mobile-First Touch UI:** Giao diện tối ưu cho điện thoại di động, thao tác 1 chạm, vùng chạm lớn ($\ge 48\text{px}$), không cần mở bàn phím để chọn kết quả.
- **5 Màn Hình Trực Quan:** Bảng điểm (xếp hạng, top 3), Ván mới (nhập 6 bước nhanh), Lịch sử ván (bộ lọc đa điều kiện), Quản lý người chơi, Cài đặt phiên.
- **Mô hình Ván đấu Zero-Sum:** 1 Người cầm đầu ($A$) và nhiều Người đối đầu ($opp$). Tổng biến động toàn ván luôn triệt tiêu về 0: $\Delta_A + \sum \Delta_{opp} = 0$.
- **Lưu trữ nguyên tử 1 ván = 1 dòng:** Mảng chi tiết kết quả đối đầu lưu trong cột `CHI_TIET_JSON` của sheet `VAN_DAU`.
- **Lịch sử & Bộ lọc đa điều kiện (Phase 4):** Lọc theo người chơi, người cầm đầu, kết quả (Thắng/Hòa/Thua), khoảng số ván, trạng thái ván.
- **Xem chi tiết & Chỉnh sửa ván đấu (Phase 4):** Bottom sheet xem chi tiết từng người chơi; cho phép sửa kết quả, sửa cược, đổi người cầm đầu với cảnh báo an toàn.
- **Hủy & Khôi phục ván (Phase 4):** Xóa mềm an toàn (trạng thái `DA_HUY`, `DA_CHINH_SUA`), tự động cập nhật bảng tổng điểm và bảo toàn dữ liệu gốc.
- **Hệ thống Audit Log (Phase 4):** Sheet `LICH_SU_THAY_DOI` lưu vết snapshot đầy đủ mọi thao tác `CREATE`, `EDIT`, `CANCEL`, `RESTORE`, `UNDO`.
- **Hoàn tác nhanh (Quick Undo - Phase 4):** Nút hoàn tác nổi 8 giây sau khi chốt ván với thanh đếm ngược thời gian thực.
- **Cơ chế khóa đồng thời (LockService):** Chống xung đột dữ liệu khi nhiều người dùng cùng thao tác.
- **Xếp hạng thể thao (Competition Ranking):** Tính thứ hạng theo chuẩn `1, 2, 2, 4` với các tiêu chí phụ sắp xếp hiển thị.

---

## 📁 Cấu Trúc Dự Án

```
├── appsscript.json        # Apps Script Manifest (V8, Asia/Ho_Chi_Minh)
├── Config.gs              # Hằng số, Tên sheet, Header, Enums & Error codes
├── Utils.gs               # Tiện ích chung, LockService, ID generator, Audit logger
├── PlayerService.gs       # Quản lý người chơi (get, add, update, deactivate, reorder)
├── GameService.gs         # Nghiệp vụ ván đấu (save, history, detail, update, cancel, restore, undo)
├── SummaryService.gs      # Tổng kết và xếp hạng (getScoreboard, rebuildSummarySheet)
├── Code.gs                # Điểm vào chính, setupApp(), getAppStatus(), include(), doGet(), doPost()
├── Test.gs                # Bộ test thủ công trực tiếp trên Apps Script Console
├── Index.html             # Layout chính Web App, View containers, Modals, Quick Undo Banner
├── Styles.html            # Toàn bộ CSS Mobile-First, Custom Properties, Modals, Filters
├── Components.html        # Reusable SVG Icons Sprite & Component templates
├── Scripts.html           # State management (appState), API Client Adapter, Filters, Modals, Undo logic
├── docs/
│   ├── phase-1-business-and-data-design.md
│   ├── phase-2-backend-guide.md
│   ├── phase-3-frontend-guide.md
│   └── phase-4-history-guide.md
├── src/                   # Core Pure logic modules (hỗ trợ test cục bộ)
└── tests/
    ├── phase1.test.js     # Test suite Phase 1 Core (21/21 passed)
    ├── phase2.test.js     # Test suite Phase 2 Backend Mock (18/18 passed)
    ├── phase3.test.js     # Test suite Phase 3 UI Structure (6/6 passed)
    └── phase4.test.js     # Test suite Phase 4 History & Audit (13/13 passed)
```

---

## 🚀 Hướng Dẫn Cài Đặt & Chạy Thử

### 1. Chạy toàn bộ Unit Tests (58/58 tests)
```bash
npm test
```

### 2. Triển khai lên Google Apps Script
Chi tiết xem tại tài liệu: [docs/phase-4-history-guide.md](docs/phase-4-history-guide.md)

1. Mở Google Sheet > **Tiện ích mở rộng** > **Apps Script**.
2. Sao chép toàn bộ các file `.gs`, `.html` và `appsscript.json` vào dự án Apps Script.
3. Chạy hàm `setupApp()` để tự động tạo cấu trúc 5 Sheet: `CAU_HINH`, `NGUOI_CHOI`, `VAN_DAU`, `TONG_KET`, `LICH_SU_THAY_DOI`.
4. Bấm **Deploy** > **New deployment** > Chọn loại **Web app** > Cấp quyền truy cập để mở ứng dụng web trên điện thoại.

---

## 📄 Bản Quyền
Giấy phép MIT.
