# Thiết lập trên máy mới

Repo chỉ chứa mã nguồn và tài liệu. Google Sheet, Web App đã triển khai, mật khẩu và khóa thiết bị không được lưu trong GitHub.

## 1. Clone và chuẩn bị Arduino IDE

```powershell
git clone https://github.com/Wothing0406/diemdanhggsheet.git
cd diemdanhggsheet
```

Mở `DIEM_DANH_VAN_TAY_GOOGLE_SHEET_4.ino` bằng Arduino IDE. Giữ các file `.h` trong cùng thư mục. Cài **esp32 by Espressif Systems** trong Boards Manager; bản đã kiểm tra biên dịch là **3.3.12** và board mục tiêu là **ESP32 Dev Module** (`esp32:esp32:esp32`). Cài các thư viện `ArduinoJson`, `WebSockets` (file `WebSocketsServer.h`), `Adafruit Fingerprint Sensor Library` và **LiquidCrystal I2C Multilingual 2.0.2** qua Library Manager. Thư viện LCD gốc: <https://github.com/locple/LCDI2C_Multilingual>. Các thư viện `WiFi`, `HTTPClient`, `WebServer`, `LittleFS` đi theo ESP32 core.

## 2. Thiết lập Google Apps Script

Nếu đã có Sheet và Web App đang chạy đúng, giữ nguyên chúng và chỉ lấy URL `/exec`. Nếu thiết lập mới, làm theo `docs/DEPLOYMENT.md`: tạo Sheet, thay `Code.gs`, tạo file HTML tên **Index** từ `Index.html`, cập nhật `appsscript.json`, đặt `ADMIN_PASSWORD` tối thiểu 12 ký tự trong Script Properties, chạy `setupAttendanceSheets`, cấp quyền, rồi triển khai Web App. Khi cập nhật mã Apps Script, phải triển khai **phiên bản mới**; sửa code trong trình soạn thảo chưa cập nhật URL `/exec` đang dùng.

## 3. Cấp và điền khóa thiết bị

Trong dashboard, tạo/cấp thiết bị `ESP01` ở chế độ **Cổng chung**, chép khóa hiện một lần. Ở đầu file `.ino`, đặt:

- `DEVICE_ID`: đúng mã thiết bị trên dashboard.
- `DEVICE_KEY`: khóa vừa cấp.
- `Web_App_URL`: URL Web App kết thúc bằng `/exec`.

Không commit các giá trị thật này lên GitHub công khai. Nếu lỡ lộ khóa, cấp lại khóa trên dashboard và nạp lại firmware.

## 4. Nạp mạch và Wi-Fi

Cắm ESP32 bằng cáp USB truyền dữ liệu. Trong Arduino IDE chọn đúng **ESP32 Dev Module** và cổng COM, bấm **Verify**, rồi **Upload**. Nếu dừng ở `Connecting...`, giữ nút **BOOT** đến khi bắt đầu nạp. Mở Serial Monitor ở **115200 baud**.

Firmware mới không có Wi-Fi mặc định. Sau khoảng 20 giây chưa kết nối, ESP32 mở mạng `DiemDanh-Setup`; mật khẩu mạng hiện trên LCD/Serial. Kết nối mạng đó, mở `http://192.168.4.1/login`, đăng nhập cục bộ và nhập Wi-Fi **2,4 GHz**. Ở lần khởi tạo LittleFS đầu tiên, tài khoản cục bộ `admin` có mật khẩu ngẫu nhiên hiển thị **một lần** trên Serial Monitor; hãy lưu lại riêng. Nếu mạch đã có `/login.json`, mật khẩu cục bộ đang lưu vẫn được giữ. Tránh **Erase All Flash** hoặc đổi phân vùng khi có dữ liệu vân tay trong LittleFS.

## 5. Kiểm tra sau nạp

Dashboard phải hiển thị thiết bị trực tuyến và đã đồng bộ danh sách. Tạo một lớp, thêm một học sinh, chọn học sinh trong mục đăng ký vân tay, đăng ký ngón, mở buổi thử rồi quét. Kiểm tra Google Sheet ghi đúng lớp, buổi và giờ máy chủ. Bản source đã biên dịch và chạy kiểm thử giả lập; chưa xác nhận trên ESP32/cảm biến thật.

File `script_google_sheet.h` là mã Apps Script cũ để tham khảo, **không** nạp vào Arduino và **không** có trong repo vì chứa định danh Sheet riêng tư. Thư mục `imports/` chứa danh sách học sinh thật trên máy cũ và cũng không được đưa lên GitHub.
