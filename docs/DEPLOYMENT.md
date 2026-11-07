# Triển khai

**Hướng dẫn chi tiết mới, ưu tiên đọc các tài liệu này:**

- [Vercel + Supabase: database, ảnh, domain, migrations, cron](DEPLOY-VERCEL-SUPABASE.md).
- [VPS: Docker Compose, HTTPS, backup và cập nhật](DEPLOY-VPS.md).
- [Điền từng biến SePay và form webhook](PAYMENTS.md).

Compose đã bổ sung service `tools` để chạy migrations và bootstrap Admin; các lệnh đầy đủ nằm trong hướng dẫn VPS. Adapter Supabase Storage đã có trong code, nhưng chưa chạy kiểm chứng trên tài khoản Supabase thật.

## Local production build

```powershell
npm run build
npm start
```

`dev`/`start` chạy cả Next và worker expiry. Tắt server dev trước khi start để tránh trùng port. PostgreSQL service phải đang hoạt động. `APP_URL` cần khớp địa chỉ người dùng mở vì CSRF kiểm tra origin.

## VPS

Node 22, PostgreSQL 18, HTTPS reverse proxy (Caddy/nginx), tài khoản DB ứng dụng riêng với quyền tối thiểu, backup và volume `uploads/`. Không sử dụng superuser postgres local cho production. Đặt server sau proxy, giới hạn body 6 MB và rate limit mạng tại proxy. Cấu hình cookie Secure qua APP_URL HTTPS.

Chạy `npm ci`, `npm run db:migrate`, `npm run db:seed`, `npm run build`, `npm start` dưới systemd/process manager. Không log `.env`/headers/cookie/body webhook. Khóa `.env` chỉ cho tài khoản vận hành đọc. Giữ `PAYMENT_LIVE_ENABLED=false` cho đến khi hoàn thành kiểm chứng theo PAYMENTS.md.

## Docker Compose (chưa kiểm chứng deploy thực)

Dockerfile dùng standalone Next. Compose có PostgreSQL, app và worker. Thêm `POSTGRES_PASSWORD` ngẫu nhiên vào `.env` riêng, đặt `APP_URL=https://domain-thuc-te`. Không dùng nguyên .env local lên Internet.

Build cần không truy cập database ở build time: sitemap được cấu hình dynamic. Chạy migration trước khi mở app. Một cách: chạy service db, dùng một container build-stage với DATABASE_URL trỏ db để chạy `npm run db:migrate` và `npm run db:seed`, rồi khởi động app/worker. Hoặc dùng Node trên host kết nối database qua port chỉ bind localhost tạm thời. Không public cổng PostgreSQL.

```powershell
docker compose up -d db
docker compose build app
# Chạy migration/seed với network và env production đúng trước khi mở traffic.
docker compose up -d app worker
```

Volume database và uploads cần backup. App bind 127.0.0.1:3000 để reverse proxy trên host. Container worker gọi API qua mạng nội bộ bằng CRON_SECRET. Đừng gắn source `.env` vào image hoặc commit token.

## Backup & phục hồi

Dùng pg_dump custom-format, lưu dưới `D:\MY WEBSITE\Cozy pajamas\backups` khi local; cấp credential qua pgpass/secret của môi trường, không đưa mật khẩu vào lệnh/log. Backup cả uploads. Thử phục hồi vào database riêng trước khi coi backup đáng tin. Chưa tạo dump thực tế trong phiên này.

## Giới hạn đã biết

Chưa test Docker/VPS/HTTPS thật, SMTP, đơn vị vận chuyển, SePay public webhook. Dashboard có giới hạn 500 đơn; cần truy vấn báo cáo phân trang theo ngày khi dữ liệu lớn. Tìm catalog hiện tải cả danh sách, phù hợp seed nhỏ; cần chuyển lọc/phân trang sang server khi catalog lớn. Rate limit email/global không thay thế WAF/network throttling. Cookie session chưa có MFA; cân nhắc MFA cho quản trị trước khi mở bán rộng.
