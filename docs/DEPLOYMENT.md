# HƯỚNG DẪN TRIỂN KHAI GOOGLE APPS SCRIPT WEB APP (DEPLOYMENT GUIDE)
## DỰ ÁN: WEB APP "CHỐT ĐIỂM"

> **Slogan:** *Chạm nhanh, tính chuẩn, vui trọn cuộc chơi.*
> **Phiên bản:** 7.0.0
> **Tác giả:** Senior Software Engineer

---

## 1. ĐIỀU KIỆN TIÊN QUYẾT TRƯỚC KHI DEPLOY

1. **Tài khoản Google**: Tài khoản Google có quyền tạo và quản lý Google Sheets & Google Apps Script (tài khoản cá nhân `@gmail.com` hoặc Google Workspace).
2. **Google Spreadsheet mới hoặc hiện có**: Một Spreadsheet dùng làm cơ sở dữ liệu cho phiên chơi.
3. **Trình duyệt**: Khuyến nghị dùng Google Chrome, Safari hoặc Firefox phiên bản mới nhất.

---

## 2. QUY TRÌNH TRIỂN KHAI TỪNG BƯỚC

### Bước 1: Mở Trình chỉnh sửa Google Apps Script
1. Mở file Google Sheets của bạn.
2. Trên thanh menu, chọn: **Tiện ích mở rộng** (*Extensions*) > **Apps Script**.
3. Dự án Apps Script mới được tạo tự động liên kết với Spreadsheet này (Container-bound Script).

### Bước 2: Sao chép Mã nguồn Dự án
Tạo các file tương ứng trong Apps Script Editor với nội dung từ repository:

#### Các file mã nguồn Backend (`.gs`):
- `Config.gs`
- `Utils.gs`
- `PlayerService.gs`
- `SummaryService.gs`
- `GameService.gs`
- `AdminService.gs`
- `Code.gs`

#### Các file giao diện Frontend (`.html`):
- `Index.html`
- `Styles.html`
- `Components.html`
- `Scripts.html`

#### File cấu hình Manifest (`appsscript.json`):
1. Trong Apps Script, bấm vào biểu tượng ⚙️ **Cài đặt dự án** (*Project Settings*).
2. Tích chọn: *"Hiển thị tệp kê khai 'appsscript.json' trong trình chỉnh sửa"*.
3. Quay lại trình chỉnh sửa, dán nội dung từ `appsscript.json`:
   ```json
   {
     "timeZone": "Asia/Ho_Chi_Minh",
     "dependencies": {},
     "exceptionLogging": "STACKDRIVER",
     "runtimeVersion": "V8",
     "webapp": {
       "executeAs": "USER_DEPLOYING",
       "access": "ANYONE"
     },
     "oauthScopes": [
       "https://www.googleapis.com/auth/spreadsheets",
       "https://www.googleapis.com/auth/script.scriptapp"
     ]
   }
   ```

### Bước 3: Chạy Khởi tạo và Kiểm tra Sức khỏe Tiền Triển khai
1. Trong Apps Script Editor, trên thanh công cụ chọn hàm `prepareCleanSpreadsheet` và bấm **Chạy** (*Run*).
2. Chấp nhận cấp quyền lần đầu (OAuth Review Permissions).
3. Sau khi khởi tạo xong, chọn hàm `runPreDeploymentCheck` và bấm **Chạy**.
4. Mở tab **Nhật ký thực thi** (*Execution log*) và kiểm tra kết quả:
   - Tất cả 6 sheet (`CAU_HINH`, `NGUOI_CHOI`, `VAN_DAU`, `TONG_KET`, `LICH_SU_THAY_DOI`, `NHAT_KY`) đều báo `[PASS]`.
   - Cấu hình Tên app và Slogan được nhận diện đầy đủ.

### Bước 4: Thiết lập Script Properties (Tùy chọn cho Standalone Script)
Nếu triển khai Apps Script độc lập (Standalone Script không liên kết trực tiếp):
1. Mở **Project Settings** > **Script Properties** > **Add script property**.
2. Thêm thuộc tính:
   - **Property**: `SPREADSHEET_ID`
   - **Value**: `<ID_CỦA_GOOGLE_SHEET>` (Lấy từ URL: `https://docs.google.com/spreadsheets/d/<ID>/edit`)

### Bước 5: Tạo Bản Triển Khai Mới (New Deployment)
1. Ở góc trên bên phải màn hình Apps Script, bấm nút màu xanh: **Triển khai** (*Deploy*) > **Triển khai mới** (*New deployment*).
2. Bấm vào biểu tượng ⚙️ (chọn loại triển khai) > Chọn **Ứng dụng web** (*Web app*).
3. Điền các thông số:
   - **Mô tả** (*Description*): `Chốt Điểm Web App v1.0.0 - Production Release`
   - **Thực thi dưới dạng** (*Execute as*): **Tôi** (*Me - your_email@gmail.com*) - *Khuyến nghị để ứng dụng có quyền truy cập ổn định vào Sheets mà không bắt người chơi phải đăng nhập Google.*
   - **Người có quyền truy cập** (*Who has access*):
     - **Bất kỳ ai** (*Anyone*) - Để mọi người trong nhóm chơi có thể mở link trên điện thoại mà không cần cấp quyền tài khoản Google.
     - Hoặc **Bất kỳ ai có tài khoản Google** / **Chỉ mình tôi** tùy nhu cầu bảo mật.
4. Bấm **Triển khai** (*Deploy*).
5. Sao chép đường dẫn **URL ứng dụng web** (*Web App URL*).

---

## 3. CẬP NHẬT PHIÊN BẢN & ROLLBACK

### Khi có cập nhật mã nguồn mới:
1. Sửa code trong Apps Script Editor.
2. Bấm **Deploy** > **Quản lý các bản triển khai** (*Manage deployments*).
3. Chọn bản deployment đang hoạt động, bấm vào biểu tượng ✏️ **Chỉnh sửa** (*Edit*).
4. Ở mục **Phiên bản** (*Version*), chọn **Phiên bản mới** (*New version*).
5. Bấm **Triển khai** (*Deploy*). URL Web App vẫn giữ nguyên không đổi.

### Khi cần Rollback về phiên bản cũ:
1. Vào **Deploy** > **Manage deployments**.
2. Bấm ✏️ **Edit**.
3. Tại mục **Version**, chọn lại số phiên bản ổn định trước đó (ví dụ: Version 1).
4. Bấm **Deploy**. Hệ thống sẽ ngay lập tức quay về phiên bản cũ an toàn.

---

## 4. XÁC NHẬN SAU TRIỂN KHAI
- [ ] Mở Web App URL trên trình duyệt Safari / Chrome điện thoại: Splash screen xuất hiện Logo và Slogan, sau đó hiển thị Bảng điểm.
- [ ] Bấm nút "🛡️ Kiểm Tra Sức Khỏe Hệ Thống" trong tab Cài đặt: Hiện thông báo tất cả các kiểm tra đều đạt `[PASS]`.
- [ ] Thêm 2 người chơi và chốt thử 1 ván: Ván được ghi vào dòng mới của sheet `VAN_DAU`.
