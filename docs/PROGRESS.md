# Cozy pajamas — tiến độ

## Quyết định

- Next.js App Router + TypeScript, Node.js runtime; PostgreSQL 18 + Drizzle ORM.
- Giá VND là số nguyên; giao dịch database và khóa hàng cho tồn kho, voucher và thanh toán.
- Phiên đăng nhập opaque trong database, cookie HttpOnly, kiểm tra Origin cho mutation.
- Thanh toán thật tắt; giữ nguyên cấu hình có sẵn. Không đưa secret vào mã nguồn.

## Kế hoạch

1. Khảo sát, kết nối database, schema/migrations/seed.
2. Catalog, sản phẩm, giỏ hàng, checkout, tài khoản, theo dõi đơn.
3. Admin, tồn kho, đơn hàng, khuyến mãi, nội dung.
4. SePay, đối soát, kiểm thử cạnh tranh và phân quyền.
5. Build, kiểm tra UI, tài liệu triển khai.

## Hiện trạng

- Thư mục ban đầu chỉ có .env. Node 22.20.0, npm 10.9.3, PostgreSQL 18.1 có sẵn.
- SePay token và thông tin ngân hàng đã cấu hình; webhook secret trống; live=false.
- Chưa xác minh thanh toán với dịch vụ SePay thực.

## Đã triển khai và kiểm chứng — 07/11/2026

- Database local kết nối thành công sau sửa DATABASE_URL không hợp lệ theo thông tin được chủ dự án cấp. Hai migrations đã áp dụng, seed 8 sản phẩm/32 biến thể, Admin và voucher.
- Frontend responsive, SSR catalog, SEO metadata/sitemap/JSON-LD, sản phẩm, lọc, giỏ/yêu thích, tài khoản, checkout, theo dõi đơn và đổi trả.
- Backend xác thực, session, CSRF, kiểm tra quyền, khóa tồn kho/voucher, snapshot đơn, upload WebP an toàn, audit.
- Admin sản phẩm/danh mục/biến thể/kho/đơn/khách hàng/vai trò/voucher/nội dung/đánh giá/đổi trả/đối soát.
- Module SePay và simulator local; production payment vẫn tắt, giữ nguyên token và ngân hàng. Không gửi yêu cầu chuyển tiền thật.
- 10/10 integration tests PostgreSQL riêng đạt; production build và TypeScript đạt.
- Browser test Edge desktop 1440px/mobile 390px đạt: mua guest, hủy/hoàn kho, Admin đăng nhập, quản lý sản phẩm, upload JPG/PNG → WebP, từ chối SVG, IDOR, CSRF. Không ghi nhận lỗi JavaScript, không tràn ngang mobile.
- Screenshots: docs/screenshots/{desktop,mobile,admin}.png.
- Đã chạy kiểm thử trình duyệt lần cuối trên standalone production server (`npm start`), gồm upload/serve WebP. Font Lora và Be Vietnam Pro được lưu local kèm giấy phép. Server do agent mở để QA được dừng sau kiểm tra; dùng npm run dev hoặc npm start để mở lại.
- npm audit production: 0 lỗ hổng. Dev tool drizzle-kit kéo esbuild cũ: 4 moderate transitive advisories; không dùng esbuild serve, không public công cụ DB. Chưa cập nhật cưỡng bức về drizzle-kit cũ vì có thể phá migrations.

## Còn lại / cần dữ liệu bên ngoài

- URL HTTPS public, secret webhook và kiểm chứng SePay thực; cần chủ cửa hàng cấu hình tại SePay, không gửi secret qua chat.
- Ảnh hàng thực và nội dung liên hệ/pháp nhân/chính sách chính thức (Admin đã hỗ trợ upload và nội dung).
- Chưa có email reset password, shipping API, email/SMS, tự động hoàn tiền, tự động đối soát API khi mất webhook. Chi tiết giới hạn ở README.
- Docker/VPS mới chuẩn bị cấu hình, chưa chạy deploy; cần domain/host thực tế.

## Tiếp tục phiên sau

### Cập nhật Admin / deployment ngày 07/11/2026

- Thiết kế lại Cozy Studio: sidebar, bảng sản phẩm, form 2 cột, preview và mobile; không còn header/footer mua sắm trong Admin.
- Tách tab Sản phẩm, Thêm sản phẩm, Danh mục, Thêm danh mục, Kho hàng. Danh mục của từng sản phẩm hiển thị trong bảng và chọn bằng dropdown.
- Không có ô nhập slug/đường ảnh. Slug tự sinh ở backend với xử lý tên trùng; đổi tên giữ URL cũ. Tạo sản phẩm kèm các size/giá/tồn kho ban đầu trong transaction.
- Migration 0002 đã chạy local: gallery images có thứ tự, backfill ảnh cũ. Upload nhiều file (mỗi file 3 MB, tối đa 10 ảnh), đặt ảnh bìa, đổi thứ tự, bỏ ảnh, gallery thumbnail ở trang khách hàng.
- Đã thêm Supabase Storage adapter cho Vercel, pool DB serverless max=1, DIRECT_DATABASE_URL cho migration, cron GET có Bearer auth, vercel.json. Supabase adapter được test bằng HTTP mock, chưa xác minh với bucket thật.
- Hướng dẫn chi tiết: docs/ADMIN-GUIDE.md, DEPLOY-VERCEL-SUPABASE.md, DEPLOY-VPS.md, PAYMENTS.md. Đã có env-init, production-db, create-admin, payment-check, Docker tools service và mẫu backup/Caddy/systemd.
- Kết quả: 14/14 tests đạt; TypeScript/build đạt; test:admin và test:browser đạt. Browser kiểm tra multi-upload, không mất form, chọn danh mục, tự sinh slug, cover/order/removal persistence, gallery và mobile.
- `docker compose --env-file .env.example config --quiet` đạt với mật khẩu giả chỉ phục vụ kiểm tra cú pháp. Chưa build/run Docker vì Docker Desktop Linux Engine không chạy; không tự khởi động/deploy dịch vụ production.
- Kiểm tra config hiện tại: BANK_ACCOUNT_NUMBER chưa qua kiểm tra định dạng chữ số, SEPAY_WEBHOOK_SECRET thiếu; PAYMENT_LIVE_ENABLED=false. Cần chủ cửa hàng nhập giá trị thật trong cấu hình riêng theo PAYMENTS.md. Không đổi các giá trị ngân hàng/token có sẵn và không gửi tiền thật.
- Ảnh kiểm tra mới: docs/screenshots/admin-redesign.png, admin-products.png, admin-product-editor.png, admin-mobile.png. Fixture QA browser tạo được dọn theo ID; không xóa sản phẩm do người dùng tạo.

Đọc README, tài liệu PAYMENTS, DEPLOYMENT trước. Không seed reset hay xóa dữ liệu. Giữ PAYMENT_LIVE_ENABLED=false cho đến khi chủ cửa hàng đồng ý. Dùng database test riêng cho các bài cạnh tranh. Không in .env. Tài khoản admin nằm trong .env local.

# Cập nhật sửa tạo sản phẩm và tự khởi tạo database — 07/11/2026

- Thay thông báo validation chung bằng thông báo tiếng Việt theo trường ở API và Admin. Dùng chung quy tắc validation; chấp nhận giá VND có dấu phân cách hàng nghìn; giữ bản nháp và ảnh khi lỗi.
- Next instrumentation tự chạy migrations trước khi phục vụ request; khóa PostgreSQL chống chạy đồng thời, kiểm tra checksum migration cũ và bootstrap Admin mà không đổi mật khẩu đã có. Không seed hay reset dữ liệu.
- Đóng gói SQL migrations cho standalone/Vercel/Docker. Bổ sung compose.supabase.yaml cho VPS kết nối Supabase Direct, không ghi đè URI sang DB nội bộ.
- Đã qua 18 bài test, build production và kiểm thử Admin trên Edge: lỗi mô tả, HTTP 422 theo trường, sửa rồi lưu thành công với nhiều ảnh và giá 350.000.
- Đã chạy Next production với database local trống riêng: tự tạo 16 bảng + Admin, trả HTTP thành công, không chạy migration thủ công. `npm run test:startup` tái hiện kiểm tra này sau build.
- Chưa triển khai hay kiểm chứng kết nối Supabase/Vercel/VPS thật. Cấu hình hiện tại trong .env vẫn trỏ PostgreSQL local. Tài liệu đã chuyển hướng dẫn sang Direct cổng 5432 và AUTO_MIGRATE.
