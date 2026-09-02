# CHECKLIST KIỂM THỬ THIẾT BỊ VẬT LÝ & RESPONSIVE (PHASE 6)
## DỰ ÁN: WEB APP "CHỐT ĐIỂM"

> **Lưu ý minh bạch:** Các bài test trong `tests/phase6.test.js` được thực thi thông qua mô phỏng môi trường tự động (Automated Viewport & Token Inspection). Dưới đây là Checklist chi tiết dành cho QA / Người dùng kiểm thử trực tiếp trên thiết bị vật lý thật sau khi triển khai Web App.

---

## 1. MA TRẬN THIẾT BỊ & VIEWPORT CẦN KIỂM TRA

| Nhóm Thiết Bị | Kích Thước Viewport | Thiết Bị Mẫu Đại Diện | Trạng Thái Kiểm Tra |
| :--- | :--- | :--- | :--- |
| **Android Màn hình nhỏ** | 320px × 568px | Galaxy A01, Redmi Go | 🔍 Cần kiểm tra vật lý |
| **Android Phổ biến** | 360px - 412px | Galaxy S21/S22/S23, Pixel 7/8 | 🔍 Cần kiểm tra vật lý |
| **iPhone Màn hình nhỏ** | 375px × 667px | iPhone SE 2/3, iPhone 8 | 🔍 Cần kiểm tra vật lý |
| **iPhone Tai thỏ / Dynamic Island** | 390px - 430px | iPhone 13/14/15 Pro Max | 🔍 Cần kiểm tra vật lý |
| **Máy tính bảng (Tablet)** | 768px × 1024px | iPad Mini, iPad Air, Galaxy Tab | 🔍 Cần kiểm tra vật lý |
| **Máy tính để bàn (Desktop)** | 1200px+ | Chrome, Safari, Edge trên PC/Mac | 🔍 Cần kiểm tra vật lý |

---

## 2. BẢNG CHECKLIST THAO TÁC TRÊN THIẾT BỊ THẬT

### 📱 2.1. Màn hình Chào (Splash Screen) & Khởi động
- [ ] Khi mở link Web App, Splash screen hiển thị Logo SVG, Tên "Chốt Điểm", Slogan *"Chạm nhanh, tính chuẩn, vui trọn cuộc chơi."*
- [ ] Thanh tiến trình tải chạy đều trong khoảng 0.5s - 1.5s và tự mờ đi khi dữ liệu tải xong.
- [ ] Thử ngắt mạng khi mở app: Khối báo lỗi xuất hiện kèm nút "Thử Lại".

### 🎯 2.2. Màn hình Ván Mới (Nhập nhanh 6 bước)
- [ ] Chạm chọn Người Cầm Đầu (A): Chip chuyển sang màu xanh viền đậm có badge "Cầm đầu A".
- [ ] Chọn mức cược nhanh: Bấm chip 5, 10, 20 hoặc nhập số tùy ý.
- [ ] Danh sách người đối đầu:
  - Bấm nút `+ Thắng`: Nút chuyển xanh lá, hiển thị điểm `+5`.
  - Bấm nút `0 Hòa`: Nút chuyển xám, hiển thị điểm `0`.
  - Bấm nút `- Thua`: Nút chuyển đỏ, hiển thị điểm `-5`.
  - Bấm vào nhãn "Cược: X ✏️": Nhập mức cược riêng thành công.
- [ ] Điểm dự kiến bước 5: Hiển thị chính xác điểm đối ứng của Leader A (bằng số đối của tổng đối thủ).
- [ ] Chạm nút "Chốt Ván Đấu":
  - Nút chuyển trạng thái "⏳ Đang chốt ván..." và bị disable (chống chạm 2 lần).
  - Ván được lưu thành công, tự chuyển sang tab Bảng điểm.
  - Floating Banner "Hoàn tác (8s)" nổi ở đáy màn hình với thanh đếm ngược thời gian thực.
  - Bấm "Hoàn tác": Ván được hủy ngay lập tức và cập nhật lại điểm.

### 🏆 2.3. Màn hình Bảng Điểm & Xếp Hạng
- [ ] Hiển thị đầy đủ thứ hạng #1 (Vàng), #2 (Bạc), #3 (Đồng).
- [ ] Tổng điểm toàn bộ người chơi trên bảng xếp hạng cộng lại luôn bằng đúng 0.
- [ ] Thẻ người chơi hiển thị đầy đủ: Số ván tham gia, Thắng, Thua, Hòa, Số lần làm A.

### 📜 2.4. Màn hình Lịch Sử & Bộ Lọc
- [ ] Danh sách ván sắp xếp mới nhất lên đầu.
- [ ] Bấm nút "Bộ lọc": Panel mở ra mượt mà không che khuất màn hình.
- [ ] Lọc theo Người chơi, Người cầm đầu, Kết quả (Thắng/Hòa/Thua), Khoảng số ván.
- [ ] Chạm vào ván: Bottom sheet chi tiết mở lên, hiển thị đầy đủ bảng phân phối điểm.
- [ ] Thử nút "Sửa ván", "Hủy ván", "Khôi phục ván" với các hộp thoại xác nhận.

### 🔄 2.5. Kiểm thử Đa Thiết Bị (Multi-Device Sync)
- [ ] Mở app trên Thiết bị 1 và Thiết bị 2.
- [ ] Thiết bị 1 chốt ván #1 thành công.
- [ ] Thiết bị 2 bấm "Chốt Ván Đấu" mà chưa làm mới $\to$ Modal Cảnh báo "Dữ liệu trên máy đã cũ" xuất hiện.
- [ ] Dữ liệu đang chọn trên form của Thiết bị 2 được giữ nguyên, bấm "Làm Mới & Tiếp Tục" đồng bộ ván mới an toàn.
- [ ] Bấm nút Refresh trên Header: Icon xoay mượt mà và cập nhật thời gian "Đồng bộ: HH:MM".
