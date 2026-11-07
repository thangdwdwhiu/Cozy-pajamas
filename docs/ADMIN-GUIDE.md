# Sử dụng Admin Cozy Studio

Đăng nhập tại `/tai-khoan`, sau đó mở `/admin` bằng tài khoản Admin/nhân viên. Giao diện quản trị tách khỏi menu mua sắm.

## Tạo danh mục

1. Chọn tab **Thêm danh mục**.
2. Nhập tên dễ hiểu, ví dụ “Pijama lụa”.
3. Bấm **Tạo danh mục**. Tab **Danh mục** hiển thị danh mục mới và số sản phẩm.

Bạn không cần biết slug. Hệ thống tự tạo phần tên trong địa chỉ web từ tên danh mục, bỏ dấu tiếng Việt và xử lý tên trùng. Khi sửa tên, phần địa chỉ được giữ để tránh gãy liên kết cũ. Không có ô nhập slug thủ công.

## Tạo sản phẩm và chọn danh mục

1. Chọn tab **Thêm sản phẩm**.
2. Nhập tên, chất liệu, mô tả.
3. Trong khung **Phân loại sản phẩm**, chọn **Danh mục sản phẩm**. Đây là lựa chọn bắt buộc.
4. Ở **Hình ảnh sản phẩm**, bấm **Chọn ảnh** hoặc kéo ảnh vào khung. Có thể chọn nhiều ảnh cùng lúc, tối đa 10 ảnh, mỗi ảnh JPG/PNG/WebP không quá 3 MB.
5. Ảnh đầu tiên là ảnh bìa. Nút ngôi sao đặt ảnh khác làm bìa; mũi tên thay đổi thứ tự; thùng rác bỏ ảnh khỏi sản phẩm.
6. Điền giá bán, màu, kích thước và tồn ban đầu cho mỗi kích thước.
7. Chọn hiển thị/ẩn và nổi bật; bấm **Tạo sản phẩm**.

Không cần nhập đường dẫn ảnh: hệ thống tự upload và gắn ảnh. Các ảnh tải thành công không làm mất thông tin biểu mẫu; nếu có ảnh lỗi, sửa/tải lại ảnh đó rồi lưu. Địa chỉ sản phẩm cũng tự sinh; khi trùng tên, hệ thống thêm hậu tố số.

## Sửa sản phẩm

Tab **Sản phẩm** → tìm theo tên/lọc danh mục/trạng thái → nút bút chì. Danh mục hiện rõ trong bảng và có thể đổi trong biểu mẫu. Thêm/bỏ/đổi ảnh bìa rồi **Lưu thay đổi**. Kiểm tra trang sản phẩm để thấy gallery ảnh và thumbnail.

Giá/màu/size/tồn kho quản lý trong tab **Kho hàng**. Có thể thêm biến thể, đổi giá và nhập/xuất kho có lý do. Bỏ ảnh khỏi sản phẩm không xóa vật lý file khỏi kho ảnh, nhằm tránh làm hỏng ảnh của lịch sử đơn hàng hoặc các tham chiếu khác; dọn ảnh không dùng là công việc vận hành riêng.

Khi triển khai Vercel, phải cấu hình Supabase Storage theo [hướng dẫn](DEPLOY-VERCEL-SUPABASE.md). Với VPS/local, ảnh có thể lưu trong thư mục/volume uploads. Trên Vercel không cấu hình storage, backend báo lỗi rõ ràng thay vì ghi ảnh vào ổ đĩa tạm.
