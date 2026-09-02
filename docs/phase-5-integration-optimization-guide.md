# HƯỚNG DẪN TÍCH HỢP, TỐI ƯU & ĐA THIẾT BỊ (PHASE 5)
## DỰ ÁN: WEB APP "CHỐT ĐIỂM"

- **Tên ứng dụng:** Chốt Điểm
- **Slogan:** *Chạm nhanh, tính chuẩn, vui trọn cuộc chơi.*
- **Phiên bản:** 5.0.0
- **Phạm vi thi công:** Phase 5 - Tích hợp Frontend & Backend, Tối ưu tốc độ & Caching, Bảo vệ đồng thời đa thiết bị (STALE_DATA & Idempotency), Hoàn thiện nhận diện thương hiệu (Logo, Slogan, Splash Screen, CSS Tokens).
- **Tác giả:** Senior Full-stack Engineer

---

## 1. TỔNG QUAN KIẾN TRÚC & NÂNG CẤP PHASE 5

```
├── Config.gs              # Thêm APP_INFO (Name, Slogan), Cache settings, Error codes STALE_DATA/DUPLICATE_REQUEST
├── Utils.gs               # Chuẩn hóa responseOk/responseError (kèm success, meta), CacheService wrappers, getLatestGameNumber()
├── PlayerService.gs       # Tích hợp CacheService cho getPlayers(), tự động xóa cache khi thêm/sửa/nghỉ chơi
├── GameService.gs         # getAppBootstrapData() composite API, saveGame() với kiểm tra expectedLatestGameNumber & requestId
├── SummaryService.gs      # Đọc batch và tính điểm tối ưu trong bộ nhớ
├── Code.gs                # Khởi tạo slogan trong CAU_HINH, bổ sung router getAppBootstrapData
├── Index.html             # Favicon SVG inline, Splash screen #splash-screen, Top header branding & sync label, Stale Data Modal
├── Styles.html            # CSS Color Tokens (--color-win, --color-lose, --color-draw...), Splash Screen, Sync indicator, Stale modal
├── Components.html        # Logo SVG chính thức "Chốt Điểm", SVG Icons WIN/DRAW/LOSE, Warning, Refresh
├── Scripts.html           # Lớp GasClient tập trung, Quản lý state appState, bootstrapApp, refreshAppData, STALE_DATA handling
└── tests/
    └── phase5.test.js     # 9 test cases tự động kiểm tra toàn bộ luồng tích hợp, tối ưu, đa thiết bị và nhận diện thương hiệu
```

---

## 2. NỘI DUNG 4 NHIỆM VỤ ĐÃ HOÀN THÀNH

### Task 5.1: Kết nối Frontend với Backend
- Xây dựng lớp trung gian `GasClient` bọc toàn bộ `google.script.run`, cung cấp giao thức chuẩn dựa trên `Promise`, hỗ trợ `async/await`, timeout 25s và fallback mock thông minh.
- Chuẩn hóa cấu trúc Request & Response:
  ```json
  {
    "ok": true,
    "success": true,
    "data": { ... },
    "message": "Thông báo thân thiện",
    "errorCode": null,
    "error": null,
    "meta": {
      "latestGameNumber": 1,
      "serverTimestamp": "2026-09-02T19:00:00.000Z"
    }
  }
  ```
- Xử lý trạng thái loading, khóa nút "Chốt ván" chống double-click (`isSubmitting = true`), hiển thị Toast thông báo đẹp mắt.

### Task 5.2: Tối ưu tốc độ & Caching
- **API Khởi tạo Composite `getAppBootstrapData()`**: Gom toàn bộ thông tin phiên (`session`), danh sách người chơi (`players`), bảng xếp hạng (`scoreboard`), ván gần nhất (`recentGames`) và số ván mới nhất (`latestGameNumber`) vào đúng **1 roundtrip duy nhất** khi mở app.
- **Tầng Cache với Google Apps Script `CacheService`**:
  - Cache cấu hình và danh sách người chơi (`CHOT_DIEM_PLAYERS_ACTIVE`, `CHOT_DIEM_PLAYERS_ALL`) với thời gian sống 10 phút.
  - Tự động xóa cache (Invalidation) ngay khi thêm người chơi, sửa tên, cho nghỉ chơi hoặc sắp xếp lại thứ tự.
- **Tối ưu đọc/ghi Google Sheets**:
  - Đọc batch toàn bộ dải dữ liệu một lần bằng `getRange().getValues()` và xử lý trong RAM.
  - Hàm `getLatestGameNumber(ss)` đọc trực tiếp ô số ván dòng cuối cùng không cần quét bảng.

### Task 5.3: Hỗ trợ nhiều thiết bị (Multi-Device Protection)
- **Nút Làm mới & Nhãn đồng bộ**: Nút xoay mượt mà ở góc phải Header kèm nhãn thời gian "Đồng bộ: 14:05".
- **Cơ chế `expectedLatestGameNumber` & `STALE_DATA`**:
  - Khi chốt ván, Frontend gửi kèm số ván mới nhất hiện tại trên máy mình (`expectedLatestGameNumber`).
  - Trong lock, nếu Backend phát hiện số ván thực tế trên Sheets lớn hơn (do thiết bị khác vừa chốt ván trước) $\to$ Trả về mã lỗi `STALE_DATA`.
  - Frontend hiển thị hộp cảnh báo `#modal-stale-data`: *"Có ván mới (#X) được lưu từ thiết bị khác. Dữ liệu trên máy này đã cũ."*
  - Toàn bộ lựa chọn hiện tại trên form Ván mới **được bảo lưu nguyên vẹn**. Người dùng chỉ cần bấm *"Làm Mới & Tiếp Tục"* để đồng bộ rồi chốt lại an toàn.
- **Chống lưu trùng (`requestId` Idempotency)**: Mỗi request lưu ván mang một UUID `requestId`. Backend lưu cột `MA_REQUEST` trong sheet `VAN_DAU`; nếu nhận cùng một request ID sẽ trả về kết quả đã ghi nhận mà không sinh thêm dòng mới.

### Task 5.4: Hoàn thiện nhận diện app (Branding & Identity)
- **Tên chính thức:** **Chốt Điểm**
- **Slogan chính thức:** **Chạm nhanh, tính chuẩn, vui trọn cuộc chơi.**
- **Logo SVG:** Biểu tượng huy hiệu tâm ngắm tròn kết hợp các chấm điểm năng động và dấu tick mạ vàng trên nền xanh Google Blue.
- **Favicon:** Data URI SVG inline tương thích 100% với HTML Service.
- **CSS Color Tokens chuẩn hóa:** `--color-primary`, `--color-win`, `--color-draw`, `--color-lose`, `--color-surface`, `--color-text`...
- **Icons trạng thái:** Icon Thắng (`+ Thắng` xanh Check), Hòa (`0 Hòa` xám Minus), Thua (`- Thua` đỏ Cross) to rõ, hỗ trợ tiếp cận (A11y).
- **Màn hình chào (Splash Screen):** Hiển thị Logo nảy nhẹ, Tên, Slogan và thanh tải dữ liệu mượt mà, tự động chuyển vào app khi dữ liệu sẵn sàng; có nút "Thử lại" nếu mạng lỗi.

---

## 3. KẾT QUẢ KIỂM THỬ TOÀN DIỆN (67/67 PASSED)

Chạy lệnh: `npm test`
- **Phase 1 (Core Invariants & Data Design):** 21/21 passed.
- **Phase 2 (Backend Services & Sheet Engine):** 18/18 passed.
- **Phase 3 (Mobile-First UI Structure):** 6/6 passed.
- **Phase 4 (History, Details, Filters & Undo):** 13/13 passed.
- **Phase 5 (Integration, Cache, Multi-Device & Branding):** 9/9 passed.
- **Tổng cộng:** **67/67 Test Cases PASSED (100%)**.
