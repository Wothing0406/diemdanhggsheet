# Hệ thống điểm danh vân tay ESP32 + Google Sheets

**Chuyển sang máy mới:** xem [hướng dẫn clone, tự thiết lập Sheet, khóa thiết bị và nạp ESP32](docs/NEW_PC_SETUP.md).

Dự án dùng ESP32, cảm biến vân tay AS608, LCD I2C và Google Apps Script để quản lý danh sách học sinh và ghi nhận điểm danh vào Google Sheets.

## Trạng thái hiện tại

Ưu tiên bản thi KHKT: **một ESP32 ở cổng chung nhận học sinh nhiều lớp quét xen kẽ**, hỗ trợ sáng và chiều độc lập. Xem [hướng dẫn một ESP32](docs/DEPLOYMENT.md). Thêm học sinh trên web chỉ nhập họ tên; hệ thống tự cấp mã cố định và đánh STT theo tên gọi A–Z tiếng Việt. Một học sinh có thể đăng ký nhiều ngón tay trên cùng cảm biến.

- Source hỗ trợ **một hoặc nhiều ESP32**, mỗi thiết bị có khóa riêng và lớp được giao. Chưa kiểm chứng trên thiết bị thật trong phiên nâng cấp này.
- Source mới tạo các sheet lớp `LOP_*` tự động từ giao diện web và đồng bộ danh sách theo phiên bản. Trong tab lớp, có thể nhập tên ở vùng trống cột C để hệ thống tự cấp mã và STT qua trình kích hoạt Apps Script.
- ESP32 lưu ánh xạ vân tay trong LittleFS.
- Giao diện quản trị trung tâm nằm trong `Index.html` của Apps Script; giao diện cục bộ trong firmware vẫn là đường dự phòng.
- Firmware và `Code.gs` có buổi sáng/chiều/tối, đúng giờ/trễ, chốt vắng, duyệt phép và tổng kết tuần có khoảng ngày. Không tạo tab theo ngày/buổi; tab `XEM_BUOI` dùng lại để xem lịch sử.
- Giao diện web có khu tạo lớp và thêm học sinh thủ công dùng được trước khi kết nối ESP32; hỗ trợ sửa/ngừng học sinh và nhập CSV. Hàng đợi quét ngoại tuyến chưa được triển khai.
- Khu vân tay riêng cho phép tìm rồi chọn học sinh trước khi gửi lệnh đăng ký/xóa cho ESP32; cảm biến thực hiện và trả trạng thái về trang quản trị.
- Trang nội bộ ESP32 có đăng nhập, danh sách, vân tay và cấu hình Wi-Fi. Nếu không nối được Wi-Fi sau 20 giây, thiết bị mở mạng thiết lập và hiển thị mật khẩu trên LCD.
- Dashboard yêu cầu đăng nhập quản trị, hiển thị trực tuyến/ngoại tuyến và khóa thao tác không hợp lệ. Dữ liệu Sheet được bảo vệ, giờ vào do máy chủ ghi; chủ sở hữu Sheet vẫn có quyền sửa/gỡ bảo vệ.

## Phần cứng

- ESP32
- Cảm biến vân tay AS608 qua UART2
- LCD 16x2 I2C
- Buzzer
- Nút thiết lập và nút tạo danh sách điểm danh

Sơ đồ đấu nối hiện có: `DIEM DANH VAN TAY - GOOGLESHEET.png`.

## Các file chính

| File | Vai trò |
|---|---|
| `DIEM_DANH_VAN_TAY_GOOGLE_SHEET_4.ino` | Firmware, LittleFS, Wi-Fi, cảm biến, HTTP API và đồng bộ |
| `homePage.h` | Trang chính của thiết bị |
| `fingerPage.h` | Trang đăng ký và xóa vân tay |
| `userPage.h` | Trang danh sách học sinh |
| `loginPage.h` | Trang đăng nhập và quản lý tài khoản cục bộ |
| `wifiPage.h` | Trang cấu hình Wi-Fi cục bộ |
| `Code.gs` | Apps Script mới cho lớp, buổi, vắng/trễ, ngày và tuần |
| `Index.html` | Giao diện quản trị trên cùng link Apps Script |
| `appsscript.json` | Quyền Apps Script cần cấp cho Sheet, trình kích hoạt và tài khoản chạy |
| `script_google_sheet.h` | Apps Script cũ; chỉ giữ để tham chiếu |
| `templates/student_import.csv` | Mẫu nhập danh sách nhiều lớp |

## Tài liệu phát triển

- [Kiến trúc](docs/ARCHITECTURE.md)
- [Mô hình dữ liệu và mẫu nhập](docs/DATA_MODEL.md)
- [Luồng buổi điểm danh, vắng học và tổng kết tuần](docs/ATTENDANCE_WORKFLOW.md)
- [Nguyên nhân lag và nguyên tắc tối ưu](docs/PERFORMANCE.md)
- [Kế hoạch phát triển](docs/DEVELOPMENT_PLAN.md)
- [Triển khai và giới hạn hiện tại](docs/DEPLOYMENT.md)

## Nguyên tắc nâng cấp

1. Google Sheets tiếp tục là nguồn dữ liệu chính.
2. Google Apps Script là lớp API; ESP32 không phụ thuộc trực tiếp vào vị trí cột.
3. Chế độ cổng chung nhận roster nhiều lớp và buổi theo từng lớp; lớp của lượt quét lấy từ ánh xạ vân tay. `activeClassId` được giữ để tương thích chế độ theo lớp và bảo trì cục bộ.
4. Không xóa dữ liệu vân tay cũ khi chuyển sang nhiều lớp.
5. Tối ưu độ phản hồi trước khi thêm giao diện và dữ liệu lớn.

## Lưu ý bảo mật

Đặt `ADMIN_PASSWORD` trong Script Properties; cấp khóa trên dashboard rồi cấu hình `DEVICE_ID`, `DEVICE_KEY` và URL triển khai trong firmware. API thiết bị chỉ nhận POST đã xác thực, không có quyền điều hành buổi. Firmware không chứa Wi-Fi mặc định; cấu hình mới lưu `/wifi.json`. Bản cài mới tạo mật khẩu cục bộ ngẫu nhiên và in trên Serial; tài khoản từ bản cũ vẫn được giữ. Xem [triển khai](docs/DEPLOYMENT.md) để cập nhật cả hai phía và hiểu giới hạn hiện tại.
