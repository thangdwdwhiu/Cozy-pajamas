# Deploy Cozy pajamas lên Vercel + Supabase — từng bước

Tài liệu dành cho mã nguồn hiện tại, cập nhật 07/11/2026. Quy trình này chưa được chạy trên tài khoản hosting thật của bạn. Local đã kiểm tra migrations, Admin, upload nhiều ảnh, gallery và checkout. Không bật tiền thật trong quá trình thiết lập.

## 1. Hiểu những thành phần sẽ dùng

| Thành phần         | Dịch vụ                      | Vai trò                                |
| ------------------ | ---------------------------- | -------------------------------------- |
| Website và backend | Vercel, Next.js Node runtime | Trang khách hàng, Admin, API, webhook  |
| Database           | Supabase PostgreSQL          | Sản phẩm, tài khoản, đơn hàng, tồn kho |
| Kho ảnh            | Supabase Storage             | Lưu nhiều ảnh sản phẩm bền vững        |
| Tác vụ hết hạn đơn | Vercel Cron                  | Giải phóng hàng được giữ quá 30 phút   |
| Thanh toán         | SePay + VietinBank           | Nhận và đối chiếu giao dịch            |

Đăng nhập của cửa hàng do ứng dụng quản lý; không cần tạo người dùng trong Supabase Auth. Không dùng khóa `anon` cho database của ứng dụng.

`vercel.json` hiện dùng cron hằng ngày (`0 0 * * *`), phù hợp giới hạn lịch Hobby. Lịch này không bảo đảm hoàn kho ngay sau 30 phút. Để kiểm thử đầy đủ cơ chế hết hạn trên Hobby, cấu hình scheduler bên ngoài gọi `GET https://DOMAIN/api/cron/expire` mỗi phút, kèm header `Authorization: Bearer GIA_TRI_CRON_SECRET`; giữ secret ở cấu hình riêng của scheduler. Kiểm tra response 200 và lịch sử chạy. Nếu dùng gói hỗ trợ cron mỗi phút, đổi schedule thành `* * * * *`. Hobby dành cho mục đích cá nhân phi thương mại; xem [gói Vercel](https://vercel.com/pricing) và [giới hạn Cron](https://vercel.com/docs/cron-jobs/manage-cron-jobs).

## 2. Chuẩn bị mã nguồn lên GitHub

Mở PowerShell trong `D:\MY WEBSITE\Cozy pajamas`. Tạo repository **private** trống trên GitHub. Nếu chưa dùng Git trong thư mục này:

```powershell
git init
git branch -M main
git add .
git status --short
git check-ignore .env
```

Kiểm tra danh sách trước khi commit: không có `.env`, `.env.deploy`, `.next`, `node_modules`, `uploads`, database dump. `.gitignore` đã loại những tệp này. Không ép thêm tệp bí mật bằng `git add -f`.

```powershell
git commit -m "Build Cozy pajamas storefront and admin"
git remote add origin https://github.com/TAI-KHOAN/REPOSITORY.git
git push -u origin main
```

Thay URL bằng repository của bạn. Nếu đã có Git/remote, dùng cấu hình hiện có, không chạy lại `remote add`.

## 3. Tạo dự án Supabase và lấy kết nối database

1. Đăng nhập Supabase → **New project**.
2. Đặt tên, chọn vùng gần người mua/Vercel (ví dụ Singapore nếu tài khoản có vùng này), đặt mật khẩu database riêng và lưu trong trình quản lý mật khẩu.
3. Đợi project sẵn sàng → **Connect**.
4. Chọn **Direct connection**, sao chép URI cổng `5432` vào `DATABASE_URL`. Dạng URI: `postgresql://postgres:MAT_KHAU_DA_ENCODE@db.PROJECT_REF.supabase.co:5432/postgres`.
5. Đặt `AUTO_MIGRATE=true`. Để trống `DIRECT_DATABASE_URL` khi runtime đã dùng Direct; nếu điền thì phải trỏ cùng database/project với `DATABASE_URL`. Server tự tạo bảng khi khởi động, không cần SQL Editor hoặc lệnh migration.
6. Direct mặc định cần mạng IPv6. Môi trường chạy không có IPv6 phải có Supabase IPv4 add-on để tiếp tục dùng Direct. Kiểm tra mạng thực tế của Vercel/VPS; sửa code không thể thay thế đường mạng. Session pooler cổng 5432 là lựa chọn thay thế nếu bạn quyết định không dùng Direct; không dùng transaction pooler 6543 cho tự tạo bảng.

Không tự suy đoán hostname hoặc username: sao chép từ Connect. Mật khẩu chứa ký tự đặc biệt phải URL-encode trong URI. Database của Supabase thường tên `postgres`; không chạy `npm run db:setup` để tạo `cozy_pajamas` trên Supabase. App dùng database đã có.

Runtime đang dùng node-postgres và Drizzle, pool trên Vercel giới hạn 1 kết nối mỗi instance; không tạo named prepared statements. Phân biệt runtime pooler và kết nối migration theo [hướng dẫn kết nối PostgreSQL chính thức](https://supabase.com/docs/guides/database/connecting-to-postgres).

Trong Supabase, **tắt Data API** nếu project này chỉ dùng cho Cozy. Website truy cập PostgreSQL trực tiếp từ backend, không dùng REST/GraphQL tự sinh cho các bảng. Điều này tránh vô tình công khai users/orders bằng API tự sinh. Storage là kho đối tượng riêng. Nếu cần bật Data API cho ứng dụng khác, phải cấu hình RLS/quyền cho các bảng Cozy trước khi mở; không thêm policy public cho users, sessions hoặc orders. [Hướng dẫn bảo vệ Data API](https://supabase.com/docs/guides/api/securing-your-api).

## 4. Tạo kho ảnh Supabase Storage

1. Vào **Storage → New bucket**.
2. Tên bucket: `product-images`.
3. Chọn **Public bucket**: chỉ ảnh hàng hóa được công khai, không chứa giấy tờ hay ảnh riêng tư.
4. Có thể giới hạn MIME `image/webp`, dung lượng đối tượng 5 MB. Backend nhận JPG/PNG/WebP rồi chuyển WebP trước khi ghi vào bucket.
5. Không tạo policy cho phép khách vãng lai upload/delete. Backend đã kiểm tra Admin và dùng khóa server để ghi ảnh.
6. Tìm **Project URL** tại phần Connect/API settings; lưu vào `SUPABASE_URL`.
7. Vào **Project Settings → API Keys**, lấy khóa legacy `service_role` để điền `SUPABASE_SERVICE_ROLE_KEY`. Đây là khóa server, không phải anon/publishable key; không thêm tiền tố `NEXT_PUBLIC_` và không đưa vào frontend. Nếu giao diện có nhiều nhóm key, chọn mục legacy service_role phù hợp với adapter hiện tại.

Backend tải từng ảnh trong một request; mỗi ảnh tối đa 3 MB, một sản phẩm tối đa 10 ảnh. Giới hạn này nằm dưới mức body 4.5 MB của Vercel Function kể cả phần multipart. [Giới hạn Function](https://vercel.com/docs/functions/limitations), [Supabase upload](https://supabase.com/docs/guides/storage/uploads/standard-uploads).

## 5. Tạo file cấu hình production riêng trên máy

Không sửa `.env` local đang dùng. Chạy:

```powershell
node scripts/env-init.mjs .env.deploy
```

Script tạo file mới từ `.env.example`, sinh mật khẩu Admin, cron secret và webhook secret, không in các giá trị. Nó từ chối ghi đè file đã tồn tại. Mở `.env.deploy` bằng editor và điền:

| Biến                        | Điền gì                                                                       |
| --------------------------- | ----------------------------------------------------------------------------- |
| `APP_URL`                   | `https://TEN-PROJECT.vercel.app` hoặc domain chính thức, không thêm đường dẫn |
| `DATABASE_URL`              | Direct connection Supabase cổng 5432                                          |
| `DIRECT_DATABASE_URL`       | Để trống hoặc cùng Direct URI, cùng project/database                          |
| `AUTO_MIGRATE`              | `true`: tự tạo/cập nhật bảng khi server khởi động                             |
| `MEDIA_STORAGE`             | `supabase`                                                                    |
| `SUPABASE_URL`              | `https://PROJECT-REF.supabase.co`                                             |
| `SUPABASE_STORAGE_BUCKET`   | `product-images`                                                              |
| `SUPABASE_SERVICE_ROLE_KEY` | Khóa server lấy ở bước 4                                                      |
| `ADMIN_EMAIL`               | Email bạn muốn dùng đăng nhập Admin                                           |
| `ADMIN_PASSWORD`            | Giữ giá trị mạnh đã sinh hoặc đặt mật khẩu mạnh khác                          |
| `CRON_SECRET`               | Giữ giá trị ngẫu nhiên đã sinh                                                |
| `PAYMENT_LIVE_ENABLED`      | `false`                                                                       |
| Các biến ngân hàng/SePay    | Xem [hướng dẫn điền SePay](PAYMENTS.md)                                       |

`AUTH_SECRET` được giữ để tương thích cấu hình; phiên đăng nhập hiện dùng token ngẫu nhiên lưu hash trong DB, không dùng JWT ký bằng giá trị này.

## 6. Tự động tạo bảng và Admin

Không cần chạy lệnh tạo bảng thủ công. Sau khi điền biến môi trường và deploy ở bước 7, lần khởi động Next server đầu tiên tự:

1. Kết nối Direct, lấy khóa migration trong PostgreSQL để các instance không tạo bảng đồng thời.
2. Áp dụng SQL trong thư mục `drizzle/`, tạo 16 bảng ứng dụng và lịch sử `drizzle.__drizzle_migrations`.
3. Tạo tài khoản Admin nếu có `ADMIN_EMAIL` và `ADMIN_PASSWORD` (ít nhất 12 ký tự); giữ nguyên tài khoản/mật khẩu đã tồn tại.
4. Ghi log `[database] Ready: ...` rồi mới nhận request.

Restart/redeploy chỉ chạy migration mới, không xóa bảng, không seed sản phẩm và không reset tồn kho. Giữ migrations trong repository; không sửa SQL đã chạy. `npm run build` không chạy migration; Vercel thực hiện khi Function khởi động, có thể ở request đầu tiên. Nếu kết nối/quyền migration lỗi, server dừng khởi tạo và báo lỗi trong logs; sửa env/mạng rồi restart/redeploy.

Ứng dụng tạo bảng trong database `postgres` đã có của Supabase, không tự tạo Supabase project, database server hoặc Storage bucket. Bucket ảnh vẫn thiết lập theo bước 4. Với database đã tạo bảng bằng cách khác nhưng không có lịch sử Drizzle, cần kiểm tra baseline; app không xóa bảng để ép khởi tạo.

Muốn dữ liệu minh họa trên staging: sau khi server khởi tạo xong, có thể chạy `node scripts/production-db.mjs .env.deploy seed`. Không chạy test database/browser trên production. `AUTO_MIGRATE=false` dành cho đội vận hành muốn chạy migration riêng bằng `node scripts/production-db.mjs .env.deploy migrate`.

**Ảnh local cũ:** file trong `uploads/` không đi theo Git. Nếu bạn đưa dữ liệu local lên Supabase, những đường `/api/media/...` cũ không tồn tại trên Vercel. Mở từng sản phẩm trong Admin của bản hosted, tải lại ảnh từ máy, chọn ảnh bìa và lưu. SVG seed nằm trong `public/images` vẫn có trong deploy. Không xóa ảnh cũ khi chưa chắc các đơn hàng lịch sử còn dùng chúng hay không.

## 7. Import vào Vercel

1. Vercel → **Add New → Project** → chọn repository.
2. Framework Preset: **Next.js**; Root Directory: thư mục chứa `package.json` (repo hiện tại là root).
3. Node.js: **22.x**. Build command `npm run build`, install command `npm ci --include=dev --include=optional --cache /tmp/npm-cache`. Để Output Directory mặc định, không nhập `.next/standalone`. Nếu Dashboard có Install Command override, tắt override để dùng vercel.json hoặc sửa đúng lệnh này.
4. `vercel.json` đã có install command Linux để không dùng đường cache ổ D trong `.npmrc`.
5. Thêm Environment Variables cho **Production** theo bảng trên. Cần ADMIN_EMAIL/ADMIN_PASSWORD ở lần khởi động đầu để tự tạo Admin; có thể bỏ ADMIN_PASSWORD rồi redeploy sau khi tạo xong. Không thêm `NODE_ENV=development`, `UPLOAD_DIR` Windows hoặc mật khẩu PostgreSQL local.
6. `DATABASE_URL` dùng Direct và `AUTO_MIGRATE=true` phải có trên runtime. Nếu dùng `DIRECT_DATABASE_URL`, cũng thêm biến này trên runtime và trỏ đúng database. Preview phải dùng database riêng.
7. Chọn vùng Functions gần Supabase nếu gói cho phép; Deploy.

Vercel tự khởi chạy Next Functions; không chạy `npm start` hoặc worker Node liên tục ở đây. Endpoint cron đã hỗ trợ GET có `Authorization: Bearer CRON_SECRET`. Vercel tự gửi header khi đặt biến `CRON_SECRET`; lịch chỉ chạy trên production deployment. [Vercel Cron](https://vercel.com/docs/cron-jobs).

Nếu tên URL Vercel thực tế khác dự kiến, cập nhật APP_URL theo URL production thật, rồi Redeploy. Hệ thống kiểm tra Origin nên cần mở đúng URL đó để đăng nhập và lưu dữ liệu. Không dùng ngẫu nhiên deployment URL của một commit để thao tác khi APP_URL đang trỏ domain chính.

## 8. Thêm tên miền riêng

1. Project → Settings → Domains → Add `tenmiencuaban.vn` hoặc `shop.tenmiencuaban.vn`.
2. Vercel hiển thị bản ghi DNS cần thêm. Nhập đúng bản ghi tại nơi mua domain; không sao chép IP từ hướng dẫn cũ.
3. Đợi trạng thái domain/SSL hợp lệ.
4. Đặt `APP_URL=https://domain-chinh-thuc` → Redeploy.
5. Chọn một domain chính; chuyển hướng domain phụ về domain chính để tránh lỗi Origin/cookie.

## 9. Kiểm tra sau deploy

- Trang chủ và `/san-pham` tải dữ liệu, `/sitemap.xml` dùng domain thật.
- Đăng nhập tại `/tai-khoan`, mở `/admin`.
- Tạo danh mục, tạo sản phẩm với 2 ảnh và các kích thước; không có ô nhập slug/đường ảnh.
- Đặt ảnh thứ hai làm ảnh bìa, lưu, refresh; ảnh vẫn đúng.
- URL ảnh bắt đầu bằng domain Supabase và vẫn xem được sau redeploy.
- Mở trang sản phẩm, chọn các thumbnail để kiểm tra gallery.
- Đặt COD thử, hủy đơn; tồn kho trả lại.
- Vercel → Cron Jobs/Logs: `/api/cron/expire` trả 200 khi có xác thực. Truy cập URL này bằng trình duyệt thường trả 401 là đúng.
- Làm theo [PAYMENTS.md](PAYMENTS.md) để cấu hình webhook; vẫn giữ live=false đến khi sẵn sàng kiểm chứng.

## 10. Cập nhật và khắc phục lỗi

### Build báo thiếu TypeScript sau khi đã compiled successfully

TypeScript và các gói `@types/*` đã nằm trong `devDependencies`. Build cần cài nhóm này dù runtime chạy production. Nếu đặt `NODE_ENV=production`, `NPM_CONFIG_PRODUCTION=true` hoặc `NPM_CONFIG_OMIT=dev` trong Environment Variables, npm có thể bỏ chúng. [Giải thích của Vercel](https://vercel.com/kb/guide/dependencies-from-package-json-missing-after-install).

1. Push bản mới có Install Command `npm ci --include=dev --include=optional --cache /tmp/npm-cache` trong vercel.json. `optional` bảo đảm cài binary phù hợp hệ điều hành của TypeScript 7/Next/sharp.
2. Settings → Build and Deployment → Install Command: tắt override cũ hoặc dùng đúng lệnh trên. Build Command giữ `npm run build`.
3. Settings → Environment Variables: bỏ NODE_ENV do bạn tự thêm, NPM_CONFIG_PRODUCTION và NPM_CONFIG_OMIT nếu đang ép bỏ dev. Không đặt NODE_ENV=development để chữa lỗi build; Next tự chọn production khi build.
4. Redeploy commit mới, bỏ chọn sử dụng Build Cache. Kiểm tra log Install Command có `--include=dev` rồi bước TypeScript hoàn tất.

Cảnh báo `Unknown env config "cache-dir"` không phải nguyên nhân dừng build trong log này. Repository không khai báo cache-dir. Nếu tự thêm NPM_CONFIG_CACHE_DIR trong Vercel, bỏ biến đó; lệnh install đã dùng `--cache` hợp lệ. Không xóa tsconfig.json hoặc bật ignoreBuildErrors để né kiểm tra TypeScript.

Thay source → chạy test/build local → push Git. Nếu có migration mới, backup Supabase trước khi deploy; server tự áp dụng khi khởi động. Kiểm tra tương thích với instance cũ đang chạy, dùng maintenance window nếu thay đổi phá vỡ schema. Dùng Preview với database/bucket riêng; không cho preview ghi lên database bán hàng.

| Hiện tượng                     | Kiểm tra                                                                                      |
| ------------------------------ | --------------------------------------------------------------------------------------------- |
| Build fail vì cron             | Gói hỗ trợ cron mỗi phút; không dùng nguyên cấu hình Pro trên Hobby                           |
| Không kết nối PostgreSQL       | URI lấy từ Connect, user pooler có PROJECT-REF, mật khẩu URL-encode, direct IPv6/session IPv4 |
| Too many connections           | Direct có giới hạn kết nối; runtime Vercel pool max=1, kiểm tra concurrency/gói DB            |
| Relation/column does not exist | Kiểm tra log [database] Ready, AUTO_MIGRATE và hai URI có cùng database                       |
| 400 Nguồn yêu cầu không hợp lệ | APP_URL có đúng domain đang mở; redeploy sau sửa env                                          |
| 413 khi upload                 | Giảm mỗi ảnh dưới 3 MB; mỗi request chỉ chứa một file                                         |
| Không lưu được ảnh             | MEDIA_STORAGE=supabase, service_role đúng, bucket tồn tại/public                              |
| 401 cron                       | CRON_SECRET có trên Production, redeploy; không công khai secret trong URL                    |
| 503 webhook                    | Live vẫn tắt, đây là trạng thái chủ động bảo vệ                                               |

Secret chỉ nhập vào Vercel Environment Variables hoặc file riêng. Xem log để biết tên lỗi, không chụp/gửi ảnh có giá trị secret. Chưa có xác nhận deploy thành công vào tài khoản Vercel/Supabase của bạn trong phiên này.
