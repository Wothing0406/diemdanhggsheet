# Triển khai dashboard giáo viên và ESP32 giám thị

Source này thay API cũ. Cần cập nhật **cả Apps Script lẫn firmware**. Chưa nạp lên thiết bị hoặc thay đổi Google Sheet thật trong phiên làm việc này.

Bản tự cấp mã: thay `Code.gs`, `Index.html` và cập nhật `appsscript.json`, chạy lại `setupAttendanceSheets`, rồi triển khai phiên bản web mới. Hệ thống giữ mã cũ, thêm cột STT và số ngón vào cuối tab lớp, sắp tên A–Z. Mã cấp mới dạng `HS000001` không được sửa qua web/API. Nạp firmware mới khi có mạch để nhận số ngón xác nhận; việc thêm học sinh và cấp mã vẫn dùng được khi chưa có mạch.

## Chuẩn bị Google Sheet thử

1. Sao lưu workbook và LittleFS/cảm biến. Dùng bản sao Sheet để thử trước. Không xóa tab dữ liệu cũ.
2. Mở Tiện ích mở rộng → Apps Script. Dán toàn bộ `Code.gs`; tạo HTML tên **Index**, dán `Index.html`. Vào **Cài đặt dự án**, bật hiển thị tệp kê khai `appsscript.json`, rồi cập nhật nội dung theo file cùng tên trong source. Tệp kê khai phải có ba quyền `spreadsheets`, `script.scriptapp` và `userinfo.email`. Nếu bạn đã tự thêm quyền khác cho dự án, giữ lại quyền đó.
3. Trong Cài đặt dự án → Thuộc tính tập lệnh (Script Properties), tạo `ADMIN_PASSWORD` với mật khẩu riêng tối thiểu 12 ký tự. Không đưa mật khẩu vào source hoặc Sheet.
4. **Lưu dự án, tải lại trình soạn thảo**, chạy `setupAttendanceSheets` trực tiếp bằng tài khoản chủ triển khai và chấp thuận toàn bộ quyền mới. Hàm yêu cầu quyền trước khi sửa Sheet, đổi tiêu đề cột sang tiếng Việt, giữ dữ liệu cũ, tạo tab cần thiết, bật bảo vệ và cài **một** trình kích hoạt tự cấp mã khi nhập tên trong tab lớp. Nếu lần chạy cũ đã tạo tab `LOP_10A2` nhưng chưa ghi vào bảng quản lý `LOP`, hàm sẽ nhận lại tab đó và cấp mã cho tên đang chờ trong cột C. Chạy lại không tạo trùng trình kích hoạt, không xóa lịch sử hoặc vân tay. Các tab `DD_*` cũ được giữ nhưng không được sinh thêm. Nếu còn báo thiếu quyền `Session.getEffectiveUser`, kiểm tra quyền `userinfo.email` trong tệp kê khai và chạy lại từ trình soạn thảo để hiện màn hình cấp quyền.
5. Triển khai Web App chạy dưới tài khoản chủ triển khai. ESP32 cần gọi được URL `/exec` không qua màn hình đăng nhập Google; gateway API yêu cầu mã và khóa thiết bị, dashboard yêu cầu mật khẩu riêng. Nếu chính sách Workspace không cho truy cập như vậy, cần gateway khác; không bỏ xác thực để vượt chính sách.
6. Mở link `/exec`, đăng nhập bằng mật khẩu trên. Khi cập nhật code về sau chọn Quản lý triển khai → Chỉnh sửa → Phiên bản mới → Triển khai.

**Kiểm tra web trước khi lắp ESP32:** Tạo lớp `10A2` → dùng ô **Tìm lớp nhanh** để chọn lại lớp → thêm một học sinh bằng họ tên → tìm học sinh đó trong **Quản lý học sinh** và **Đăng ký vân tay**. Kiểm tra tab `LOP_10A2` có mã tại cột A/B. Nếu lớp mới chưa xuất hiện, bấm **Làm mới** và kiểm tra phiên bản `/exec`; màn hình `/dev` và phiên bản `/exec` cũ có thể chạy code khác nhau. Nút gửi lệnh vân tay và mở buổi vẫn bị khóa đến khi mạch kết nối, nhưng tạo lớp, thêm và tìm học sinh phải dùng được.

Web tự chọn lớp mới tạo gần nhất khi mở lần đầu; `DEFAULT` được đặt cuối danh sách. Nếu xóa tab `LOP_10A2` trong Google Sheet, web sẽ bỏ lớp đó khỏi danh sách sau lần kiểm tra tiếp theo (hoặc bấm **Làm mới**). Bản ghi trong tab quản lý `LOP` và lịch sử điểm danh được giữ lại; chạy lại `setupAttendanceSheets` không tạo lại tab đã xóa. **Xóa tab cũng xóa danh sách học sinh trong tab đó**; muốn lấy lại dữ liệu phải dùng lịch sử phiên bản hoặc bản sao lưu của Google Sheet. Nếu tạo lớp mới với cùng mã hiển thị, hệ thống cấp định danh nội bộ và tab mới (ví dụ `LOP_10A2_V2`); danh sách và lịch sử của lớp cũ không được tính vào lớp mới. CSV vẫn ghi mã `10A2`. Không xóa tab lớp đang mở buổi điểm danh.

### Nhập học sinh ngay trong Google Sheet

Mở tab `LOP_10A2` (hoặc tab lớp tương ứng), chỉ nhập họ tên tại **ô trống đầu tiên ở cột C**, ví dụ `C2` nếu lớp chưa có ai. Có thể dán nhiều tên liên tiếp trong **một cột C**. Sau khi sửa, đợi trình kích hoạt chạy; cột A/B/D/E/F tự điền, danh sách sắp lại theo tên và vùng nhập chuyển xuống dưới học sinh cuối. Không gõ mã vào cột A/B. Mỗi lần tối đa 500 tên; tên tối đa 120 ký tự. Trong lúc buổi điểm danh của lớp đang mở, nhập trực tiếp bị khóa.

Nếu tên vẫn ở cột C mà mã chưa xuất hiện, kiểm tra **Trình kích hoạt** và **Lượt thực thi** trong Apps Script, rồi chạy lại `setupAttendanceSheets` bằng tài khoản chủ triển khai để cấp quyền. Không cần ESP32 để cấp mã. Bảo vệ Sheet ngăn người chỉnh sửa thông thường sửa các cột hệ thống; **chủ sở hữu tệp vẫn có thể gỡ bảo vệ và sửa mọi ô theo quyền của Google Sheets**. Dùng dashboard để sửa tên học sinh đã có mã.

## Cấp thiết bị và đồng bộ lớp

### Dùng một ESP32 để thi KHKT

1. Chạy lại `setupAttendanceSheets`: nếu chỉ có một thiết bị cũ chưa có chế độ, hệ thống đặt `CONG` (cổng chung). Khi cấp khóa từ web, thiết bị cũng được cấu hình cổng chung.
2. Trong mục **Tạo lớp học**, nhập mã lớp như `10A1` hoặc `10A2` rồi bấm **Tạo lớp và chọn lớp**. Tên lớp có thể để trống. Web tự chuyển sang lớp vừa tạo. Ở mục **Quản lý học sinh**, nhập họ tên và bấm **Thêm học sinh vào lớp**; không cần ESP32 trực tuyến. Hệ thống tự cấp mã cố định, không sửa được qua dashboard/API. Danh sách tự sắp theo tên gọi A–Z và đánh lại STT.
3. Cấp khóa/nạp mạch, chờ hiển thị **Cổng chung · Đã đồng bộ các lớp**. Mỗi lần thay danh sách phải chờ mạch xác nhận phiên bản mới.
4. Trong mục **Đăng ký vân tay**, tìm theo tên hoặc mã, bấm **Chọn học sinh**, chọn ESP01 rồi bấm **Thêm ngón tay cho học sinh đã chọn**. Có thể đăng ký lần lượt nhiều ngón khác nhau cho cùng người; mỗi ngón quét hai lần. Web hiển thị tổng số ngón khi mạch đồng bộ lại. Mã cũ giống nhau giữa hai lớp vẫn được phân biệt bằng khóa `lớp|mã`; mã mới do hệ thống cấp toàn workbook.
5. Buổi sáng: mở Sáng cho 10A1 rồi mở Sáng cho 10A2. Học sinh hai lớp quét xen kẽ; mỗi lượt tự vào đúng lớp. Kết thúc riêng từng lớp để chốt vắng.
6. Buổi chiều: mở Chiều cho từng lớp với hạn trễ buổi chiều rồi quét như trên. Mỗi học sinh có hai lượt độc lập trong ngày. Tổng kết tuần ghi cả sáng và chiều.

Giới hạn bản firmware này: tối đa 200 học sinh active trong dữ liệu đồng bộ; số mẫu lưu được còn tùy cảm biến. Không bắt buộc có thiết bị thứ hai. Nếu lớp đang có buổi mở thì cần kết thúc trước khi thêm/sửa học sinh của lớp đó.

### Mở rộng về sau hoặc cấu hình theo lớp

1. Trong mục Thiết bị giám thị, nhập `ESP01` và tên, bấm tạo/cấp lại khóa. Chép khóa xuất hiện một lần; cấp lại vô hiệu khóa cũ.
2. Trong firmware đặt `DEVICE_ID`, `DEVICE_KEY`, `Web_App_URL` tương ứng. Mỗi ESP32 có ID và khóa riêng. Chưa có thiết bị vẫn tạo lớp, nhập học sinh, xem dashboard; nút mở buổi và vân tay bị khóa khi chưa có thiết bị sẵn sàng.
3. Biên dịch và nạp khi có mạch. Thiết bị hỏi cấu hình khoảng 10 giây/lần. Dashboard coi ngoại tuyến nếu không nhận heartbeat trong 45 giây. Khi đang đăng ký vân tay, heartbeat có thể tạm gián đoạn tối đa 60 giây.
4. Với thiết bị chế độ `LOP`, chọn lớp trên dashboard rồi bấm Giao lớp tại thiết bị và chờ lớp đã đồng bộ khớp. Thiết bị `CONG` nhận tất cả lớp đang dùng nên không cần giao lại lớp. Lượt quét được chống ghi trùng theo học sinh/buổi.
5. Trong phần đăng ký vân tay riêng, tìm học sinh bằng mã hoặc tên, bấm Chọn học sinh, chọn thiết bị rồi bấm Thêm ngón tay. Đặt cùng một ngón hai lần; muốn thêm ngón khác thì bấm lại cho cùng học sinh. Mỗi ngón chiếm một mẫu trong cảm biến. **Không sao chép mẫu sang thiết bị khác**. Nút Xóa tất cả ngón xóa các mẫu của học sinh trên thiết bị đã chọn. Trước khi có ESP32, phần tìm/chọn vẫn hoạt động nhưng nút gửi lệnh vân tay bị khóa.

## Điều hành buổi học

- Chọn lớp, buổi sáng/chiều/tối và hạn đúng giờ. Chỉ mở buổi hôm nay, tối đa một buổi đang mở cho mỗi lớp. Ngày/lớp/buổi đã chốt không được tạo trùng.
- Cần ít nhất một thiết bị được cho phép, trực tuyến và đồng bộ đúng lớp để mở buổi. Kết thúc buổi vẫn được phép khi thiết bị mất mạng.
- Đang mở buổi: loại buổi, hạn đúng giờ, hồ sơ lớp và nhập CSV bị khóa ở cả giao diện lẫn máy chủ. Giao lớp khác bị từ chối nếu lớp cũ trên thiết bị còn buổi mở.
- Ví dụ 11/09/2026, buổi sáng hạn 10:00:00: Nguyễn Văn A quét 10:00:00 → Đúng giờ; 10:00:01 → Đi học trễ. Giờ máy chủ là nguồn quyết định; firmware hiển thị kết quả máy chủ. Chưa có hàng đợi quét ngoại tuyến.
- Kết thúc buổi đổi người chưa quét thành Vắng không phép; tổng kết tuần cập nhật. Muốn chuyển thành Vắng có phép phải nhập lý do, được ghi `NHATKY`. Không có chức năng sửa giờ vào.
- Chọn lịch sử để xem từng buổi. Bấm Hiển thị buổi trong Sheet cập nhật **một tab XEM_BUOI dùng lại**, không tạo tab mới mỗi buổi/ngày. Khi xem lại sau này có thể cập nhật tab này lần nữa; dữ liệu gốc vẫn ở bảng chung.

## Wi-Fi và giao diện cục bộ

- Trang ESP32 dùng cho trạng thái, Wi-Fi, tài khoản cục bộ, danh sách đã đồng bộ và bảo trì vân tay. Quyền mở/đóng buổi hoặc giao lớp thuộc dashboard.
- Sau 20 giây chưa nối được Wi-Fi, thiết bị phát `DiemDanh-Setup`, mật khẩu ngẫu nhiên hiện trên LCD/Serial. Kết nối rồi mở `http://192.168.4.1/login`, đăng nhập tài khoản cục bộ, vào Đổi Wi-Fi để lưu mạng 2,4 GHz.
- Bản cài mới tạo tài khoản `admin` với mật khẩu ngẫu nhiên, in một lần trên Serial Monitor 115200 baud. Nếu `/login.json` đã tồn tại, tài khoản và mật khẩu cũ vẫn được giữ. Cấu hình Wi-Fi lưu `/wifi.json`; tài khoản cục bộ vẫn lưu dạng văn bản trong `/login.json`. Trang này dùng HTTP trong mạng tin cậy.

## Bảo vệ và dung lượng

- Các tab hệ thống và danh sách được bảo vệ; tab nội bộ ẩn. Tab lớp chỉ mở vùng cột C của các dòng chưa cấp mã để nhập tên trực tiếp. Giáo viên thao tác qua dashboard, không cấp quyền chỉnh sửa workbook cho người chỉ cần xem.
- Google cho chủ sở hữu quyền gỡ bảo vệ/sửa file. Đây không phải sổ chống sửa bởi chủ sở hữu; người có quyền sửa source cũng có thể thay logic. Nhật ký ghi các thao tác điều hành, duyệt phép và thiết bị, không phải nhật ký chống giả mạo.
- Mật khẩu dashboard lưu Script Properties, token phiên lưu Script Cache tối đa một giờ. Khóa thiết bị chỉ lưu hash tại máy chủ. API GET cũ không còn được chấp nhận. Cần giữ kín khóa và tránh chia sẻ firmware có khóa thật.
- Số tab mới không tăng theo số buổi. Dòng lịch sử vẫn tăng theo học sinh × số buổi. Dashboard cảnh báo từ 7 triệu ô và chặn tạo buổi từ 8,5 triệu ô để dự phòng trước giới hạn 10 triệu ô của Google Sheets.
- Tổ chức một workbook theo năm học, sao lưu trước khi chuyển năm; không tự xóa hoặc gộp mất dữ liệu cũ. Trường lớn/nhiều cổng cần đánh giá tải thực tế và chuyển dữ liệu nghiệp vụ sang database khi vượt khả năng Apps Script.
- Cập nhật dashboard là polling có kiểm tra phiên bản mỗi 5 giây; thiết bị hỏi mỗi 10 giây. Không phải push tức thời. Khi Google chậm hoặc quota bị giới hạn, thời gian cập nhật tăng.

## Đã kiểm thử và cần thử thực tế

Đã biên dịch lại firmware cho `esp32:esp32:esp32`: 1.198.299 byte mã chương trình (91%), RAM tĩnh 54.168 byte (16%). `node tests/attendance.test.cjs` đã qua: xác thực, quyền thiết bị, đa thiết bị, sáng/chiều, đúng ranh giới 10:00:00 và trễ 10:00:01, giữ giờ vào dù gửi giờ giả, chống trùng, chốt vắng/duyệt phép, nhật ký, mất heartbeat, báo cáo và không sinh tab theo buổi. Kiểm thử này cũng bao gồm phục hồi tab lớp chưa ghi vào bảng quản lý và cấp mã từ tên nhập trong Sheet. `node tests/dashboard.test.cjs` đã qua luồng trang trống → tạo/chọn lớp → thêm học sinh → tìm lớp và học sinh. `node tests/page-syntax.test.cjs`, kiểm tra cú pháp `Code.gs` và `appsscript.json` cũng đã qua.

Chưa xác nhận trên Google Sheet trực tuyến hoặc cảm biến thật. Khi có thiết bị: thử một lớp mẫu, hai máy quét trùng, mất Wi-Fi, khởi động lại, đổi lớp, cấp lại khóa, đăng ký/xóa vân tay và kiểm tra bảo vệ Sheet bằng tài khoản người xem.

Tài liệu nền tảng: [giới hạn dung lượng Google Sheets](https://support.google.com/drive/answer/37603), [quyền của chủ sở hữu với vùng bảo vệ](https://developers.google.com/apps-script/reference/spreadsheet/protection), [hàm riêng tư Apps Script](https://developers.google.com/apps-script/guides/html/communication).

Bổ sung kiểm thử bản cổng chung: một ESP32 nhận hai lớp quét xen kẽ, hai buổi sáng/chiều trong cùng ngày, cùng mã học sinh giữa hai lớp, tự tạo định danh khi thêm học sinh không có mạch. Tất cả đã qua trên Sheet giả lập; chưa chạy trên Google Sheet và cảm biến thật.

Kiểm thử bổ sung đã qua: tự cấp mã toàn workbook, chặn sửa mã, sắp tên tiếng Việt và đánh STT, chuyển đổi giữ mã cũ, nhập CSV chỉ có tên, đồng bộ số ngón lên web/Sheet và quét ngón khác của cùng người không tạo lượt trùng. Các thao tác cảm biến vẫn cần xác nhận trên mạch thật.
