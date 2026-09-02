# Chốt Điểm - Web App Ghi Nhận & Tính Điểm Theo Ván

> **Chạm nhanh, tính chuẩn, vui trọn cuộc chơi.**

Ứng dụng web ghi nhận và tính điểm nhanh theo từng ván cho các buổi chơi đối kháng nhiều người, sử dụng **Google Apps Script** làm backend, **Google Sheets** làm cơ sở dữ liệu và **Mobile-First HTML5/CSS3 Web App** cho giao diện người dùng.

---

## 🌟 Tính Năng Hoàn Chỉnh (Phase 1 đến Phase 7)

- **Mobile-First Touch UI:** Giao diện tối ưu cho điện thoại di động, thao tác 1 chạm, vùng chạm lớn ($\ge 48\text{px}$), không cần mở bàn phím để chọn kết quả.
- **5 Màn Hình Trực Quan:** Bảng điểm (xếp hạng thể thao, top 3), Ván mới (nhập 6 bước nhanh), Lịch sử ván (bộ lọc đa điều kiện), Quản lý người chơi, Cài đặt phiên.
- **Mô hình Ván đấu Zero-Sum:** 1 Người cầm đầu ($A$) và nhiều Người đối đầu ($opp$). Tổng biến động toàn ván luôn triệt tiêu về 0: $\Delta_A + \sum \Delta_{opp} = 0$.
- **Lưu trữ nguyên tử 1 ván = 1 dòng:** Mảng chi tiết kết quả đối đầu lưu trong cột `CHI_TIET_JSON` của sheet `VAN_DAU`.
- **Tích hợp & Khởi tạo siêu tốc (Phase 5):** API `getAppBootstrapData()` gom toàn bộ phiên, người chơi, bảng điểm, lịch sử trong 1 roundtrip duy nhất.
- **Bộ nhớ đệm (CacheService - Phase 5):** Cache danh sách người chơi và cấu hình trong RAM của Google Apps Script, tự động xóa cache khi có thay đổi.
- **Bảo vệ đồng thời nhiều thiết bị (Multi-Device Protection - Phase 5 & 6):** Kiểm tra `expectedLatestGameNumber` (phát hiện `STALE_DATA`), kiểm soát phiên bản lạc quan (`VERSION_CONFLICT`) khi sửa ván cũ.
- **Chống lưu trùng (Idempotency - Phase 5 & 6):** Mỗi request mang `requestId` duy nhất, không tạo dòng thừa khi ấn đúp hoặc gửi lại.
- **Nhận diện thương hiệu chính thức (Phase 5):** Tên "Chốt Điểm", Slogan "Chạm nhanh, tính chuẩn, vui trọn cuộc chơi", Logo SVG, Favicon, Màn hình chào (Splash Screen) và CSS Tokens.
- **Lịch sử & Bộ lọc đa điều kiện (Phase 4):** Lọc theo người chơi, người cầm đầu, kết quả (Thắng/Hòa/Thua), khoảng số ván, trạng thái ván.
- **Xem chi tiết & Chỉnh sửa ván đấu (Phase 4):** Bottom sheet xem chi tiết từng người chơi; cho phép sửa kết quả, sửa cược, đổi người cầm đầu với cảnh báo an toàn.
- **Hủy & Khôi phục ván (Phase 4):** Xóa mềm an toàn (trạng thái `DA_HUY`, `DA_CHINH_SUA`), tự động cập nhật bảng tổng điểm.
- **Hệ thống Audit Log (Phase 4):** Sheet `LICH_SU_THAY_DOI` lưu vết snapshot đầy đủ mọi thao tác `CREATE`, `EDIT`, `CANCEL`, `RESTORE`, `UNDO`.
- **Hoàn tác nhanh (Quick Undo - Phase 4):** Nút hoàn tác nổi 8 giây sau khi chốt ván với thanh đếm ngược thời gian thực.
- **Triển khai & Kiểm tra sức khỏe (Phase 7):** Hàm `runPreDeploymentCheck()` xác thực 6 sheet và quyền truy cập trước khi đưa vào sử dụng.
- **Sao lưu & Phục hồi (Phase 7):** Hàm `createSpreadsheetBackup()` và trigger tự động `installBackupTrigger()`, bảo vệ sheet hệ thống với `protectSystemSheets()`.
- **Xuất dữ liệu UTF-8 (Phase 7):** Xuất toàn bộ phiên chơi sang tệp CSV (BOM UTF-8 chuẩn Excel) hoặc JSON trực tiếp từ Web App.
- **Nhật ký lỗi hệ thống (Phase 7):** Sheet `NHAT_KY` ghi nhận các sự kiện quan trọng, tự động che giấu thông tin nhạy cảm.
- **Bộ Kiểm Thử Toàn Diện (Phase 1-7):** 85/85 Unit & Integration test cases bao quát toàn bộ logic tính điểm, bất biến toán học, đồng thời và triển khai.

---

## 📁 Cấu Trúc Dự Án

```
├── appsscript.json        # Apps Script Manifest (V8, Asia/Ho_Chi_Minh)
├── Config.gs              # Hằng số, Tên app, Slogan, Headers, Enums, Cache keys, Log levels & Error codes
├── Utils.gs               # Tiện ích chung, LockService, CacheService, logImportantEvent, getGameCurrentVersion
├── PlayerService.gs       # Quản lý người chơi với Cache (get, add, update, deactivate, reorder)
├── GameService.gs         # Nghiệp vụ ván đấu, getAppBootstrapData, saveGame, updateGame (STALE_DATA & Versioning)
├── SummaryService.gs      # Tổng kết và xếp hạng trong bộ nhớ (getScoreboard, rebuildSummarySheet)
├── AdminService.gs        # Quản trị, runPreDeploymentCheck, prepareCleanSpreadsheet, cleanupTestData, Backup & Export
├── Code.gs                # Điểm vào chính, setupApp(), getAppStatus(), include(), doGet(), doPost()
├── Test.gs                # Bộ test thủ công trực tiếp trên Apps Script Console
├── Index.html             # Layout chính Web App, Splash screen, Top bar branding, View containers, Modals
├── Styles.html            # CSS Mobile-First, Tokens, Splash Screen, Sync indicator, Stale modal
├── Components.html        # Logo SVG chính thức "Chốt Điểm", Favicon sprite, Icons WIN/DRAW/LOSE
├── Scripts.html           # Lớp GasClient tập trung, Quản lý state appState, bootstrapApp, exportData, healthCheck
├── docs/
│   ├── phase-1-business-and-data-design.md
│   ├── phase-2-backend-guide.md
│   ├── phase-3-frontend-guide.md
│   ├── phase-4-history-guide.md
│   ├── phase-5-integration-optimization-guide.md
│   ├── phase-6-test-plan.md
│   ├── phase-6-test-report.md
│   ├── phase-6-manual-device-checklist.md
│   ├── DEPLOYMENT.md              # [Phase 7] Hướng dẫn triển khai Web App từng bước
│   ├── HANDOVER_CHECKLIST.md      # [Phase 7] Checklist bàn giao dữ liệu sạch
│   ├── BACKUP_RESTORE.md          # [Phase 7] Hướng dẫn sao lưu và phục hồi dữ liệu
│   ├── USER_GUIDE.md              # [Phase 7] Hướng dẫn sử dụng 7 bước trên điện thoại
│   └── TEST_CHECKLIST_PHASE_7.md  # [Phase 7] Bảng tổng hợp kết quả kiểm thử Phase 7
├── src/                   # Core Pure logic modules (hỗ trợ test cục bộ)
└── tests/
    ├── phase1.test.js     # Test suite Phase 1 Core (21/21 passed)
    ├── phase2.test.js     # Test suite Phase 2 Backend Mock (18/18 passed)
    ├── phase3.test.js     # Test suite Phase 3 UI Structure (6/6 passed)
    ├── phase4.test.js     # Test suite Phase 4 History & Audit (13/13 passed)
    ├── phase5.test.js     # Test suite Phase 5 Integration & Multi-device (9/9 passed)
    ├── phase6.test.js     # Test suite Phase 6 QA & Concurrency (19/19 passed)
    └── phase7.test.js     # Test suite Phase 7 Deployment, Backup & Export (8/8 passed)
```

---

## 🚀 Hướng Dẫn Cài Đặt & Chạy Kiểm Thử

### 1. Chạy toàn bộ 85 Unit & Integration Tests
```bash
npm test
```

### 2. Triển khai lên Google Apps Script
Chi tiết xem tại tài liệu: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)

1. Mở Google Sheet > **Tiện ích mở rộng** > **Apps Script**.
2. Sao chép toàn bộ các file `.gs`, `.html` và `appsscript.json` vào dự án Apps Script.
3. Chạy hàm `prepareCleanSpreadsheet()` để tự động tạo cấu trúc 6 Sheet: `CAU_HINH`, `NGUOI_CHOI`, `VAN_DAU`, `TONG_KET`, `LICH_SU_THAY_DOI`, `NHAT_KY`.
4. Chạy hàm `runPreDeploymentCheck()` để kiểm tra sức khỏe hệ thống.
5. Bấm **Deploy** > **New deployment** > Chọn loại **Web app** > Cấp quyền truy cập để mở ứng dụng web trên điện thoại.

---

## 📄 Bản Quyền
Giấy phép MIT.
