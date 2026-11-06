# Luồng buổi điểm danh, vắng học và tổng kết tuần

Luồng này đã được đưa vào firmware và `Code.gs` trong repository. Cần triển khai Apps Script và nạp firmware để sử dụng trên thiết bị thực; các giới hạn còn lại ghi trong `DEPLOYMENT.md`.

Bản thi KHKT dùng một ESP32 chế độ cổng chung. Mở buổi sáng cho nhiều lớp, học sinh quét xen kẽ; mạch tự lấy lớp từ vân tay và tra buổi của lớp đó. Sau khi kết thúc sáng, mở chiều cho từng lớp. Không cần đổi lớp trên mạch. Học sinh cùng mã giữa hai lớp vẫn khác nhau nhờ khóa `lớp|mã`.

## Mục tiêu

- Một hoặc nhiều ESP32 điểm danh cho lớp được giao trên dashboard.
- Khi bắt đầu buổi, hệ thống tạo đủ danh sách học sinh cần điểm danh.
- Trong buổi, biết ai đã có mặt, đi trễ hoặc chưa điểm danh.
- Khi kết thúc buổi, xác định vắng chính thức.
- Cuối tuần, tổng hợp theo từng lớp và liệt kê rõ tên học sinh vắng/trễ.

## 1. Bắt đầu buổi điểm danh

Người quản trị chọn:

- Lớp.
- Ngày hiện tại (máy chủ xác định).
- Loại buổi `SANG`, `CHIEU` hoặc `TOI`.
- Giờ bắt đầu do máy chủ ghi khi mở buổi.
- Mốc tính đi trễ.
- Giờ kết thúc do máy chủ ghi khi giáo viên đóng buổi.

Khi bấm **Bắt đầu điểm danh**, Apps Script thực hiện một giao dịch logic:

1. Kiểm tra lớp và sheet roster tồn tại.
2. Kiểm tra không có buổi tương ứng đang `OPEN`.
3. Tạo một dòng trong `BUOIDIEMDANH`.
4. Đọc toàn bộ học sinh `active = TRUE` của sheet `LOP_<classId>`.
5. Ghi một dòng cho mỗi học sinh vào `CHITIET_BUOI` với trạng thái `PENDING`.
6. Chỉ trả thành công sau khi tạo đủ số dòng roster.

Ví dụ lớp 10A2 có 35 học sinh thì buổi mới phải có đúng 35 dòng `CHITIET_BUOI`.

### Ý nghĩa `PENDING`

`PENDING` nghĩa là học sinh chưa quét trong buổi đang mở. Giao diện có thể hiển thị nhóm này là **Chưa điểm danh (tạm tính vắng)**, nhưng báo cáo lịch sử chưa được ghi là vắng chính thức.

## 2. Học sinh quét vân tay

Khi nhận lượt quét hợp lệ:

1. ESP32 xác định học sinh và kiểm tra thuộc lớp đang hoạt động.
2. Gửi định danh học sinh, lớp, mã buổi và xác thực thiết bị.
3. Apps Script kiểm tra học sinh có trong `CHITIET_BUOI` của buổi đang mở.
4. Ghi lượt quét vào `DIEMDANH`.
5. Cập nhật dòng `CHITIET_BUOI`:
   - Trước hoặc đúng `lateAfter`: `PRESENT`.
   - Sau `lateAfter`: `LATE`.
6. Nếu học sinh đã có trạng thái trong buổi, trả kết quả cũ, không ghi đè giờ vào hoặc cộng thêm lượt; máy chủ tạo mã sự kiện theo buổi/học sinh.

Một học sinh quét lần hai trong cùng buổi không tạo thêm trạng thái. Giao diện chỉ báo “Đã điểm danh”.

## 3. Kết thúc buổi và xác định vắng

Khi bấm **Kết thúc điểm danh**:

1. Khóa buổi để không nhận lượt quét mới.
2. Chuyển tất cả dòng còn `PENDING` thành `ABSENT`.
3. Giữ nguyên `PRESENT`, `LATE` và `EXCUSED`.
4. Ghi `endTime` thực tế và chuyển buổi sang `CLOSED`.
5. Cập nhật dữ liệu tổng kết tuần.

Nếu thiết bị khởi động lại khi còn một buổi `OPEN`, thiết bị nhận lại buổi đang mở từ máy chủ; không tự tạo buổi mới. Buổi từ ngày cũ phải kết thúc trước khi tạo buổi ngày mới.

## 4. Điều chỉnh có phép

Người quản trị có thể đổi `ABSENT` thành `EXCUSED`, nhưng phải nhập ghi chú. Không xóa event hoặc dòng chi tiết cũ.

Báo cáo cần tách:

- `ABSENT`: vắng không phép hoặc chưa có xác nhận.
- `EXCUSED`: vắng có phép.

## 5. Sheet tổng kết tuần

Tên đề xuất: `TONG_TUAN`.

Một tuần cần có định danh ổn định, ví dụ `2026-W45`, và nhãn hiển thị thân thiện, ví dụ `Tuần 1` hoặc `Tuần 45 (02/11-08/11)`. Tuần bắt đầu vào thứ Hai và kết thúc Chủ nhật.

### Bảng tổng hợp theo lớp

| Tuần | Lớp | Số buổi | Sĩ số | Lượt có mặt | Lượt vắng | Học sinh vắng | Lượt trễ | Học sinh trễ | Tỷ lệ có mặt |
|---|---|---:|---:|---:|---:|---|---:|---|---:|
| Tuần 1 | 10A2 | 5 | 35 | 172 | 2 | Nguyễn A (1), Trần B (1) | 1 | Lê C (1) | 98.3% |

Quy ước danh sách tên:

- Con số trong ngoặc là số buổi của học sinh trong tuần.
- Nếu Nguyễn A vắng hai buổi, hiển thị `Nguyễn A (2)`.
- `Lượt vắng` là tổng số buổi vắng, không phải số học sinh duy nhất.
- Có thể bổ sung `Số học sinh vắng` nếu cần đếm người duy nhất.
- Học sinh `EXCUSED` được liệt kê ở cột riêng nếu nhà trường muốn tách vắng có phép.

### Bảng chi tiết bảy ngày

Phần chi tiết theo học sinh sử dụng bảy cột từ thứ Hai đến Chủ nhật. Mỗi ô ghi đầy đủ `Sáng: Đúng giờ / Chiều: Đi học trễ` theo các buổi đã chốt. Bảng ký hiệu dưới đây là thiết kế cũ, được thay bằng từ ngữ đầy đủ trên dashboard và báo cáo mới:

| Mã HS | Họ tên | T2 | T3 | T4 | T5 | T6 | T7 | CN | Có mặt | Vắng | Trễ |
|---|---|---|---|---|---|---|---|---|---:|---:|---:|
| HS001 | Nguyễn A | C | C | V | C | M |  |  | 4 | 1 | 1 |

Ký hiệu:

- `C`: có mặt.
- `M`: đi trễ.
- `V`: vắng.
- `P`: vắng có phép nếu cần hiển thị.
- Ô trống: lớp không có buổi điểm danh ngày đó.

Một ngày có thể có buổi sáng, chiều và tối; từng trạng thái có nhãn buổi trong ô tương ứng. Không tạo tab mới theo buổi. `XEM_BUOI` được cập nhật theo buổi chọn khi cần xem trong Sheet.

## 6. Quy tắc tính toán

```text
Tổng lượt phải điểm danh = tổng số dòng CHITIET_BUOI của các buổi CLOSED trong tuần
Lượt có mặt = PRESENT + LATE
Lượt vắng = ABSENT
Lượt có phép = EXCUSED
Tỷ lệ có mặt = (PRESENT + LATE) / (PRESENT + LATE + ABSENT + EXCUSED)
```

Không đưa buổi `OPEN` hoặc `CANCELLED` vào tổng kết tuần chính thức.

## 7. Các tình huống cần kiểm thử khi triển khai

- Bắt đầu buổi cho lớp không có học sinh.
- Bấm bắt đầu hai lần.
- Roster thay đổi sau khi buổi đã bắt đầu.
- Một học sinh quét nhiều lần.
- Học sinh lớp khác quét.
- Quét đúng thời điểm `lateAfter`.
- Mất mạng khi đang quét hoặc khi kết thúc buổi.
- ESP32 khởi động lại khi buổi đang `OPEN`.
- Kết thúc buổi khi không có ai quét.
- Điều chỉnh vắng có phép sau khi buổi đã đóng.
- Tổng kết tuần có ngày không tổ chức điểm danh.
