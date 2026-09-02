# HƯỚNG DẪN TRIỂN KHAI & TÀI LIỆU BACKEND (PHASE 2)
## DỰ ÁN: WEB APP "CHỐT ĐIỂM"

- **Phiên bản:** 2.0.0
- **Môi trường Backend:** Google Apps Script (V8 Runtime) & Google Sheets Cơ sở dữ liệu
- **Múi giờ:** `Asia/Ho_Chi_Minh`
- **Tác giả:** Senior Google Apps Script Backend Engineer

---

## 1. CẤU TRÚC FILE BACKEND

Toàn bộ mã nguồn backend được tổ chức theo kiến trúc module hóa độc lập, chuẩn Apps Script V8:

```
├── appsscript.json        # Apps Script Manifest (V8, Asia/Ho_Chi_Minh, OAuth scopes tối thiểu)
├── Config.gs              # Hằng số, Tên sheet, Header, Key cấu hình, Enums & Error codes
├── Utils.gs               # Tiện ích chung: Response wrapper, LockService, ID generator, Header mapping
├── PlayerService.gs       # Quản lý người chơi: getPlayers, addPlayer, updatePlayer, deactivatePlayer, reorderPlayers
├── GameService.gs         # Nghiệp vụ ván đấu: saveGame, getGameHistory, getGameById, updateGame, cancelGame, restoreGame
├── SummaryService.gs      # Tổng hợp và xếp hạng: getScoreboard (Competition ranking 1-2-2-4), rebuildSummarySheet
├── Code.gs                # Điểm vào ứng dụng: setupApp, getAppStatus, doGet, doPost Web App router
├── Test.gs                # Bộ test thủ công trực tiếp trên Apps Script Console (runPhase2Tests)
├── docs/
│   ├── phase-1-business-and-data-design.md
│   └── phase-2-backend-guide.md
└── tests/
    ├── phase1.test.js     # Unit test Phase 1
    └── phase2.test.js     # Mock test toàn diện Phase 2
```

---

## 2. HƯỚNG DẪN THIẾT LẬP GOOGLE APPS SCRIPT VỚI SPREADSHEET

### Bước 1: Tạo Spreadsheet mới
1. Truy cập [Google Sheets](https://sheets.new) và tạo một trang tính Google mới.
2. Đặt tên trang tính: `Chốt Điểm - Phiên Chơi [Ngày/Tên buổi]`.

### Bước 2: Mở Apps Script liên kết (Container-bound Script)
1. Trên thanh menu của Google Sheets, chọn **Tiện ích mở rộng (Extensions)** > **Apps Script**.
2. Đổi tên dự án Apps Script thành: `ChotDiem-Backend`.

### Bước 3: Sao chép mã nguồn vào Apps Script
Tạo các file `.gs` tương ứng và dán nội dung từ repository:
- `appsscript.json` (Bật hiển thị manifest trong *Project Settings* > *Show "appsscript.json" manifest file in editor* nếu cần).
- `Config.gs`
- `Utils.gs`
- `PlayerService.gs`
- `SummaryService.gs`
- `GameService.gs`
- `Code.gs`
- `Test.gs`

### Bước 4: Chạy `setupApp()` & Cấp quyền lần đầu
1. Trên thanh công cụ Apps Script, chọn hàm `setupApp` từ danh sách dropdown.
2. Bấm nút **Chạy (Run)**.
3. Khi hộp thoại **Yêu cầu cấp quyền (Authorization Required)** xuất hiện:
   - Bấm **Xem lại quyền (Review Permissions)**.
   - Chọn tài khoản Google của bạn.
   - Bấm **Nâng cao (Advanced)** > **Đi tới ChotDiem-Backend (Không an toàn)**.
   - Bấm **Cho phép (Allow)**.
4. Sau khi chạy xong, mở lại tab Google Sheets: bạn sẽ thấy 4 sheet nghiệp vụ (`CAU_HINH`, `NGUOI_CHOI`, `VAN_DAU`, `TONG_KET`) đã được tạo tự động với đầy đủ header, định dạng in đậm và freeze dòng 1.

---

## 3. DANH SÁCH SHEET VÀ CỘT (SCHEMA)

### 3.1. Sheet `CAU_HINH`
- **Mô hình:** Key-Value (2 cột).
- **Header:** `KHOA` | `GIA_TRI`
- **8 Khóa bắt buộc:** `TEN_APP`, `MA_PHIEN`, `TEN_PHIEN`, `CUOC_MAC_DINH`, `THOI_GIAN_TAO`, `TRANG_THAI`, `TIMEZONE`, `SCHEMA_VERSION`.

### 3.2. Sheet `NGUOI_CHOI`
- **Header:** `MA_NGUOI_CHOI` | `TEN_NGUOI_CHOI` | `THU_TU` | `TRANG_THAI` | `THOI_GIAN_THEM`
- **Trạng thái:** `DANG_CHOI`, `NGUNG_CHOI`.

### 3.3. Sheet `VAN_DAU` (1 ván = đúng 1 dòng)
- **Header:** `MA_VAN` | `SO_VAN` | `THOI_GIAN` | `MA_NGUOI_CAM_DAU` | `TEN_NGUOI_CAM_DAU` | `CUOC_MAC_DINH` | `CHI_TIET_JSON` | `DIEM_CAM_DAU` | `TONG_GIAO_DICH` | `GHI_CHU` | `TRANG_THAI`
- **Trạng thái:** `HOP_LE`, `DA_HUY`.

### 3.4. Sheet `TONG_KET` (Bảng dữ liệu dẫn xuất)
- **Header:** `MA_NGUOI_CHOI` | `TEN_NGUOI_CHOI` | `SO_VAN_THAM_GIA` | `SO_LAN_CAM_DAU` | `SO_LAN_THANG` | `SO_LAN_HOA` | `SO_LAN_THUA` | `TONG_DIEM` | `XEP_HANG`

---

## 4. PUBLIC API ĐÃ TRIỂN KHAI

Tất cả các hàm public đều trả về cấu trúc chuẩn:
- **Thành công:** `{ ok: true, data: ..., message: "..." }`
- **Thất bại:** `{ ok: false, error: { code: "...", message: "...", details: null } }`

### 4.1. Nhóm Khởi tạo & Hệ thống
- `setupApp(customConfig)`: Khởi tạo 4 sheet, định dạng và cấu hình ban đầu (Idempotent).
- `getAppStatus()`: Kiểm tra trạng thái hệ thống, phiên bản, tổng số người chơi, số ván.

### 4.2. Nhóm Người chơi (`PlayerService.gs`)
- `getPlayers(includeInactive)`: Lấy danh sách người chơi (mặc định chỉ lấy `active: true`).
- `addPlayer(name)`: Thêm người chơi mới (sinh ID `P001`, `P002`..., check trùng tên, có lock).
- `updatePlayer(playerId, data)`: Đổi tên hiển thị / trạng thái (check trùng tên, có lock).
- `deactivatePlayer(playerId)`: Vô hiệu hóa mềm (`NGUNG_CHOI`), không xóa lịch sử ván.
- `reorderPlayers(playerIds)`: Cập nhật thứ tự hiển thị `THU_TU` theo mảng ID (batch update có lock).

### 4.3. Nhóm Ván đấu (`GameService.gs`)
- `saveGame(gameData)`: Validate, tự tính toán toàn bộ delta, kiểm tra zero-sum, cấp số ván, lưu 1 dòng vào `VAN_DAU` và trả về ván cùng `scoreboard` mới (có lock).
- `getGameHistory(options)`: Đọc lịch sử ván đấu (mặc định lấy `HOP_LE`, parse JSON an toàn, sắp xếp mới nhất trước).
- `getGameById(gameId)`: Lấy chi tiết ván theo mã định danh.
- `updateGame(gameId, gameData)`: Sửa ván tại chỗ (giữ nguyên ID & số ván, tính lại delta, re-verify zero-sum, có lock).
- `cancelGame(gameId)`: Hủy mềm ván đấu (đổi trạng thái thành `DA_HUY`, loại khỏi bảng tổng kết, có lock).
- `restoreGame(gameId)`: Khôi phục ván đấu bị hủy (đổi lại `HOP_LE`, tính lại điểm tổng kết, có lock).

### 4.4. Nhóm Tổng kết (`SummaryService.gs`)
- `getScoreboard(sessionId)`: Tính toán động bảng thành tích & thứ hạng thi đấu (1, 2, 2, 4) cho toàn bộ người chơi.
- `rebuildSummarySheet()`: Tái tạo và ghi đè dữ liệu mới nhất vào sheet `TONG_KET`.

---

## 5. CẤU TRÚC DỮ LIỆU ĐẦU VÀO VÀ JSON

### 5.1. Cấu trúc `gameData` gửi lên `saveGame()`
```json
{
  "leaderId": "P001",
  "defaultBet": 5,
  "playedAt": "2026-09-02T19:30:00.000Z",
  "note": "Ván đấu thứ nhất",
  "opponents": [
    {
      "playerId": "P002",
      "result": "WIN",
      "bet": 5
    },
    {
      "playerId": "P003",
      "result": "LOSE",
      "bet": 10
    },
    {
      "playerId": "P004",
      "result": "DRAW"
    }
  ]
}
```

### 5.2. Cấu trúc `CHI_TIET_JSON` lưu trong ô của sheet `VAN_DAU`
```json
[
  {
    "playerId": "P002",
    "name": "Bình",
    "result": "WIN",
    "bet": 5,
    "delta": 5
  },
  {
    "playerId": "P003",
    "name": "Cường",
    "result": "LOSE",
    "bet": 10,
    "delta": -10
  },
  {
    "playerId": "P004",
    "name": "Dũng",
    "result": "DRAW",
    "bet": 5,
    "delta": 0
  }
]
```

---

## 6. QUY TẮC TÍNH ĐIỂM & BẢO TOÀN

1. **Người đối đầu $i$:**
   - $\text{WIN} \implies \Delta_i = +bet_i$
   - $\text{LOSE} \implies \Delta_i = -bet_i$
   - $\text{DRAW} \implies \Delta_i = 0$
2. **Người cầm đầu $A$:**
   - $\Delta_A = -\sum \Delta_{opp}$
3. **Bảo toàn điểm số (Zero-sum Invariant):**
   - $\Delta_A + \sum \Delta_{opp} = 0$
4. **Tổng giao dịch:** $\sum |\Delta_{opp}|$ (không cộng thêm $|\Delta_A|$).

---

## 7. CƠ CHẾ KHÓA ĐỒNG THỜI (LOCKSERVICE)

Mọi thao tác ghi dữ liệu (`addPlayer`, `updatePlayer`, `deactivatePlayer`, `reorderPlayers`, `saveGame`, `updateGame`, `cancelGame`, `restoreGame`) đều được bảo vệ bằng helper:

```javascript
withDocumentLock(callback, timeoutMs);
```

- **Cơ chế:** Thử lấy Document Lock trong 10 giây (`CONFIG.DEFAULTS.LOCK_TIMEOUT_MS`). Nếu quá thời gian, trả về mã lỗi `LOCK_TIMEOUT` an toàn thay vì ghi đè chéo dữ liệu.
- **Giải phóng:** Luôn gọi `releaseLock()` trong khối `finally`.

---

## 8. HƯỚNG DẪN KIỂM THỬ THỦ CÔNG TRÊN APPS SCRIPT

1. Mở Apps Script Console từ Google Sheets.
2. Chọn file `Test.gs`.
3. Chọn hàm `runPhase2Tests` trên thanh công cụ và bấm **Chạy (Run)**.
4. Xem log thực thi ở bảng **Nhật ký thực thi (Execution Log)**:
   - Kiểm tra kết quả toàn bộ các hạng mục: Scoring, setupApp, PlayerService, GameService (Save/Update/Cancel/Restore), Scoreboard.
   - Đảm bảo toàn bộ các mục đều báo `[PASS]`.
5. Mở lại Google Sheets để kiểm tra:
   - Sheet `VAN_DAU`: Mỗi ván chỉ chiếm đúng 1 dòng.
   - Cột `CHI_TIET_JSON`: Chứa đúng mảng JSON của các đối thủ.
   - Sheet `TONG_KET`: Điểm tổng toàn bộ người chơi triệt tiêu về 0.

---

## 9. GIẢ ĐỊNH & CÁC VẤN ĐỀ THUỘC PHASE SAU

### 9.1. Giả định đã dùng
- Dự án là Container-bound Script gắn trực tiếp với Google Sheets của phiên chơi.
- Múi giờ mặc định toàn phiên là `Asia/Ho_Chi_Minh`.
- Điểm số và mức cược trong phiên bản này là số nguyên không âm ($\ge 0$).

### 9.2. Phạm vi thuộc các Phase tiếp theo
- **Phase 3 trở đi:** Xây dựng giao diện người dùng Mobile Web App (HTML/CSS/JS), màn hình nhập điểm chạm nhanh, giao diện lịch sử ván và bảng tổng kết trực quan.
- Triển khai Web App Deployment chính thức (URL doGet/doPost).
