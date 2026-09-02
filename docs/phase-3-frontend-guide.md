# HƯỚNG DẪN GIAO DIỆN MOBILE FIRST (PHASE 3)
## DỰ ÁN: WEB APP "CHỐT ĐIỂM"

- **Phiên bản:** 3.0.0
- **Môi trường Frontend:** Google Apps Script HTML Service (HTML5 / CSS3 / JavaScript thuần)
- **Thiết kế:** Mobile First (Vùng chạm $\ge 48\text{px}$, Thao tác một tay, Phản hồi tức thì)
- **Tác giả:** Senior Frontend Engineer

---

## 1. TỔNG QUAN KIẾN TRÚC FRONTEND

Toàn bộ giao diện được xây dựng bằng HTML, CSS và JavaScript thuần túy, hoàn toàn tương thích với cơ chế include của **Google Apps Script HTML Service**:

```
├── Index.html             # Shell chính, View containers, Top Header, Bottom Nav, Toast
├── Styles.html            # Toàn bộ CSS (Mobile-First, CSS Variables, Responsive, Dark/Light friendly)
├── Components.html        # Reusable SVG Icons Sprite & Component definitions
├── Scripts.html           # Central appState, API Client Adapter (Promise), View Routing, Renderers, Toast
├── Code.gs                # include() helper & doGet() HTML Template Renderer
└── docs/
    ├── phase-1-business-and-data-design.md
    ├── phase-2-backend-guide.md
    └── phase-3-frontend-guide.md
```

---

## 2. 5 MÀN HÌNH CHÍNH & TRẢI NGHIỆM NGƯỜI DÙNG

### 2.1. Màn hình 1: Bảng Điểm (`scoreboard`)
- Hiển thị thứ hạng thi đấu (`rank`), Tên người chơi, Tổng điểm tích lũy (`totalScore`).
- **Highlight Top 3:**
  - Hạng 1: Viền vàng ánh kim + Rank badge vàng.
  - Hạng 2: Viền bạc.
  - Hạng 3: Viền đồng.
- Badge Người cầm đầu (`A Cầm đầu`), badge Người đã nghỉ (`Nghỉ`).
- Thống kê chi tiết số ván tham gia, tỉ lệ Thắng/Hòa/Bại, số lần làm A.
- Nút tắt tạo **+ Ván mới** nhanh ngay trên tiêu đề.
- Trạng thái: Loading Spinner, Empty State, Error State kèm nút Thử lại.

### 2.2. Màn hình 2: Ván Mới (`new-game`) - 6 Bước Chuẩn Hóa
Quy trình nhập kết quả được tối ưu cho tốc độ và thao tác một tay:
1. **Bước 1 - Chọn Người cầm đầu ($A$):** Danh sách dạng chips. Bấm chọn $A$ sẽ tự động loại $A$ khỏi danh sách đối thủ và tính toán lại bàn chơi.
2. **Bước 2 - Kiểm tra Mức cược ván:** Hiển thị mức cược mặc định. Cho phép sửa nhanh bằng inline numeric input (không tự động bật bàn phím nếu không bấm sửa).
3. **Bước 3 - Chọn kết quả từng đối thủ:** Mỗi đối thủ 1 card riêng với 3 nút bấm nhanh:
   - `+ Thắng (+bet)` (Màu xanh lá)
   - `0 Hòa` (Màu trung tính)
   - `- Thua (-bet)` (Màu đỏ)
   - *Vùng chạm tối thiểu $48\text{px}$, bấm 1 chạm cập nhật tức thì, không mở bàn phím.*
4. **Bước 4 - Điều chỉnh cược riêng:** Cho phép sửa cược riêng cho từng đối thủ cụ thể hoặc đặt lại theo cược chung.
5. **Bước 5 - Xem trước điểm dự kiến (Live Preview):**
   - Điểm của $A$: $\Delta_A = -\sum \Delta_{opp}$.
   - Tổng biến động: Luôn kiểm tra $\sum = 0$.
   - Cảnh báo người chưa chọn (mặc định sẽ tính là Hòa 0 điểm).
6. **Bước 6 - Chốt Ván (Sticky Button):** Nút lớn ở cuối màn hình, tự động khóa chống bấm đúp (`isSubmitting`), hiển thị spinner và tự động chuyển về Bảng điểm sau khi lưu thành công.

### 2.3. Màn hình 3: Lịch Sử (`history`)
- Danh sách ván đấu sắp xếp mới nhất lên đầu.
- Hiển thị Số ván, Thời gian, Tên $A$, Điểm biến động của $A$, Tags kết quả chi tiết của từng đối thủ.
- Hiển thị rõ các ván bị hủy (`DA_HUY`).

### 2.4. Màn hình 4: Người Chơi (`players`)
- Form thêm người chơi mới (kiểm tra tên, chống gửi lặp, phản hồi nhanh).
- Danh sách người chơi đang hoạt động và người đã ngừng chơi (`NGUNG_CHOI`).
- Nút đánh dấu nghỉ chơi (Soft-deactivate an toàn, không mất lịch sử).

### 2.5. Màn hình 5: Cài Đặt (`settings`)
- Hiển thị thông tin phiên chơi (Mã phiên, Tên phiên, Mức cược mặc định, Timezone, Phiên bản Schema).
- Nút **🔄 Đồng bộ lại Bảng Tổng Kết** gọi `rebuildSummarySheet()`.

---

## 3. CÁC TÍNH NĂNG KỸ THUẬT NỔI BẬT

1. **SPA Không Tải Lại Trang:** Chuyển đổi giữa 5 màn hình mượt mà qua hàm `navigateTo(viewName)`.
2. **Adapter API Độc Lập:** `apiClient.call(functionName, ...args)` bọc `google.script.run` trả về `Promise`, tự động bắt lỗi và hỗ trợ Mock khi chạy thử độc lập.
3. **Chống XSS Tuyệt Đối:** Mọi dữ liệu văn bản từ người dùng đều được escape hoặc render qua `textContent` / DOM APIs.
4. **Hệ Thống Toast Notification:** Thông báo góc trên/dưới với `aria-live="polite"`, tự biến mất sau 3 giây.
5. **Chống Nhấn Lặp (Idempotent Click):** Nút Chốt Ván tự động kích hoạt trạng thái `isSubmitting = true` và disable ngay sau cú chạm đầu tiên.
6. **Responsive & Mobile-First:** Tối ưu kích thước chạm $\ge 48\text{px}$, hỗ trợ iPhone safe-area-inset, tự căn giữa đẹp mắt trên máy tính bảng và desktop (`max-width: 600px`).

---

## 4. KẾT QUẢ KIỂM THỬ

- **Kiểm thử tự động:** `npm test` bao gồm toàn bộ 3 Phase:
  - Phase 1 Core Test: 21/21 passed.
  - Phase 2 Backend Mock Test: 18/18 passed.
  - Phase 3 UI Structure & Client Logic Test: 6/6 passed.
  - **Tổng cộng:** **45/45 Test Cases PASSED (100%)**.
