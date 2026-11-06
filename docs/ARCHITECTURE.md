# Kiến trúc dashboard giáo viên và thiết bị giám thị

Phạm vi thi KHKT hiện tại: **một ESP32 tại cổng chung**, học sinh nhiều lớp quét xen kẽ. Chế độ `CONG` đồng bộ học sinh của các lớp đang dùng cùng danh sách các buổi đang mở; mạch nhận `classId|studentCode` từ ánh xạ vân tay, tra đúng buổi của lớp đó rồi gửi máy chủ. Có thể mở buổi sáng cho nhiều lớp cùng lúc, đóng từng lớp, sau đó mở buổi chiều riêng. Không cần chuyển lớp trên ESP32 giữa các lượt quét.

Hệ thống vẫn có chế độ `LOP` để giới hạn một thiết bị theo lớp khi mở rộng sau này. Mỗi thiết bị có khóa riêng; nhiều thiết bị có thể cùng điểm danh một lớp. Bản mạch hiện tại giới hạn đồng bộ tối đa 200 học sinh đang học để phù hợp bộ nhớ. Số mẫu vân tay thực tế còn phụ thuộc dung lượng cảm biến; đăng ký nhiều ngón sẽ dùng thêm chỗ.

```text
Giáo viên → Dashboard Apps Script (đăng nhập quản trị)
                    ↓
          Gateway kiểm quyền, khóa ghi và kiểm tra dữ liệu
                    ↓
          Google Sheet: lớp, buổi, trạng thái, nhật ký
                    ↑
ESP32 giám thị → POST HTTPS có mã + khóa riêng
```

Giáo viên tạo lớp, nhập học sinh, giao lớp cho thiết bị, quy định buổi/hạn trễ, mở/đóng buổi và duyệt vắng có phép. ESP32 lấy lớp/buổi từ máy chủ, quét cảm biến và gửi ID học sinh cùng mã buổi. Máy chủ kiểm tra lớp được giao, buổi hiện tại, chống trùng và quyết định đúng giờ/trễ bằng giờ nhận của máy chủ. Cảm biến lưu mẫu vân tay tại từng thiết bị; server không lưu hoặc phân phối mẫu sinh trắc.

Dashboard dùng gateway `uiRequest` có token. Các hàm nghiệp vụ đều có hậu tố `_` để không gọi trực tiếp từ trình duyệt Apps Script. API thiết bị chỉ cho đọc cấu hình/danh sách, quét và xác nhận lệnh vân tay; không cho đổi lớp hoặc điều hành buổi. Mỗi khóa thiết bị có thể cấp lại và thiết bị có thể bị tạm dừng.

Lịch sử lưu trong bảng chung; `XEM_BUOI` là tab xem lại có bộ lọc logic từ dashboard. Không tạo thêm `DD_*` hay tab riêng cho từng buổi. Tổng kết tuần có khoảng ngày thứ Hai–Chủ nhật và trạng thái từng buổi trong mỗi ngày. Thay tên học sinh sau này không làm thay tên trong ảnh chụp buổi cũ.

Đăng ký vân tay chờ tối đa 60 giây tại mạch, trạng thái lệnh hết hạn sau 5 phút. Heartbeat ngoài lúc đăng ký khoảng 10 giây; dashboard hỏi phiên bản mỗi 5 giây. Đây là cập nhật gần thời gian thực. Apps Script có giới hạn thực thi/quota; không coi đây là kiến trúc chấm công quy mô lớn chưa qua thử tải.

Chưa có hàng đợi ngoại tuyến, tự động chia database theo năm, phân quyền nhiều tài khoản giáo viên hoặc đồng bộ mẫu vân tay. Mật khẩu quản trị hiện là một quyền dùng chung cho đơn vị; nhật ký không phân biệt từng giáo viên.
