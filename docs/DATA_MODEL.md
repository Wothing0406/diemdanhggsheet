# Mô hình dữ liệu thực thi

Tiêu đề Sheet được Việt hóa, dữ liệu đọc theo vị trí cột cố định. Không di chuyển cột, sửa mã, giờ vào hoặc trạng thái trực tiếp. Chạy thiết lập sẽ cập nhật tiêu đề nhưng giữ nguyên dữ liệu theo vị trí cũ.

| Tab | Vai trò | Quyền thao tác |
|---|---|---|
| LOP | Mã/tên lớp, tab nguồn, phiên bản | Tạo qua dashboard; mã cố định |
| LOP_mã | Định danh, mã HS, họ tên, đang học, STT theo tên, số ngón đã xác nhận | Dashboard chỉ nhập tên khi thêm; máy chủ cấp mã cố định |
| BUOIDIEMDANH | Mã buổi, lớp, ngày, sáng/chiều/tối, giờ mở/hạn trễ/đóng, trạng thái | Máy chủ quản lý |
| CHITIET_BUOI | Ảnh chụp học sinh, trạng thái, giờ vào, lý do | Máy chủ; duyệt phép có lý do |
| DIEMDANH | Nhật ký lượt quét và thiết bị ghi nhận | Chỉ thêm; lượt đầu hợp lệ quyết định giờ vào |
| THIETBI | ID, lớp giao, heartbeat, lớp thực tế, bật/tạm dừng, tên, chế độ CONG/LOP, phiên bản đã đồng bộ | Dashboard; không lưu khóa tại đây |
| LENH | Mã lệnh, học sinh, thiết bị đích, trạng thái | Dashboard gửi, đúng thiết bị xác nhận |
| NHATKY | Thời gian, thao tác, đối tượng, lý do | Máy chủ ghi; quyền quản trị chung |
| XEM_BUOI | Ngày/buổi/lớp, tên HS, trạng thái tiếng Việt, giờ vào | Chỉ xem, tái sử dụng tab |
| TONG_TUAN | Khoảng tuần, số buổi, lượt vắng/trễ, tên kèm số lần | Sinh từ buổi đã chốt |
| TUAN_7_NGAY | Từng học sinh, 7 ngày; mỗi ngày phân biệt sáng/chiều/tối | Báo cáo chỉ xem |
| DSVANG | Danh sách vắng không phép/có phép đã chốt | Báo cáo chỉ xem |
| VANTAY | Số ngón của học sinh theo thiết bị, thời điểm xác nhận | Thiết bị báo, không chứa mẫu sinh trắc |

Mã nội bộ trong tab ẩn/API giữ `OPEN`, `CLOSED`, `PENDING`, `PRESENT`, `LATE`, `ABSENT`, `EXCUSED` để tương thích dữ liệu cũ. Dashboard và tab xem hiển thị tiếng Việt. Không thay các mã này thủ công.

Mã buổi: `10A2-20260911-SANG`; khóa học sinh tại mạch: `10A2|HS001`. Ánh xạ cũ không có lớp tiếp tục thuộc `DEFAULT`. Chuyển lớp của học sinh có vân tay cần đăng ký/ánh xạ phù hợp; không tự xóa mẫu cảm biến.

Tab `LOP` có **định danh lớp nội bộ** ở cột A và **mã lớp hiển thị** ở cột F. Với lớp cũ, cột F trống thì mã hiển thị mặc định bằng cột A. Nếu tab lớp bị xóa rồi tạo lớp mới cùng mã hiển thị `12C20`, hệ thống cấp định danh mới như `12C20_V2` và tab `LOP_12C20_V2`; buổi học, vân tay và báo cáo vẫn dùng định danh nội bộ để tách hai lần tạo lớp. CSV nhập vào lớp mới dùng `ma_lop=12C20`; danh sách và lịch sử của lớp cũ không được chuyển sang lớp mới.

Chế độ cổng chung lưu roster nhiều lớp trong `/userlist.json` và `/studentids.json` bằng khóa có lớp. API `control`/`session` trả bản đồ `sessions[classId]`. Khi quét, mạch lấy lớp từ ánh xạ vân tay thay vì lấy lớp đang chọn trên dashboard. Mở hai buổi của hai lớp cùng lúc được phép; một lớp vẫn chỉ có một buổi đang mở.

Thêm học sinh chỉ nhập họ tên. Máy chủ cấp mã dạng `HS000001`, dùng chung bộ đếm toàn workbook trong Script Properties và khóa khi ghi để tránh trùng. Mã cũ được giữ nguyên, bộ cấp mã bỏ qua các số đã có trong dữ liệu cũ. Không cho nhập mã tùy ý hoặc thay mã khi sửa hồ sơ. Tên trùng vẫn có thể là hai học sinh khác nhau, mỗi người có mã riêng.

Trong tab `LOP_*`, vùng **cột C dưới học sinh cuối cùng** là vùng nhập trực tiếp từ Google Sheet. Nhập một tên hoặc dán nhiều tên vào đó sẽ gọi trình kích hoạt chỉnh sửa cài bởi `setupAttendanceSheets`: hệ thống cấp cùng lúc định danh cột A, mã cột B, trạng thái cột D, STT cột E và thống kê cột F. Danh sách được sắp lại theo tên sau khi cấp mã, vì vậy học sinh vừa nhập có thể chuyển sang dòng khác. Các dòng đã cấp mã và mọi cột khác đều được bảo vệ; muốn sửa tên đã có thì dùng dashboard. Khi buổi của lớp đang mở, vùng nhập tên cũng bị khóa. Trình kích hoạt không chạy khi code tự ghi vào Sheet, nên thao tác từ web/CSV vẫn đi qua các hàm hiện có.

STT là thứ tự hiển thị theo **tên gọi (từ cuối) A–Z tiếng Việt**, rồi họ tên, rồi mã nếu trùng. Đổi tên có thể đổi STT nhưng không đổi mã, lịch sử hoặc ánh xạ vân tay. Cột STT được bổ sung cuối tab danh sách (cột E) để giữ nguyên bốn cột dữ liệu cũ; web và `XEM_BUOI` hiển thị STT đầu bảng. Báo cáo tuần sắp theo cùng quy tắc, STT nằm ở cột cuối tab `TUAN_7_NGAY`.

Mở buổi tạo `PENDING`; quét trước hoặc đúng hạn chuyển `PRESENT`, sau hạn chuyển `LATE`; đóng buổi đổi người còn chờ thành `ABSENT`. Chỉ trạng thái `ABSENT` của buổi đã đóng được duyệt thành `EXCUSED` kèm lý do. Không cho sửa giờ vào. Máy chủ từ chối lượt của buổi cũ để không ghi nhầm khi thiết bị chưa nhận buổi mới.

CSV thêm mới chỉ cần `ho_ten`, có thể kèm `ma_lop,ten_lop`; máy chủ cấp mã cho mỗi dòng. File có `ma_hoc_sinh` hoặc `studentId,studentCode` chỉ được cập nhật học sinh đã tồn tại, không dùng mã tùy chọn để tạo mới. Nhập file là thêm/cập nhật, không xóa học sinh ngoài file. Giới hạn 500 dòng/lần; kiểm tra toàn bộ file trước khi cấp mã/ghi. Nhập lại file chỉ có tên tạo học sinh mới, nên cần kiểm tra trước khi nhập lại.

Một học sinh có nhiều mẫu cảm biến: nhiều `fingerId` cùng trỏ về `classId|studentCode`. Đăng ký thêm ngón không thay mẫu cũ; quét ngón bất kỳ vẫn chỉ ghi nhận một lượt trong mỗi buổi. `VANTAY` chỉ lưu số ngón theo thiết bị/học sinh do firmware báo, không lưu dữ liệu sinh trắc. Cột F của tab lớp tóm tắt theo thiết bị, ví dụ `ESP01: 2 ngón`; đây là số liệu lần xác nhận gần nhất. Lệnh xóa hiện xóa tất cả ngón của học sinh trên thiết bị đã chọn. Số ngón được cập nhật qua heartbeat sau thao tác; firmware cũ chưa báo thì web/Sheet hiển thị chưa có số liệu.

Khóa thiết bị hash lưu Script Properties, token dashboard lưu CacheService, mật khẩu quản trị nằm Script Properties. Firmware cần `DEVICE_ID`, `DEVICE_KEY`, URL `/exec`. Không ghi khóa thật vào tài liệu hoặc chia sẻ source đã cấu hình.
