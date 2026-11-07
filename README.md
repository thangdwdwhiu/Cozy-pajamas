# Cozy pajamas

Website bán pijama tiếng Việt, Next.js App Router + TypeScript + PostgreSQL + Drizzle. Mã nguồn ở `D:\MY WEBSITE\Cozy pajamas`.

## Chạy trên máy của bạn

**Hướng dẫn mới:** [Admin: sản phẩm, danh mục và nhiều ảnh](docs/ADMIN-GUIDE.md) · [Deploy Vercel + Supabase](docs/DEPLOY-VERCEL-SUPABASE.md) · [Deploy VPS](docs/DEPLOY-VPS.md) · [Điền thông tin SePay và webhook](docs/PAYMENTS.md).

Đã tạo database, chạy migrations và seed. Mở PowerShell trong thư mục dự án:

```powershell
npm run dev
```

- Cửa hàng: http://localhost:3000
- Đăng nhập: http://localhost:3000/tai-khoan
- Quản trị: http://localhost:3000/admin
- Chạy dev/start đồng thời khởi động worker giải phóng đơn chuyển khoản quá hạn mỗi phút.
- Tài khoản Admin: xem `ADMIN_EMAIL` và `ADMIN_PASSWORD` trong `.env` bằng trình soạn thảo. Mật khẩu được sinh ngẫu nhiên, không in ra terminal hay lưu vào README. `.env` không được commit.
- Voucher seed: `COZY10`, giảm 10%, đơn tối thiểu 300.000đ.
- 8 sản phẩm, 32 biến thể. Ảnh SVG là minh họa tự tạo, không phải ảnh hàng thực. Admin có thể tải JPG/PNG/WebP thực tế.

## Cài đặt từ đầu

Node.js 22+, PostgreSQL 18. Sao chép `.env.example` thành `.env`, cấu hình kết nối database riêng. Không ghi đè `.env` đã có.

```powershell
npm ci
npm run db:setup
npm run db:migrate
npm run db:seed
npm run dev
```

`db:setup` tạo database nếu chưa tồn tại và sinh thông tin Admin/cron còn thiếu. Seed idempotent, không đặt lại mật khẩu hoặc tồn kho đã có. Cache npm được đặt trên ổ D qua `.npmrc`; sửa đường dẫn này nếu dùng máy khác. Không chạy `scripts/check-local.ts` trên máy khác: đó là tiện ích phục hồi kết nối từ tệp yêu cầu do chủ dự án cung cấp.

## Kiểm tra

```powershell
npm run typecheck
npm test
npm run build
# Khi server local đang chạy; sử dụng Microsoft Edge đã có:
npm run test:browser
# Luồng Admin mới: danh mục, slug tự động, upload nhiều ảnh, gallery:
npm run test:admin
# Chỉ kiểm tra cấu hình SePay, không gửi giao dịch:
npm run payment:check
```

Integration tests tự tạo `cozy_pajamas_test`, không dùng bảng bán hàng thật. Browser tests dùng database local, tạo đơn có tên Browser Test, hủy đơn sau khi kiểm tra; nếu test bị ngắt, kiểm tra và hủy đơn test còn lại trong Admin. Ảnh kiểm tra lưu trong `docs/screenshots/`.

## Các luồng đã triển khai

- Catalog có tìm kiếm, danh mục, size, khoảng giá, sắp xếp; trang chi tiết, chọn biến thể, tồn kho, hướng dẫn size, đánh giá đã mua.
- Giỏ hàng/yêu thích lưu trên trình duyệt; đăng ký/đăng nhập, sổ địa chỉ, lịch sử đơn hàng.
- Checkout khách vãng lai hoặc tài khoản; COD và đơn QR thử nghiệm; server tính giá/voucher/phí giao hàng, snapshot thông tin đơn, khóa tồn kho, chống đơn trùng.
- Theo dõi đơn bằng phiên chủ sở hữu hoặc token riêng trong localStorage; tự làm mới trạng thái; hủy đơn chờ, yêu cầu đổi trả trong 7 ngày sau giao hàng.
- Admin: dashboard, sản phẩm, danh mục, biến thể, giá, upload ảnh, lịch sử nhập/xuất kho, trạng thái đơn, ghi nhận COD, khách hàng/vai trò, voucher, duyệt đánh giá, đổi trả, nội dung, nhật ký, giao dịch cần đối soát.
- SePay: HMAC trên raw body và timestamp, dedup giao dịch, xác minh tài khoản/ngân hàng/số tiền/mã đơn/trạng thái/môi trường, lưu các ngoại lệ đối soát.
- Metadata, sitemap, robots, Product JSON-LD và catalog render từ server.

## Trạng thái thực tế và việc cần trước khi mở bán

Thanh toán thật **đang tắt**. Chưa cấu hình webhook công khai/secret trên SePay và chưa kiểm thử với webhook từ tài khoản SePay của bạn. Xem [hướng dẫn thanh toán](docs/PAYMENTS.md).

Chưa tích hợp đơn vị vận chuyển, gửi email/SMS, khôi phục mật khẩu qua email, hoàn tiền ngân hàng tự động, hoặc đồng bộ đối soát qua API khi webhook mất hoàn toàn. Admin hiện nhận diện giao dịch bất thường để kiểm tra ngoài hệ thống, không có nút tự coi chuyển khoản đó là đã thanh toán. Đổi trả không tự hoàn tiền hay nhập kho; cần kiểm tra hàng và điều chỉnh kho có lý do.

Chưa có đồng bộ giỏ hàng/yêu thích giữa các thiết bị; tài khoản có thể lưu nhiều địa chỉ nhưng checkout nhập địa chỉ nhận riêng. Thông tin công ty, kênh hỗ trợ và chính sách mẫu cần chủ cửa hàng rà soát trước khi mở bán. Dashboard lấy tối đa 500 đơn gần nhất; không thay thế báo cáo kế toán. Bộ sưu tập hiện dùng danh mục. Sản phẩm hỗ trợ tối đa 10 ảnh, chọn ảnh bìa và thứ tự; slug sản phẩm/danh mục sinh tự động.

Build và kiểm thử local đã chạy; cấu hình Docker/VPS được chuẩn bị nhưng chưa triển khai kiểm chứng trên máy chủ production. Xem [triển khai](docs/DEPLOYMENT.md), [database](docs/DATABASE.md), [tiến độ](docs/PROGRESS.md).
