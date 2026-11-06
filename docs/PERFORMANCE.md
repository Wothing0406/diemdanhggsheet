# Hiệu năng và độ phản hồi

Bản cổng chung KHKT đồng bộ roster nhiều lớp một lần và nhận bản đồ buổi qua heartbeat. Giới hạn source hiện tại là 200 học sinh active cho một mạch để tránh dùng bộ nhớ không giới hạn; dung lượng mẫu còn phụ thuộc cảm biến. Phiên bản roster thay đổi khi thêm/sửa học sinh, thiết bị phải xác nhận phiên bản mới trước khi dashboard cho mở buổi.

## Nguyên nhân lag đã xác định và trạng thái sửa

### Polling toàn bộ danh sách

`fingerPage.h` gọi lại danh sách vân tay và kiểm tra học sinh mỗi 15 giây. `userPage.h` cũng tải lại toàn bộ danh sách mỗi 15 giây. Việc này tạo request và phân tích JSON ngay cả khi không có thay đổi.

Đã bỏ polling hai danh sách này. Trang vân tay tải lại sau thông báo WebSocket hoặc thao tác xóa; trang học sinh tải khi mở. Giao diện Apps Script chỉ hỏi phiên bản nhẹ mỗi 10 giây và tải trạng thái đầy đủ khi dữ liệu thay đổi.

### Đọc và phân tích cùng file nhiều lần

Endpoint `/getFingerList` duyệt ánh xạ vân tay rồi gọi `getName()` cho từng học sinh. Mỗi lần `getName()` lại mở và deserialize `/userlist.json`. Chi phí tăng theo số vân tay và là điểm nghẽn chính của trang quản lý.

Đã sửa endpoint để parse `/userlist.json` một lần cho mỗi request.

### Công việc chặn vòng lặp

- HTTP tới Google có timeout dài.
- Các thông báo LCD dùng nhiều `delay()` từ một đến vài giây.
- Web server, WebSocket, quét vân tay và Google sync dùng chung vòng `loop()`.

Khi một phần bị chặn, toàn bộ giao diện có cảm giác treo.

### Cấp phát động lặp lại

Các `DynamicJsonDocument(8192)` và `String` lớn được tạo nhiều lần. Chạy lâu có thể phân mảnh heap và làm độ phản hồi giảm dần.

## Nguyên tắc tối ưu

1. Cache roster đã parse và chỉ làm mới sau khi đồng bộ thành công.
2. Một request chỉ mở và parse mỗi file JSON tối đa một lần.
3. Không polling toàn bộ danh sách theo chu kỳ ngắn.
4. Dùng WebSocket để báo thay đổi; vẫn giữ nút làm mới thủ công.
5. Thay `delay()` bằng state machine dựa trên `millis()`.
6. Không gọi Google đồng bộ bên trong handler phục vụ trang web.
7. Chia danh sách dài thành trang hoặc trả trường dữ liệu tối thiểu.
8. Theo dõi `ESP.getFreeHeap()` trước/sau đồng bộ và request lớn.

## Thứ tự sửa để thấy hiệu quả sớm

1. Sửa `/getFingerList` để chỉ parse roster một lần.
2. Bỏ `setInterval(..., 15000)` ở hai trang danh sách.
3. Chỉ tải lại sau thao tác thêm/xóa, WebSocket hoặc nút làm mới.
4. Loại bỏ các `delay()` dài khỏi đường phục vụ web.
5. Chuyển đồng bộ Google thành trạng thái nền, trả request ngay.
6. Thêm `dataVersion` để không tải roster khi không đổi.

## Tiêu chí chấp nhận

- Trang chính phản hồi trong mạng LAN ngay cả khi Google chậm hoặc mất kết nối.
- Thao tác mở danh sách không đọc `userlist.json` theo số lượng vân tay.
- Không có request tự động tải toàn bộ danh sách mỗi 15 giây.
- Quét vân tay vẫn hoạt động khi người quản trị mở trang đăng nhập hoặc cấu hình Wi-Fi; trang thiết lập vân tay có thể tạm dừng chế độ điểm danh.
- Sau nhiều chu kỳ đồng bộ, heap không giảm liên tục.
