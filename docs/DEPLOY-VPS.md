# Deploy Cozy pajamas lên VPS — Docker, PostgreSQL và HTTPS

Hướng dẫn chính dùng VPS Ubuntu 24.04/26.04 LTS, Docker Compose, Caddy trên host. Máy Windows của bạn vẫn dùng `.env` local riêng; không thay cấu hình local bằng thông tin VPS. Những lệnh bash dưới đây chạy sau khi SSH vào VPS, trừ phần ghi rõ PowerShell.

Cấu hình triển khai đã chuẩn bị trong repository; chưa có VPS/domain thực để chạy xác minh. Hãy dùng một máy mới hoặc kiểm tra cổng/dịch vụ hiện có trước khi cài, tránh đè website đang chạy.

## 1. Chuẩn bị

- Một VPS Linux 64-bit; dung lượng/RAM cần đủ cho PostgreSQL và build Next. Khoảng 2 vCPU/4 GB RAM là điểm bắt đầu thực dụng cho cửa hàng nhỏ, không phải cam kết tải.
- Domain và quyền sửa DNS.
- Repository Git private đã có source; xem phần Git trong [hướng dẫn Vercel](DEPLOY-VERCEL-SUPABASE.md).
- Tài khoản SSH có sudo, ưu tiên SSH key.

Tại DNS, thêm bản ghi `A` cho `shop.tenmiencuaban.vn` trỏ IP VPS. Chỉ thêm AAAA nếu IPv6 của VPS thực sự hoạt động. Mở cổng SSH, 80 và 443 ở firewall nhà cung cấp. Không mở PostgreSQL 5432 ra Internet. Compose chỉ bind web 3000 vào `127.0.0.1`.

## 2. Cài Docker và Caddy

SSH vào VPS:

```bash
ssh ubuntu@IP_VPS
sudo apt update
sudo apt install -y git curl ca-certificates gnupg
docker --version
docker compose version
```

Nếu Docker/Compose đã có và hoạt động, bỏ qua bước cài Docker. Nếu chưa có, làm mục **Install using the apt repository** tại [Docker Engine for Ubuntu](https://docs.docker.com/engine/install/ubuntu/): thêm GPG key/repository chính thức rồi cài `docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin`. Không chạy phần gỡ package trên máy đang có dịch vụ khác mà chưa kiểm tra.

Để người dùng SSH hiện tại dùng Docker:

```bash
sudo usermod -aG docker "$USER"
```

Đăng xuất SSH rồi đăng nhập lại. Quyền Docker có thể điều khiển máy chủ; chỉ cấp cho tài khoản vận hành.

Cài Caddy từ repository chính thức theo mục **Debian, Ubuntu, Raspbian** tại [Caddy installation](https://caddyserver.com/docs/install). Kiểm tra:

```bash
docker run --rm hello-world
caddy version
```

Docker có quy tắc publish port riêng; không chỉ dựa vào UFW để bảo vệ port container. Compose của dự án không publish cổng DB và chỉ publish app trên loopback. [Lưu ý firewall của Docker](https://docs.docker.com/engine/install/ubuntu/).

## 3. Đưa source lên VPS

```bash
sudo mkdir -p /srv/cozy
sudo chown "$USER":"$USER" /srv/cozy
git clone https://github.com/TAI-KHOAN/REPOSITORY.git /srv/cozy
cd /srv/cozy
git rev-parse --short HEAD
```

Thay URL repo. Với repo private, dùng SSH deploy key có quyền đọc hoặc cơ chế đăng nhập GitHub được tổ chức chấp nhận; không đặt token trong URL lưu vào shell history. Không copy node_modules hoặc .next từ Windows lên Linux.

## 4. Tạo cấu hình production

Host không cần cài Node khi chạy Docker. Tạo `.env` từ template bằng một container Node tạm:

```bash
cd /srv/cozy
docker run --rm -u "$(id -u):$(id -g)" -v "$PWD:/work" -w /work node:22-alpine node scripts/env-init.mjs .env
chmod 600 .env
nano .env
```

Script không ghi đè `.env` đã tồn tại. Nếu có file rồi, chỉ chỉnh bằng editor. Các secret ngẫu nhiên đã sinh nằm trong file, không in ra màn hình.

Điền các dòng sau:

```dotenv
APP_URL=https://shop.tenmiencuaban.vn
DATABASE_URL=postgresql://cozy:MAT_KHAU_DB@db:5432/cozy_pajamas
DIRECT_DATABASE_URL=
POSTGRES_PASSWORD=MAT_KHAU_DB
MEDIA_STORAGE=local
ADMIN_EMAIL=email-quan-tri-cua-ban
PAYMENT_LIVE_ENABLED=false
```

`POSTGRES_PASSWORD` là biến bổ sung cho Docker, dùng mật khẩu mạnh mới. Nên dùng chuỗi hex ngẫu nhiên để tránh ký tự phải encode trong URI và tránh `$` bị Compose nội suy. Điền cùng mật khẩu trong DATABASE_URL; Compose cũng tự đưa URI đúng vào app/tools. Không dùng mật khẩu postgres local. Database service chỉ nhìn thấy trên mạng Compose bằng hostname `db`.

Giữ ADMIN_PASSWORD/CRON_SECRET đã sinh. Điền thông tin ngân hàng và SePay theo [PAYMENTS.md](PAYMENTS.md). Bỏ trống các biến Supabase nếu lưu ảnh trong volume VPS. Không thêm đường `D:\...` vào UPLOAD_DIR; app Docker mặc định `/app/uploads`.

Không chạy `docker compose config` rồi gửi nguyên kết quả cho người khác vì nó có thể hiển thị biến bí mật. Kiểm tra cấu hình không in giá trị bằng:

```bash
docker compose config --quiet
```

## 5. Build, tạo database và Admin

```bash
docker compose build app tools
docker compose up -d db
docker compose ps
docker compose run --rm tools npm run db:migrate
docker compose run --rm tools npx tsx scripts/create-admin.ts
```

- Service db tạo database `cozy_pajamas` lần đầu vào volume mới.
- Service tools dùng cùng phiên bản source và mạng db để chạy migrations; tự đợi DB healthy.
- Admin bootstrap chỉ tạo tài khoản thiếu, không đổi mật khẩu tài khoản có sẵn.
- Không cần `npm run db:setup` trong Docker, PostgreSQL image đã tạo database.

Nếu muốn dữ liệu minh họa cho staging:

```bash
docker compose run --rm tools npm run db:seed
```

Với cửa hàng thật, bỏ qua seed và tự tạo danh mục/sản phẩm trong Admin. Không reset/xóa volume để chạy lại seed.

## 6. Khởi động ứng dụng

```bash
docker compose up -d app worker
docker compose ps
curl -I http://127.0.0.1:3000
docker compose logs --tail=80 app worker
```

Worker gọi `http://app:3000/api/cron/expire` mỗi phút bằng CRON_SECRET. Một thông báo chưa kết nối được ngay lúc app khởi động có thể tự hết sau khi app ready; nếu lặp tiếp, kiểm tra app/secret.

Không đăng nhập qua IP HTTP để kiểm tra khi APP_URL đang là HTTPS domain: cookie và kiểm tra Origin được thiết kế cho domain chính. Chỉ dùng curl loopback để kiểm tra server lên; kiểm tra mua hàng sau khi bật HTTPS.

## 7. Cấu hình HTTPS bằng Caddy

Mở `deploy/Caddyfile`, thay `shop.example.com` bằng domain đã trỏ về VPS. Giữ reverse_proxy loopback và giới hạn body 4 MB.

```bash
nano deploy/Caddyfile
sudo cp deploy/Caddyfile /etc/caddy/Caddyfile
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl enable --now caddy
sudo systemctl reload caddy
sudo systemctl status caddy --no-pager
```

Nếu host đã có website Caddy khác, ghép block mới vào config hiện tại thay vì copy đè toàn bộ. Nếu nginx/Apache đang dùng 80/443, dùng reverse proxy hiện có hoặc chuyển đổi có kế hoạch; không khởi động hai proxy trên cùng cổng.

Caddy tự xin/gia hạn HTTPS khi domain và cổng công khai đúng. Mở `https://domain-cua-ban` và kiểm tra chứng chỉ. Khi đổi domain, sửa APP_URL trong `.env` rồi chạy:

```bash
docker compose up -d --force-recreate app worker
```

## 8. Kiểm tra chức năng

1. `/tai-khoan`: đăng nhập bằng ADMIN_EMAIL/ADMIN_PASSWORD trong file riêng.
2. `/admin`: tab Danh mục → Thêm danh mục; tab Thêm sản phẩm → chọn danh mục vừa tạo.
3. Tải 2 ảnh dưới 3 MB/ảnh; đặt ảnh bìa, chọn sizes, giá và tồn kho; lưu.
4. Mở sản phẩm ở cửa hàng, đổi thumbnail; ảnh phải tải được.
5. `docker compose restart app` rồi kiểm tra ảnh vẫn tồn tại. Volume uploads giữ ảnh qua restart/redeploy.
6. Đặt COD thử, hủy đơn, kiểm tra tồn kho hoàn lại.
7. Đặt đơn QR trong live=false: không được có QR chuyển tiền thật.
8. Kiểm tra worker hoạt động. URL cron không có Bearer trả 401 là đúng.
9. Cấu hình SePay theo [hướng dẫn](PAYMENTS.md); chỉ bật live khi bạn sẵn sàng.

## 9. Backup và thử phục hồi

Tạo backup PostgreSQL và toàn bộ uploads:

```bash
cd /srv/cozy
chmod +x deploy/backup.sh
./deploy/backup.sh
```

Kết quả ở `backups/THOI-GIAN-UTC/database.dump` và `uploads.tgz`. Các tệp này chứa dữ liệu khách hàng; giữ quyền riêng tư. Sao lưu `.env` vào nơi mã hóa riêng, không commit cùng source. Copy backup sang máy/storage khác vì backup trên cùng ổ không bảo vệ khi VPS hỏng.

Có thể cấu hình cron host chạy script hằng đêm bằng tài khoản có quyền Docker. Dùng đường dẫn tuyệt đối và kiểm tra log/kích thước file. Script không tự xóa backup cũ; thiết lập retention riêng sau khi xác minh các bản sao có thể phục hồi.

Thử phục hồi vào **database mới**, không ghi đè database đang bán hàng:

```bash
docker compose exec db createdb -U cozy cozy_restore_check
docker compose exec -T db pg_restore -U cozy -d cozy_restore_check < backups/THOI-GIAN/database.dump
docker compose exec db psql -U cozy -d cozy_restore_check -c 'SELECT count(*) FROM products;'
tar -tzf backups/THOI-GIAN/uploads.tgz | head
```

Thay THOI-GIAN bằng thư mục backup thật. Nếu database kiểm thử đã tồn tại, tạo tên khác; không drop database chưa xác minh. Khi có sự cố production, dừng traffic/worker trước khi phục hồi DB và ảnh từ cùng bản backup.

## 10. Cập nhật phiên bản

```bash
cd /srv/cozy
./deploy/backup.sh
git rev-parse HEAD
git pull --ff-only
docker compose build app tools
docker compose run --rm tools npm run db:migrate
docker compose up -d app worker
docker compose logs --tail=80 app worker
```

Ghi lại commit cũ trước khi cập nhật. Migration cần tương thích khi app cũ còn chạy; thay đổi phá vỡ schema phải có maintenance window và kế hoạch phục hồi. Không rollback source tùy ý nếu schema mới không tương thích.

`docker compose down` dừng hệ thống; **không dùng `down -v`** khi cần giữ database/uploads. Đổi POSTGRES_PASSWORD trong .env không tự đổi mật khẩu role của database đã được khởi tạo; phải thực hiện thay mật khẩu có kiểm soát trong PostgreSQL và cập nhật config cùng lúc.

## 11. Nếu muốn chạy Node trực tiếp thay vì Docker

Repository có `deploy/cozy.service` cho systemd. Cách này đòi hỏi bạn tự cài Node 22, PostgreSQL, tạo user Linux `cozy`, database role riêng và đưa source vào `/srv/cozy`. Sau khi đặt `.env` (DATABASE_URL dùng localhost), chạy `npm ci --cache /srv/cozy/.cache/npm`, migrations, tạo Admin, build. Service chạy `scripts/run.mjs start`, gồm web và worker. Đảm bảo `/usr/bin/node` đúng vị trí binary và user cozy được đọc source, ghi uploads và .next/standalone.

```bash
sudo cp deploy/cozy.service /etc/systemd/system/cozy.service
sudo systemctl daemon-reload
sudo systemctl enable --now cozy
sudo journalctl -u cozy -n 80 --no-pager
```

Chỉ chọn **một** cách chạy trên port 3000: Docker hoặc systemd. Caddy vẫn trỏ về 127.0.0.1:3000. Docker là quy trình đầy đủ được ưu tiên trong tài liệu này.

## Lỗi thường gặp

| Lỗi                               | Hướng kiểm tra                                                                              |
| --------------------------------- | ------------------------------------------------------------------------------------------- |
| Caddy không lấy được HTTPS        | A/AAAA đúng, 80/443 mở, proxy khác không chiếm cổng                                         |
| 502                               | app đã ready chưa, curl loopback, container logs                                            |
| Password authentication failed    | POSTGRES_PASSWORD đúng role đã khởi tạo; không chỉ sửa .env rồi kỳ vọng DB tự đổi           |
| Permission denied upload          | Volume /app/uploads và quyền user cozy trong container                                      |
| Migration missing column          | Chạy tools migrate với image mới, đúng DB                                                   |
| Admin báo nguồn không hợp lệ      | APP_URL khớp domain HTTPS đang mở, recreate app sau sửa                                     |
| Worker 401 liên tục               | CRON_SECRET giống nhau giữa app/worker, recreate cả hai                                     |
| Ảnh local biến mất sau chuyển VPS | Copy/migrate uploads có chủ đích hoặc upload lại ảnh qua Admin; Git không mang theo uploads |
| Build thiếu RAM                   | Build trên máy CI có đủ RAM hoặc nâng tài nguyên; không xóa database để giải phóng RAM      |
