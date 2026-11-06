# Kế hoạch phát triển

Phạm vi mới theo yêu cầu: dashboard giáo viên quản lý nhiều ESP32 giám thị. Các giai đoạn bên dưới là lộ trình ban đầu; trạng thái thực thi hiện tại được mô tả trong `ARCHITECTURE.md` và `DEPLOYMENT.md`.

## Giai đoạn 0 — Ổn định phiên bản hiện tại

- Sửa điểm nghẽn `/getFingerList`.
- Bỏ polling danh sách 15 giây.
- Thay các `delay()` dài bằng trạng thái không chặn.
- Sửa lỗi cú pháp và tên sheet ngày trong Apps Script.
- Giữ nguyên định dạng vân tay để không ảnh hưởng người dùng hiện có.

Hoàn thành khi giao diện LAN vẫn phản hồi khi Google chậm và chức năng một lớp không bị hồi quy.

## Giai đoạn 1 — Chuẩn hóa Google Sheets và API

- Tạo `LOP`, các sheet `LOP_*`, `BUOIDIEMDANH`, `CHITIET_BUOI`, `DIEMDANH` và `TONG_TUAN`.
- Trả JSON chuẩn từ Apps Script.
- Dùng POST cho thao tác ghi.
- Thêm `eventId` chống trùng và khóa khi ghi.
- Thêm `dataVersion` cho roster.
- Khi bắt đầu buổi, chụp roster vào `CHITIET_BUOI` dưới trạng thái `PENDING`.
- Khi kết thúc buổi, chuyển `PENDING` thành `ABSENT` và khóa kết quả buổi.
- Tạo báo cáo tuần theo lớp gồm số lượt và danh sách tên vắng/trễ.
- Chuyển cấu hình nhạy cảm của Apps Script sang Script Properties.

Hoàn thành khi Apps Script xử lý được roster một lớp, mở/đóng buổi, xác định vắng chính xác và tạo tổng kết tuần mà không phụ thuộc vị trí cột cứng trong firmware.

## Giai đoạn 2 — Nhiều lớp và nhập file

- Làm trang Apps Script nhập CSV UTF-8.
- Xem trước, kiểm tra trùng/thiếu và chọn chế độ nhập.
- Thêm lớp đang hoạt động vào ESP32 và lưu qua lần khởi động.
- Đồng bộ chỉ roster của lớp đang hoạt động.
- Lọc trang học sinh/vân tay theo lớp.
- Viết migration cho `/fingerlist.json` cũ.

Hoàn thành khi chuyển lớp không làm mất template vân tay và học sinh lớp khác không được ghi nhầm vào buổi hiện tại.

## Giai đoạn 3 — Mất mạng và vận hành

- Hàng đợi điểm danh trong LittleFS.
- Gửi lại có backoff và xóa sau khi nhận xác nhận.
- Đồng bộ NTP và lưu thời gian ISO 8601.
- Hiển thị trạng thái mạng, lần sync cuối và số sự kiện đang chờ.
- Thêm nhật ký quản trị và sao lưu Sheet định kỳ.

Hoàn thành khi mất mạng trong lúc quét không làm mất lượt điểm danh và gửi lại không tạo bản ghi trùng.

## Đã bổ sung theo yêu cầu mở rộng

- Dashboard quản lý nhiều thiết bị, trạng thái online/offline và khóa kết nối riêng.
- Giao lớp cho nhiều ESP32, chống quét trùng và lệnh vân tay theo thiết bị đích.

## Chưa triển khai

- Hàng đợi điểm danh ngoại tuyến.
- Phân quyền tài khoản giáo viên riêng và nhật ký theo cá nhân.
- Đồng bộ mẫu vân tay giữa các cảm biến.
- Tự động lưu trữ sang workbook năm học mới và thử tải nhiều thiết bị thật.
- Cơ sở dữ liệu ngoài Google Sheets.
- Ứng dụng điện thoại riêng.
- Kiến trúc microservice.

Các phần này chỉ nên xem xét khi quy mô vận hành vượt một thiết bị hoặc yêu cầu độ sẵn sàng vượt khả năng của Apps Script.
