# TÀI LIỆU ĐẶC TẢ NGHIỆP VỤ VÀ THIẾT KẾ DỮ LIỆU (PHASE 1)
## DỰ ÁN: WEB APP "CHỐT ĐIỂM"

- **Phiên bản tài liệu:** 1.0.0
- **Trạng thái:** Chốt đặc tả Phase 1 (Data Design & Business Rules)
- **Tác giả:** Senior Business Analyst, Solution Architect & Google Apps Script Developer
- **Mục tiêu:** Định nghĩa chuẩn hóa toàn bộ nghiệp vụ tính điểm, quy tắc dữ liệu, cấu trúc lưu trữ Google Sheets và mô hình dữ liệu nền tảng cho ứng dụng "Chốt Điểm".

---

## 1. TỔNG QUAN VÀ PHẠM VI PHASE 1

### 1.1. Bối cảnh dự án
Ứng dụng **"Chốt Điểm"** là một giải pháp Web App di động gọn nhẹ kết hợp với Google Apps Script (GAS) và Google Sheets làm cơ sở dữ liệu. Ứng dụng hỗ trợ ghi nhận, tính toán và theo dõi biến động điểm số theo từng ván chơi trong các buổi sinh hoạt/trò chơi đối kháng nhiều người.

### 1.2. Mục tiêu Phase 1
- Chuẩn hóa toàn bộ thuật ngữ chuyên môn dùng trong dự án.
- Chốt công thức tính điểm toán học và điều kiện bảo toàn điểm số (Zero-sum invariant).
- Chốt các quy tắc kiểm tra tính hợp lệ dữ liệu (Validation rules) và xử lý các trường hợp biên/ngoại lệ (Edge cases).
- Thiết kế chi tiết cấu trúc 4 Sheet nghiệp vụ trong Google Spreadsheet.
- Định nghĩa mô hình dữ liệu nội bộ (Data Models) và chuẩn hóa giao tiếp JSON/Apps Script.
- Xây dựng các hàm lõi thuần túy (Pure functions) và bộ kiểm thử tự động (Unit Test Suite) phục vụ kiểm chứng logic.

### 1.3. Giới hạn phạm vi (Out of Scope for Phase 1)
- Không xây dựng giao diện người dùng (UI/HTML/CSS).
- Không xây dựng màn hình nhập điểm hoặc màn hình lịch sử.
- Không triển khai Web App deployment (doGet/doPost API wrapper đầy đủ).
- Không tạo hệ thống phân quyền/tài khoản hay mã phòng phức tạp.
- Không thực hiện các nghiệp vụ thuộc Phase 2 trở đi.

---

## 2. TỪ ĐIỂN THUẬT NGỮ (GLOSSARY)

| Thuật ngữ tiếng Việt | Thuật ngữ kỹ thuật | Định nghĩa & Phạm vi áp dụng |
| :--- | :--- | :--- |
| **Phiên chơi** | `Session` | Một buổi chơi hoàn chỉnh từ lúc bắt đầu đến khi kết thúc. Mỗi phiên chơi được lưu trữ độc lập trong đúng một tệp Google Spreadsheet riêng biệt. |
| **Ván đấu** | `Round` | Một lượt chơi/lượt tính điểm đơn vị trong phiên chơi. Mỗi ván đấu được ghi lại trên đúng một dòng duy nhất của sheet `VAN_DAU`. |
| **Người cầm đầu** | `Leader` (Ký hiệu: `A`) | Người chơi được chỉ định làm mốc trung tâm so điểm với tất cả những người chơi khác trong một ván đấu cụ thể. Mỗi ván có đúng 1 người cầm đầu. |
| **Người đối đầu** | `Opponent` | Những người chơi tham gia ván đấu so điểm trực tiếp với Người cầm đầu `A`. Trong một ván có từ 1 đến nhiều người đối đầu. |
| **Mức cược mặc định** | `Default Bet` | Mức điểm cược cơ sở áp dụng cho ván đấu, được lấy từ cấu hình phiên hoặc do người dùng chỉnh cho ván đấu đó. |
| **Mức cược hiệu lực** | `Effective Bet` (`bet`) | Mức điểm cược áp dụng thực tế cho một người đối đầu cụ thể. Nếu người đó có mức cược riêng thì dùng cược riêng; nếu không, áp dụng mức cược mặc định của ván. |
| **Biến động điểm** | `Delta` ($\Delta$) | Số điểm thay đổi (tăng `+`, giảm `-`, hoặc giữ nguyên `0`) của một người chơi sau khi ván đấu kết thúc. |
| **Tổng giao dịch** | `Transaction Total` | Tổng giá trị khối lượng điểm luân chuyển giữa các người đối đầu và người cầm đầu trong ván: $\sum |\Delta_{opp}|$. |
| **Chi tiết ván đấu** | `Round Details` | Mảng danh sách kết quả đối đầu của tất cả người đối đầu trong ván (không bao gồm A), được mã hóa dưới dạng chuỗi JSON lưu trong cột `CHI_TIET_JSON`. |
| **Xếp hạng thi đấu** | `Competition Ranking` | Phương thức xếp hạng tiêu chuẩn thể thao (1224 ranking), trong đó những người bằng điểm nhận cùng thứ hạng và thứ hạng kế tiếp sẽ bị nhảy cách. |

---

## 3. QUY TẮC TÍNH ĐIỂM TOÁN HỌC

### 3.1. Điểm của Người đối đầu (Opponent Delta)
Với mỗi người đối đầu $i$ ($i \ne A$), biến động điểm $\Delta_i$ được tính dựa trên kết quả so điểm với $A$ và mức cược hiệu lực $bet_i$:

$$\Delta_i = \begin{cases} +bet_i & \text{khi } result_i = \text{WIN (Thắng)} \\ -bet_i & \text{khi } result_i = \text{LOSE (Thua)} \\ 0 & \text{khi } result_i = \text{DRAW (Hòa)} \end{cases}$$

Trong đó:
- $bet_i$ là số nguyên không âm ($\ge 0$).
- Nếu người chơi có mức cược riêng được chỉ định: $bet_i = customBet_i$.
- Nếu người chơi không chỉ định cược riêng (null/undefined): $bet_i = defaultBet_{round}$.

### 3.2. Điểm của Người cầm đầu (Leader Delta)
Người cầm đầu $A$ là đối trọng tài chính của toàn bộ bàn chơi. Biến động điểm của $A$ ($\Delta_A$) bằng số đối của tổng tất cả biến động điểm của các người đối đầu:

$$\Delta_A = -\sum_{i=1}^{n} \Delta_i$$

### 3.3. Điều kiện bất biến bảo toàn điểm số (Zero-Sum Invariant)
Trong mọi ván đấu hợp lệ, tổng biến động điểm của toàn bộ người tham gia (bao gồm Người cầm đầu và tất cả Người đối đầu) bắt buộc phải triệt tiêu về 0:

$$\Delta_A + \sum_{i=1}^{n} \Delta_i = 0 \iff \sum_{p \in Participants} \Delta_p = 0$$

*Bất kỳ ván đấu nào vi phạm điều kiện này đều bị hệ thống từ chối ghi nhận vào cơ sở dữ liệu.*

### 3.4. Công thức Tổng giao dịch ván (Transaction Total)
Tổng khối lượng giao dịch thể hiện quy mô điểm luân chuyển trong ván đấu:

$$\text{Transaction Total} = \sum_{i=1}^{n} |\Delta_i|$$

> **Lưu ý quan trọng:** Không cộng thêm $|\Delta_A|$ vào tổng giao dịch để tránh hiện tượng tính trùng (Double Counting), vì toàn bộ điểm thắng/thua của các đối thủ đều đối ứng trực tiếp 1-1 với $A$.

### 3.5. Ví dụ minh họa tính điểm

#### Ví dụ 1: Bàn chơi 4 người, cược mặc định và cược riêng hỗn hợp
- **Mức cược mặc định của ván:** 5
- **Người cầm đầu ($A$):** P001 (An)
- **Danh sách người đối đầu:**
  1. **P002 (Bình):** Kết quả `WIN`, không cược riêng $\rightarrow bet = 5 \implies \Delta_{P002} = +5$
  2. **P003 (Cường):** Kết quả `LOSE`, cược riêng $10 \rightarrow bet = 10 \implies \Delta_{P003} = -10$
  3. **P004 (Dũng):** Kết quả `DRAW`, không cược riêng $\rightarrow bet = 5 \implies \Delta_{P004} = 0$
- **Tính toán:**
  - Tổng $\Delta$ đối đầu: $(+5) + (-10) + (0) = -5$
  - Biến động điểm của $A$ (P001): $-(-5) = +5$
  - Kiểm tra điều kiện bất biến: $\Delta_{P001} + \Delta_{P002} + \Delta_{P003} + \Delta_{P004} = (+5) + (+5) + (-10) + (0) = 0$ (Hợp lệ)
  - Tổng giao dịch ván: $|+5| + |-10| + |0| = 15$

#### Ví dụ 2: Bàn chơi 3 người, cược 0 điểm
- **Mức cược mặc định:** 10
- **Người cầm đầu ($A$):** P002 (Bình)
- **Danh sách người đối đầu:**
  1. **P001 (An):** Kết quả `LOSE`, cược riêng $0 \rightarrow bet = 0 \implies \Delta_{P001} = 0$
  2. **P003 (Cường):** Kết quả `WIN`, cược mặc định $10 \rightarrow bet = 10 \implies \Delta_{P003} = +10$
- **Tính toán:**
  - Tổng $\Delta$ đối đầu: $0 + 10 = +10$
  - Biến động điểm của $A$ (P002): $-(+10) = -10$
  - Tổng biến động: $-10 + 0 + 10 = 0$ (Hợp lệ)
  - Tổng giao dịch: $|0| + |+10| = 10$

---

## 4. QUY TẮC NGHIỆP VỤ & XỬ LÝ NGOẠI LỆ

Hệ thống tuân thủ nghiêm ngặt 13 quy tắc nghiệp vụ sau:

1. **Bắt buộc chọn Người cầm đầu:** Không cho phép lưu ván đấu nếu chưa xác định Người cầm đầu (`leaderId`).
2. **Kiểm tra tính hợp lệ của Người cầm đầu ($A$):**
   - $A$ phải tồn tại trong danh bạ `NGUOI_CHOI`.
   - $A$ phải đang ở trạng thái `DANG_CHOI` tại thời điểm tạo ván.
   - $A$ tuyệt đối không được xuất hiện trong mảng `CHI_TIET_JSON`.
   - $A$ không được tự so điểm với chính mình.
3. **Kiểm tra tính hợp lệ của Người đối đầu:**
   - Mỗi người đối đầu phải tồn tại trong `NGUOI_CHOI` và có trạng thái `DANG_CHOI`.
   - Không được trùng lặp `playerId` trong danh sách người đối đầu của cùng một ván.
   - Không được chứa `playerId` trùng với $A$.
4. **Tập kết quả hợp lệ:** Chỉ chấp nhận đúng 3 giá trị chuỗi hoa: `WIN`, `DRAW`, `LOSE`.
5. **Chuẩn hóa giá trị thiếu (Missing Result Defaulting):**
   - Nếu một người đối đầu tham gia ván nhưng chưa được chọn kết quả, hệ thống tự động chuẩn hóa thành `DRAW` ($\Delta = 0$).
   - Trên tầng UI (các phase sau), hệ thống sẽ hiển thị cảnh báo xác nhận trước khi lưu. Tầng Core Logic đảm bảo tự động fallback an toàn về `DRAW`.
6. **Quy chuẩn Mức cược (Bet Sanitization):**
   - Mức cược phải là số hữu hạn, nguyên (Integer), lớn hơn hoặc bằng 0 ($bet \ge 0$).
   - Từ chối `NaN`, chuỗi không chuyển đổi được, số âm hoặc số thập phân/phân số.
   - Mức cược bằng 0 là hợp lệ (tạo ra $\Delta = 0$).
7. **Đổi Người cầm đầu trước khi lưu:**
   - Người dùng có thể tự do thay đổi $A$ trước khi bấm Lưu.
   - Khi đổi $A$, toàn bộ danh sách đối đầu và kết quả tạm sẽ được tính toán lại tương ứng.
8. **Bất biến sau khi lưu & Audit Trail:**
   - Sau khi ghi vào Google Sheets, không sửa trực tiếp dữ liệu lịch sử tự do.
   - Mọi thao tác sửa/hủy ván phải thực hiện qua hàm nghiệp vụ có kiểm soát ở các Phase sau, lưu lại dấu vết trạng thái.
9. **Xóa mềm người chơi (Soft Delete):**
   - Người chơi đã phát sinh lịch sử trong `VAN_DAU` không bao giờ bị xóa vật lý (hard delete) khỏi sheet `NGUOI_CHOI`.
   - Khi nghỉ chơi, trạng thái được cập nhật thành `NGUNG_CHOI`.
   - Người `NGUNG_CHOI` sẽ không xuất hiện trong danh sách chọn ván mới, nhưng vẫn được giữ nguyên dữ liệu trong lịch sử và bảng tổng kết.
10. **Quy mô số người chơi:**
    - Không giới hạn số lượng người chơi tối đa trong một phiên.
    - Một ván đấu hợp lệ phải có tối thiểu 2 người tham gia (1 Người cầm đầu và ít nhất 1 Người đối đầu).
11. **Snapshot định danh:**
    - `TEN_NGUOI_CAM_DAU` và tên đối thủ trong `CHI_TIET_JSON` được lưu dưới dạng Snapshot tại thời điểm ván diễn ra.
    - Nếu sau này người chơi đổi tên hiển thị, các ván đã lưu trong quá khứ vẫn giữ nguyên tên lịch sử. Khóa định danh duy nhất luôn là `MA_NGUOI_CHOI` (`playerId`).
12. **Trạng thái ván đấu:**
    - `HOP_LE`: Ván đấu chuẩn, được tính vào bảng tổng kết.
    - `DA_HUY`: Ván đấu đã bị hủy bỏ. Dòng dữ liệu vẫn giữ nguyên trong sheet `VAN_DAU` phục vụ đối soát nhưng bị loại trừ hoàn toàn khỏi bảng `TONG_KET`.
13. **Tính toàn vẹn tuyệt đối (Strict Integrity):**
    - Hệ thống luôn kiểm tra $\Delta_A + \sum \Delta_{opp} = 0$. Nếu sai lệch dù chỉ 1 đơn vị, transaction sẽ bị rollback và trả lỗi.

---

## 5. THIẾT KẾ CẤU TRÚC 4 SHEET TRONG GOOGLE SPREADSHEET

Mỗi phiên chơi là một file Google Spreadsheet độc lập gồm đúng 4 Sheet nghiệp vụ:

```
Google Spreadsheet (Phiên chơi)
 ├── 1. CAU_HINH   (Key-Value cấu hình phiên)
 ├── 2. NGUOI_CHOI (Danh bạ người chơi)
 ├── 3. VAN_DAU    (Nhật ký chi tiết các ván đấu - 1 ván/dòng)
 └── 4. TONG_KET   (Bảng xếp hạng tổng hợp dữ liệu dẫn xuất)
```

### 5.1. Sheet 1: `CAU_HINH`
- **Mô hình:** Key-Value dạng bảng 2 cột.
- **Tiêu đề cột (Row 1):** `KHOA` | `GIA_TRI`

#### Bảng danh mục khóa bắt buộc:
| KHOA | Kiểu dữ liệu | Giá trị mẫu | Ý nghĩa & Quy tắc |
| :--- | :--- | :--- | :--- |
| `TEN_APP` | String | `Chốt Điểm` | Tên ứng dụng nhận diện. |
| `MA_PHIEN` | String | `CP-20260902-001` | Mã định danh duy nhất của phiên chơi. |
| `TEN_PHIEN` | String | `Tối thứ Tư` | Tên mô tả thân thiện của buổi chơi. |
| `CUOC_MAC_DINH` | Number (Int) | `5` | Mức cược mặc định toàn phiên ($\ge 0$). |
| `THOI_GIAN_TAO` | ISO String / Date | `2026-09-02T19:00:00+07:00` | Thời điểm khởi tạo phiên chơi. |
| `TRANG_THAI` | Enum String | `DANG_CHOI` | Trạng thái phiên: `DANG_CHOI`, `DA_KET_THUC`. |
| `TIMEZONE` | String | `Asia/Ho_Chi_Minh` | Timezone chuẩn xử lý ngày giờ của phiên. |
| `SCHEMA_VERSION` | String | `1.0.0` | Phiên bản cấu trúc dữ liệu để hỗ trợ migrate sau này. |

---

### 5.2. Sheet 2: `NGUOI_CHOI`
- **Mô hình:** Bảng danh bạ người chơi tham gia phiên.
- **Header bắt buộc (Row 1):**
  1. `MA_NGUOI_CHOI`
  2. `TEN_NGUOI_CHOI`
  3. `THU_TU`
  4. `TRANG_THAI`
  5. `THOI_GIAN_THEM`

#### Chi tiết các trường:
| Tên cột | Kiểu dữ liệu | Ràng buộc & Quy tắc |
| :--- | :--- | :--- |
| `MA_NGUOI_CHOI` | String | Khóa chính (PK), duy nhất, không rỗng. Định dạng chuẩn: `P001`, `P002`, `P003`... Không tái sử dụng mã khi người chơi nghỉ. |
| `TEN_NGUOI_CHOI`| String | Tên hiển thị của người chơi, không được để trống (1 - 50 ký tự). |
| `THU_TU` | Number (Int) | Số nguyên không âm ($\ge 0$) xác định thứ tự ưu tiên hiển thị trên UI. |
| `TRANG_THAI` | Enum String | `DANG_CHOI` (đang hoạt động) hoặc `NGUNG_CHOI` (đã rời bàn). |
| `THOI_GIAN_THEM`| Date / String| Thời điểm thêm người chơi vào phiên. |

---

### 5.3. Sheet 3: `VAN_DAU`
- **Mô hình:** Bảng nhật ký ván đấu. **Mỗi ván đấu chiếm đúng 1 dòng duy nhất.**
- **Header bắt buộc (Row 1):**
  1. `MA_VAN`
  2. `SO_VAN`
  3. `THOI_GIAN`
  4. `MA_NGUOI_CAM_DAU`
  5. `TEN_NGUOI_CAM_DAU`
  6. `CUOC_MAC_DINH`
  7. `CHI_TIET_JSON`
  8. `DIEM_CAM_DAU`
  9. `TONG_GIAO_DICH`
  10. `GHI_CHU`
  11. `TRANG_THAI`

#### Chi tiết các trường:
| Tên cột | Kiểu dữ liệu | Ràng buộc & Quy tắc |
| :--- | :--- | :--- |
| `MA_VAN` | String | Khóa chính duy nhất của ván (UUID hoặc `V000001`, `V000002`...). Không đổi. |
| `SO_VAN` | Number (Int) | Số thứ tự tăng dần hiển thị cho người dùng (1, 2, 3...). Không tái cấp phát khi hủy. |
| `THOI_GIAN` | Date / ISO8601 | Thời điểm ghi nhận ván đấu. |
| `MA_NGUOI_CAM_DAU` | String | Khóa ngoại (FK) trỏ tới `MA_NGUOI_CHOI` của người cầm đầu $A$. |
| `TEN_NGUOI_CAM_DAU` | String | Snapshot tên của $A$ tại thời điểm ván diễn ra. |
| `CUOC_MAC_DINH` | Number (Int) | Snapshot mức cược mặc định áp dụng cho ván đấu. |
| `CHI_TIET_JSON` | String (JSON) | Chuỗi JSON hợp lệ lưu trữ mảng chi tiết kết quả của các người đối đầu. |
| `DIEM_CAM_DAU` | Number (Int) | Điểm biến động của $A$ ($\Delta_A = -\sum \Delta_{opp}$). |
| `TONG_GIAO_DICH` | Number (Int) | Tổng điểm giao dịch ván: $\sum |\Delta_{opp}|$. |
| `GHI_CHU` | String | Ghi chú thêm cho ván đấu (tối đa 500 ký tự). |
| `TRANG_THAI` | Enum String | `HOP_LE` (vào tổng kết) hoặc `DA_HUY` (bị loại khỏi tổng kết). |

#### Đặc tả cấu trúc `CHI_TIET_JSON`:
Mỗi phần tử trong mảng đại diện cho một người đối đầu:
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

#### Đánh giá kiến trúc lưu trữ JSON trong 1 ô (Single-cell JSON):
- **Ưu điểm vượt trội:**
  1. *Tính nguyên tử (Atomicity):* 1 ván = 1 dòng dữ liệu. Thao tác thêm ván, hủy ván, xóa dòng diễn ra tức thời, không lo phân mảnh hay lệch dòng.
  2. *Hỗ trợ số lượng người chơi linh hoạt (Dynamic schema):* Bàn chơi có thể thay đổi từ 3 người lên 10 người giữa các ván mà không cần thay đổi cấu trúc cột của bảng.
  3. *Tối ưu hiệu năng Google Apps Script:* Giảm thiểu số lượt gọi `Sheet.appendRow()` hoặc `getRange()` từ $N$ lần xuống đúng $1$ lần duy nhất cho mỗi ván đấu.
- **Nhược điểm & Biện pháp kiểm soát:**
  1. *Khó viết hàm truy vấn trực tiếp bằng Google Sheets Formula thông thường:* Biện pháp: Dùng Apps Script để tổng hợp dữ liệu sang sheet `TONG_KET`.
  2. *Nguy cơ lỗi cú pháp chuỗi JSON:* Biện pháp: Tất cả thao tác đọc/ghi đều qua hàm serialize/parse chuẩn hóa có bọc `try...catch` bảo vệ.

---

### 5.4. Sheet 4: `TONG_KET`
- **Mô hình:** Bảng dữ liệu dẫn xuất (Derived Data Table) tổng hợp thành tích và xếp hạng toàn phiên.
- **Header bắt buộc (Row 1):**
  1. `MA_NGUOI_CHOI`
  2. `TEN_NGUOI_CHOI`
  3. `SO_VAN_THAM_GIA`
  4. `SO_LAN_CAM_DAU`
  5. `SO_LAN_THANG`
  6. `SO_LAN_HOA`
  7. `SO_LAN_THUA`
  8. `TONG_DIEM`
  9. `XEP_HANG`

#### Quy tắc tổng hợp và xếp hạng:
1. **Phạm vi tính toán:**
   - Chỉ tính các ván có `TRANG_THAI = 'HOP_LE'`.
   - Bỏ qua các ván có trạng thái `DA_HUY` hoặc lỗi cú pháp JSON.
2. **Quy tắc tích lũy người cầm đầu ($A$):**
   - `SO_VAN_THAM_GIA` tăng $+1$.
   - `SO_LAN_CAM_DAU` tăng $+1$.
   - `TONG_DIEM` cộng thêm $\Delta_A$.
   - *Không* cộng vào `SO_LAN_THANG`, `SO_LAN_HOA`, `SO_LAN_THUA` của $A$ (vì $A$ đối đầu cùng lúc với nhiều người, kết quả tổng hợp là số điểm ròng).
3. **Quy tắc tích lũy người đối đầu:**
   - `SO_VAN_THAM_GIA` tăng $+1$.
   - `result == 'WIN'`: tăng `SO_LAN_THANG` $+1$.
   - `result == 'DRAW'`: tăng `SO_LAN_HOA` $+1$.
   - `result == 'LOSE'`: tăng `SO_LAN_THUA` $+1$.
   - `TONG_DIEM` cộng thêm $\Delta_i$.
4. **Quy tắc Xếp hạng thi đấu (Competition Ranking "1 2 2 4"):**
   - Sắp xếp người chơi theo `TONG_DIEM` giảm dần.
   - Những người có cùng `TONG_DIEM` sẽ nhận chung thứ hạng.
   - Người đứng kế sau nhóm đồng hạng sẽ nhận thứ hạng bằng `(vị trí chỉ mục thực tế + 1)`.
   - *Ví dụ điểm số:* `[15, 10, 10, -5, -30]` $\rightarrow$ Xếp hạng: `[1, 2, 2, 4, 5]`.
5. **Tiêu chí phụ sắp xếp hiển thị:**
   Khi hiển thị danh sách có điểm bằng nhau, thứ tự dòng được sắp xếp phụ theo:
   1. `SO_VAN_THAM_GIA` giảm dần (ai chơi nhiều ván hơn đứng trước).
   2. `TEN_NGUOI_CHOI` tăng dần theo bảng chữ cái A-Z.
   3. `MA_NGUOI_CHOI` tăng dần.
   *(Lưu ý: Tiêu chí phụ chỉ quyết định thứ tự dòng trên bảng hiển thị, không làm thay đổi giá trị của cột `XEP_HANG`).*
6. **Tính chất tái tạo (Rebuildable):**
   - Bảng `TONG_KET` hoàn toàn là dữ liệu dẫn xuất. Có thể xóa trắng và tính toán lại bất kỳ lúc nào từ nguồn gốc là `NGUOI_CHOI` và `VAN_DAU`.

---

## 6. MÔ HÌNH DỮ LIỆU NỘI BỘ (DATA MODELS)

```javascript
/**
 * @typedef {'DANG_CHOI' | 'DA_KET_THUC'} SessionStatus
 * @typedef {'DANG_CHOI' | 'NGUNG_CHOI'} PlayerStatus
 * @typedef {'WIN' | 'DRAW' | 'LOSE'} MatchResult
 * @typedef {'HOP_LE' | 'DA_HUY'} RoundStatus
 */

/**
 * @typedef {Object} SessionConfig
 * @property {string} appName - Tên ứng dụng (mặc định: 'Chốt Điểm')
 * @property {string} sessionId - Mã định danh phiên chơi (VD: 'CP-20260902-001')
 * @property {string} sessionName - Tên phiên chơi
 * @property {number} defaultBet - Mức cược mặc định của phiên (số nguyên >= 0)
 * @property {string | Date} createdAt - Thời gian tạo phiên
 * @property {SessionStatus} status - Trạng thái phiên
 * @property {string} timezone - Múi giờ chuẩn (VD: 'Asia/Ho_Chi_Minh')
 * @property {string} schemaVersion - Phiên bản schema (VD: '1.0.0')
 */

/**
 * @typedef {Object} Player
 * @property {string} playerId - Mã người chơi (PK, VD: 'P001')
 * @property {string} name - Tên người chơi
 * @property {number} order - Thứ tự hiển thị (>= 0)
 * @property {PlayerStatus} status - Trạng thái hoạt động
 * @property {string | Date} joinedAt - Thời gian thêm vào phiên
 */

/**
 * @typedef {Object} RoundDetail
 * @property {string} playerId - Mã người đối đầu (FK)
 * @property {string} name - Snapshot tên người đối đầu
 * @property {MatchResult} result - Kết quả: WIN, DRAW, LOSE
 * @property {number} bet - Mức cược hiệu lực (số nguyên >= 0)
 * @property {number} delta - Biến động điểm (+bet, -bet, 0)
 */

/**
 * @typedef {Object} Round
 * @property {string} roundId - Mã ván đấu (PK, VD: 'V000001' hoặc UUID)
 * @property {number} roundNumber - Số thứ tự ván (1, 2, 3...)
 * @property {string | Date} timestamp - Thời gian ghi nhận ván
 * @property {string} leaderId - Mã người cầm đầu A
 * @property {string} leaderName - Snapshot tên người cầm đầu A
 * @property {number} defaultBet - Snapshot mức cược mặc định của ván
 * @property {RoundDetail[]} details - Mảng chi tiết các người đối đầu
 * @property {number} leaderDelta - Biến động điểm của A (-sum(delta đối đầu))
 * @property {number} transactionTotal - Tổng giao dịch ván (sum(abs(delta đối đầu)))
 * @property {string} [note] - Ghi chú tùy chọn (tối đa 500 ký tự)
 * @property {RoundStatus} status - Trạng thái ván ('HOP_LE' | 'DA_HUY')
 */

/**
 * @typedef {Object} SummaryRow
 * @property {string} playerId - Mã người chơi
 * @property {string} name - Tên người chơi
 * @property {number} roundsPlayed - Số ván tham gia
 * @property {number} leaderCount - Số lần làm người cầm đầu
 * @property {number} winCount - Số lần thắng (khi là đối đầu)
 * @property {number} drawCount - Số lần hòa (khi là đối đầu)
 * @property {number} loseCount - Số lần thua (khi là đối đầu)
 * @property {number} totalScore - Tổng điểm tích lũy
 * @property {number} rank - Thứ hạng thi đấu (1, 2, 2, 4...)
 */
```

---

## 7. QUY TRÌNH & THIẾT KẾ KỸ THUẬT GOOGLE APPS SCRIPT

### 7.1. Cấu trúc module mã nguồn
Mã nguồn Phase 1 được tổ chức module hóa độc lập, tuân thủ nguyên lý Single Responsibility Principle (SRP) và Pure Functions:

```
src/
 ├── constants.js   # Định nghĩa hằng số tên sheet, header, trạng thái, key cấu hình
 ├── scoring.js     # Các hàm tính toán thuần túy: delta, leaderDelta, summary, rank
 ├── validation.js  # Các hàm kiểm tra tính hợp lệ dữ liệu: ván, cấu hình, người chơi
 ├── serializer.js  # Chuẩn hóa, serialize và deserialize JSON an toàn
 └── schema.js      # Khởi tạo bảng, kiểm tra tính toàn vẹn của Sheet Schema
```

### 7.2. Xử lý Thời gian & Timezone
- Trong môi trường Google Apps Script, thời gian ghi vào ô Sheet được giữ dưới dạng `Date` đối tượng gốc của Apps Script để Google Sheets tự động định dạng hiển thị.
- Khi giao tiếp qua API hoặc lưu vào JSON, thời gian luôn được ép kiểu về định dạng chuỗi chuẩn ISO 8601 (VD: `2026-09-02T19:00:00.000+07:00`) với timezone cấu hình là `Asia/Ho_Chi_Minh`.

### 7.3. Tính chịu lỗi và Khôi phục (Fault Tolerance)
- Mọi thao tác parse JSON từ cột `CHI_TIET_JSON` được bảo vệ bằng khối `try...catch`. Nếu phát hiện dòng dữ liệu bị lỗi cú pháp thủ công từ người dùng, hệ thống đánh dấu dòng đó là `CORRUPT`, bỏ qua khi tổng kết và ghi nhận log cảnh báo thay vì làm sập toàn bộ ứng dụng.
- Hàm `rebuildSummary()` có khả năng quét toàn bộ sheet `VAN_DAU` và dựng lại toàn bộ sheet `TONG_KET` một cách hoàn hảo và độc lập.

---

## 8. DANH MỤC TRƯỜNG HỢP KIỂM THỬ (TEST MATRIX)

Phase 1 bao gồm 20 trường hợp kiểm thử tự động bắt buộc:

| STT | Mã Test | Mô tả trường hợp kiểm thử | Kết quả kỳ vọng |
| :---: | :--- | :--- | :--- |
| 1 | `TC-01` | WIN với mức cược 5 | $\Delta = +5$ |
| 2 | `TC-02` | LOSE với mức cược 5 | $\Delta = -5$ |
| 3 | `TC-03` | DRAW với mức cược 5 | $\Delta = 0$ |
| 4 | `TC-04` | Cược mức 0 điểm | $\Delta = 0$ với mọi kết quả |
| 5 | `TC-05` | Mức cược là số âm (-5) | Từ chối validation (`VALIDATION_ERROR`) |
| 6 | `TC-06` | Mức cược là số thập phân (5.5) | Từ chối validation (`VALIDATION_ERROR`) |
| 7 | `TC-07` | Kết quả không hợp lệ (VD: `UNKNOWN`) | Từ chối validation (`VALIDATION_ERROR`) |
| 8 | `TC-08` | Ván đấu không chọn Người cầm đầu $A$ | Từ chối validation (`VALIDATION_ERROR`) |
| 9 | `TC-09` | Người cầm đầu $A$ xuất hiện trong danh sách đối đầu | Từ chối validation (`VALIDATION_ERROR`) |
| 10 | `TC-10` | Danh sách đối đầu có 2 người trùng `playerId` | Từ chối validation (`VALIDATION_ERROR`) |
| 11 | `TC-11` | Người chơi không có trong danh bạ `NGUOI_CHOI` | Từ chối validation (`VALIDATION_ERROR`) |
| 12 | `TC-12` | Người chơi ở trạng thái `NGUNG_CHOI` tham gia ván mới | Từ chối validation (`VALIDATION_ERROR`) |
| 13 | `TC-13` | Người đối đầu thiếu kết quả | Tự động chuẩn hóa thành `DRAW` ($\Delta = 0$) |
| 14 | `TC-14` | Người đối đầu không có cược riêng | Tự động áp dụng mức cược mặc định của ván |
| 15 | `TC-15` | Tính toán toàn ván: $A$ và nhiều đối thủ cược khác nhau | $\Delta_A + \sum \Delta_{opp} = 0$ |
| 16 | `TC-16` | Tính tổng giao dịch ván đấu | Bằng $\sum \|\Delta_{opp}\|$, không đếm trùng $\|\Delta_A\|$ |
| 17 | `TC-17` | Serialize và Deserialize mảng `details` | Dữ liệu khôi phục đồng nhất 100% |
| 18 | `TC-18` | Xử lý chuỗi JSON lỗi / hỏng | Parse an toàn, trả về mảng rỗng hoặc báo lỗi có kiểm soát |
| 19 | `TC-19` | Ván có trạng thái `DA_HUY` | Hoàn toàn bị loại trừ khi tính `TONG_KET` |
| 20 | `TC-20` | Xếp hạng người chơi đồng điểm | Áp dụng đúng thứ tự `1, 2, 2, 4` |

---

## 9. TIÊU CHÍ NGHIỆM THU PHASE 1 (ACCEPTANCE CRITERIA)

Phase 1 được nghiệm thu đạt chuẩn khi đáp ứng đầy đủ các tiêu chí:
- [x] Thuật ngữ được chuẩn hóa và áp dụng đồng bộ toàn bộ tài liệu và mã nguồn.
- [x] Thiết kế 4 Sheet nghiệp vụ đầy đủ, thứ tự cột và kiểu dữ liệu chuẩn xác.
- [x] Đảm bảo cấu trúc 1 ván đấu = 1 dòng dữ liệu trong sheet `VAN_DAU`.
- [x] Cột `CHI_TIET_JSON` linh hoạt đáp ứng số người chơi thay đổi tự do.
- [x] Cơ chế Snapshot tên và mức cược được đặc tả rõ ràng.
- [x] Công thức toán học và điều kiện bất biến $\Delta_A + \sum \Delta_{opp} = 0$ được chứng minh.
- [x] Quy tắc Soft-delete (`NGUNG_CHOI`) và Hủy ván (`DA_HUY`) được xác lập.
- [x] Cơ chế xếp hạng Competition Ranking (1224) và tiêu chí phụ được định nghĩa rõ ràng.
- [x] Bộ mã nguồn nền tảng (Pure logic functions) được triển khai sạch sẽ, có chú thích JSDoc.
- [x] 100% các ca kiểm thử trong Test Matrix vượt qua (Passed).
- [x] Tất cả các thay đổi được ghi nhận và commit trên nhánh `phase-1/data-design` mà không push lên remote.
