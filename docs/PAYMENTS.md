# SePay / VietinBank cá nhân

## Trạng thái

`.env` có các trường token và ngân hàng; công cụ kiểm tra hiện báo `BANK_ACCOUNT_NUMBER` chưa đúng định dạng chữ số và `SEPAY_WEBHOOK_SECRET` chưa được cấu hình. Cần chủ cửa hàng điền/đối chiếu giá trị thật theo bảng bên dưới. `PAYMENT_LIVE_ENABLED=false`; không gọi giao dịch tiền thật. API token dùng cho API quản lý/đối soát, **không** dùng thay secret webhook. Luồng webhook hiện không cần gửi API token ra ngoài.

Endpoint local chính xác: `http://localhost:3000/api/webhooks/sepay`. SePay không truy cập được localhost. Trên domain HTTPS sẽ là `https://TEN-MIEN-CUA-BAN/api/webhooks/sepay`.

## Điền từng thông tin ở đâu?

Mở `.env` khi chạy local/VPS, hoặc **Vercel → Project → Settings → Environment Variables → Production** khi dùng Vercel. Với file riêng chuẩn bị deploy, chỉnh `.env.deploy` rồi chép từng giá trị vào hosting. Không đưa file này lên Git. Không cần gửi mật khẩu/secret cho người hỗ trợ qua chat.

| Tên biến                | Giá trị cần điền                                                  | Nơi lấy / ý nghĩa                                                                                                  |
| ----------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `APP_URL`               | URL website chính thức bắt đầu `https://`                         | Vercel Domains hoặc domain VPS đã có SSL; không có `/admin` hoặc `/api` phía sau                                   |
| `PAYMENT_PROVIDER`      | `sepay`                                                           | Cố định cho module hiện tại                                                                                        |
| `PAYMENT_CURRENCY`      | `VND`                                                             | Tiền Việt Nam, số tiền dùng đơn vị đồng                                                                            |
| `BANK_CODE`             | `ICB`                                                             | VietinBank                                                                                                         |
| `BANK_BIN`              | `970415`                                                          | Mã ngân hàng VietinBank trong cấu hình này                                                                         |
| `BANK_ACCOUNT_NUMBER`   | Số tài khoản nhận tiền thực tế, chỉ chữ số                        | SePay → Ngân hàng → tài khoản VietinBank đã liên kết; đối chiếu lại trên app ngân hàng. Không dùng số thẻ          |
| `BANK_ACCOUNT_NAME`     | Tên chủ tài khoản đúng với ngân hàng                              | Thông tin thụ hưởng; kiểm tra lại tên hiện ra khi quét QR                                                          |
| `SEPAY_API_TOKEN`       | Token API đã có                                                   | Trang quản lý API token của tài khoản SePay; giữ token hợp lệ, không dùng nó thay Webhook Secret                   |
| `SEPAY_TRANSFER_PREFIX` | `SEVQR`                                                           | Cố định với luồng VietinBank cá nhân này                                                                           |
| `SEPAY_WEBHOOK_AUTH`    | `HMAC_SHA256`                                                     | Phải khớp lựa chọn xác thực HMAC-SHA256 tại SePay                                                                  |
| `SEPAY_WEBHOOK_SECRET`  | Chuỗi bí mật ít nhất 32 ký tự, giống hệt ở SePay                  | Tạo trong phần Bảo mật khi thêm webhook, hoặc dùng chuỗi đã sinh trong `.env.deploy` rồi nhập cùng chuỗi vào SePay |
| `SEPAY_WEBHOOK_PATH`    | `/api/webhooks/sepay`                                             | Endpoint hiện tại cố định trong source; đổi biến này không tạo đường dẫn API mới                                   |
| `PAYMENT_LIVE_ENABLED`  | `false` lúc thiết lập, `true` khi bạn chủ động mở thanh toán thật | Không bật trước khi đã kiểm tra cấu hình                                                                           |
| `CRON_SECRET`           | Secret riêng của tác vụ hết hạn đơn                               | Script env-init sinh sẵn; không dùng chung webhook secret                                                          |

Ví dụ **khung cấu hình**, không có tài khoản/token thật:

```dotenv
APP_URL=https://shop.tenmiencuaban.vn
PAYMENT_PROVIDER=sepay
PAYMENT_CURRENCY=VND
BANK_CODE=ICB
BANK_BIN=970415
BANK_ACCOUNT_NUMBER=DIEN_SO_TAI_KHOAN_THAT
BANK_ACCOUNT_NAME="DIEN TEN CHU TAI KHOAN"
SEPAY_API_TOKEN=DIEN_TOKEN_DA_CO
SEPAY_TRANSFER_PREFIX=SEVQR
SEPAY_WEBHOOK_AUTH=HMAC_SHA256
SEPAY_WEBHOOK_SECRET=DIEN_SECRET_DA_TAO
SEPAY_WEBHOOK_PATH=/api/webhooks/sepay
PAYMENT_LIVE_ENABLED=false
```

Trong file `.env`, tên chủ tài khoản có dấu cách nên bọc bằng dấu nháy kép. Trong ô Environment Variable của Vercel, nhập giá trị trực tiếp **không kèm dấu nháy**. Không thêm dấu cách thừa vào số tài khoản hoặc secret. Các chữ `DIEN_...` chỉ là chỗ hướng dẫn, không phải dữ liệu hợp lệ.

Nếu cần tạo file production có secret ngẫu nhiên an toàn, chạy `node scripts/env-init.mjs .env.deploy`. Script sinh secret vào file riêng, không in ra terminal và không ghi đè cấu hình có sẵn. Để lấy secret, mở file bằng editor rồi dán trực tiếp vào trang SePay qua HTTPS.

Kiểm tra cấu hình mà không làm lộ giá trị:

```powershell
node scripts/payment-check.mjs .env
# Hoặc kiểm tra cấu hình chuẩn bị deploy:
node scripts/payment-check.mjs .env.deploy
```

Kết quả chỉ báo biến nào OK/cần điền, URL webhook và trạng thái live. Nó không gọi ngân hàng/SePay, không xác nhận token còn hiệu lực và không chứng minh tài khoản ngân hàng đã liên kết. Local hiện thiếu webhook secret nên báo NEEDS CONFIGURATION là đúng.

## Điền form Webhook trên SePay

Sau khi website đã deploy HTTPS:

1. Đăng nhập **my.sepay.vn** bằng trình duyệt của bạn → **Ngân hàng**. Xác nhận VietinBank cá nhân đã kết nối đúng tài khoản và đang hoạt động. Thao tác ngân hàng/OTP chỉ làm trên giao diện chính thức.
2. Vào **Webhooks → Thêm webhook**.
3. Tên webhook: `Cozy pajamas - production` (tên dễ nhận biết).
4. Sự kiện: **Có tiền vào** / In only.
5. URL: ghép APP_URL với `/api/webhooks/sepay`. Ví dụ website `https://cozy-shop.vercel.app` thì điền `https://cozy-shop.vercel.app/api/webhooks/sepay`. Đây chỉ là ví dụ, không phải domain đã tạo cho bạn.
6. Định dạng gửi: **JSON / application/json**.
7. Tài khoản áp dụng: chọn đúng VietinBank tương ứng BANK_ACCOUNT_NUMBER. Nếu có bộ lọc tiền tố, dùng `SEVQR`. Không đặt bộ lọc mẫu khác làm bỏ qua mã `SEVQR` + 12 ký tự hex của ứng dụng.
8. Bảo mật: **HMAC-SHA256**. Nhập/tạo Secret Key rồi lưu **cùng giá trị** vào SEPAY_WEBHOOK_SECRET trên backend.
9. Bật gửi lại khi HTTP response không thuộc 200–299; cấu hình cảnh báo lỗi nếu tài khoản có hỗ trợ.
10. Lưu webhook. Không tạo nhiều webhook trỏ cùng một endpoint nếu không cần; hệ thống chống trùng nhưng khó theo dõi khi cấu hình thừa.

Form SePay có thể đổi tên mục theo phiên bản, nhưng các giá trị sự kiện/tài khoản/JSON/HMAC/URL phải đúng. Cách cấu hình theo [hướng dẫn chính thức](https://docs.sepay.vn/tich-hop-webhooks.html).

## Phân biệt thử nghiệm local, gửi thử webhook và thanh toán thật

| Cách thử                                         | Cần live=true?                     | Có tiền thật?                          | Chứng minh điều gì?                                          |
| ------------------------------------------------ | ---------------------------------- | -------------------------------------- | ------------------------------------------------------------ |
| `npm test` / simulator local                     | Không                              | Không                                  | Logic xử lý, chữ ký, chống trùng, lỗi số tiền, trạng thái    |
| SePay → Gửi thử đến production endpoint hiện tại | Có, vì live=false chủ động trả 503 | Không nhất thiết; dùng payload gửi thử | Kết nối HTTPS, cấu hình chữ ký và nhận payload               |
| Đặt đơn mới rồi chuyển khoản thực                | Có, do chủ cửa hàng quyết định     | Có                                     | Luồng ngân hàng thực, mã giao dịch, đối chiếu và cập nhật UI |

Chỉ bật live=true sau khi đã điền secret, ngân hàng và HTTPS. Khi live bật, khách có thể thấy QR tài khoản thật: thực hiện giai đoạn kiểm chứng trước khi quảng bá/mở cửa hàng rộng rãi. Hệ thống từ chối tạo đơn chuyển khoản thật nếu thiếu cấu hình thiết yếu.

Payload gửi thử có mã không thuộc đơn hàng sẽ được lưu UNMATCHED và trả thành công nhận webhook; việc này **không** có nghĩa một đơn đã thanh toán. Đơn tạo khi live=false luôn là đơn test; không dùng nó để chuyển tiền thật. Khi chuyển sang live, hãy tạo **đơn mới**.

Sau khi đổi env trên Vercel: **Redeploy**. Trên VPS Docker: `docker compose up -d --force-recreate app worker`. Local: dừng rồi chạy lại `npm run dev`. Chỉ sửa file/env dashboard mà không cập nhật process sẽ chưa có hiệu lực.

Nếu endpoint nằm sau Deployment Protection, Basic Auth hoặc WAF yêu cầu đăng nhập trình duyệt, SePay không gọi được. Đảm bảo domain production cho phép gọi POST webhook công khai và giữ HMAC làm lớp xác thực. Không đưa khóa bí mật vào query string để vượt protection.

## Đọc kết quả và xử lý lỗi

| Trạng thái            | Diễn giải / việc cần làm                                                                      |
| --------------------- | --------------------------------------------------------------------------------------------- |
| HTTP 503              | Thanh toán thật đang tắt; đúng khi chưa mở live                                               |
| HTTP 401              | HMAC/secret/timestamp không hợp lệ; kiểm tra chọn đúng kiểu HMAC, cùng secret, đồng hồ server |
| HTTP 400 khi bật live | Kiểm tra thông báo tên biến cấu hình, loại JSON và schema payload                             |
| HTTP 200, MATCHED     | Đúng tài khoản, số tiền, mã đơn và còn hạn; đơn chuyển PAID/CONFIRMED                         |
| HTTP 200, UNMATCHED   | Không tìm được đơn tương ứng; kiểm tra nội dung chuyển và lọc tiền tố                         |
| UNDERPAID / OVERPAID  | Thiếu/thừa tiền, cần đối soát, không tự coi là trả đủ                                         |
| LATE_PAYMENT          | Đơn hết hạn hoặc không còn chờ; kiểm tra giao dịch và xử lý với khách                         |
| EXTRA_PAYMENT         | Đơn đã được ghi nhận trước đó; kiểm tra chuyển nhiều lần                                      |
| WRONG_ACCOUNT         | Tài khoản hoặc gateway khác VietinBank cấu hình                                               |
| MODE_MISMATCH         | Giao dịch thật đang nhắm vào đơn test hoặc ngược lại                                          |

Vào **Admin → Đối soát thanh toán** để xem kết quả; xem thêm Nhật ký webhook ở SePay. Không bấm/chèn SQL để ép PAID khi chưa chứng minh đã nhận tiền. Các giao dịch cần hoàn tiền được xử lý qua ngân hàng/SePay bởi người vận hành; ứng dụng chưa tự chuyển tiền hoàn.

## Quy tắc đã đối chiếu tài liệu

- VietinBank cá nhân yêu cầu nội dung bắt đầu bằng `SEVQR`; hệ thống sinh `SEVQR` + 12 ký tự hex ngẫu nhiên, QR của SePay có số tiền/tài khoản/mã này. [Kết nối VietinBank](https://docs.sepay.vn/ket-noi-vietinbank.html).
- HMAC-SHA256: ký chuỗi `timestamp.raw_body`, header `X-SePay-Signature: sha256=<hex>` và `X-SePay-Timestamp`. Chấp nhận chênh lệch tối đa 300 giây, so sánh constant-time. [Xác thực chính thức](https://developer.sepay.vn/vi/sepay-webhooks/xac-thuc).
- Webhook xác thực và xử lý thành công trả `200 {"success":true}`. Unique transaction ID chống xử lý lặp, kể cả request đồng thời. [Tích hợp webhook](https://docs.sepay.vn/tich-hop-webhooks.html).

## Thử nghiệm không chuyển tiền

1. Giữ `PAYMENT_LIVE_ENABLED=false`.
2. Đặt đơn chuyển khoản. Giao diện ghi rõ thử nghiệm, không tạo QR chuyển tiền thật.
3. Sao chép ID đơn từ URL `/don-hang/ID`.
4. Chạy `npm run payment:simulate -- ID` trên máy local.
5. Trang đơn tự cập nhật sau tối đa 5 giây. Admin thấy PAID/CONFIRMED nhưng doanh thu thật không cộng đơn test.

Simulator không có HTTP endpoint, từ chối đơn thật và từ chối chạy khi live bật. Integration tests có payload giả riêng, tách database, kiểm tra chữ ký, replay, sai tiền, sai tài khoản, thiếu/thừa tiền, khác môi trường, quá hạn và giao dịch trùng.

## Cấu hình thực tế khi chủ cửa hàng sẵn sàng

1. Có domain/tunnel HTTPS trỏ đến backend; cập nhật `APP_URL` đúng origin. Không gửi secret, OTP hoặc đăng nhập ngân hàng qua chat.
2. Trong SePay → Webhooks → Thêm webhook: chọn tiền vào, đúng tài khoản VietinBank, JSON, HMAC-SHA256. Nhập URL HTTPS ở trên.
3. Tạo secret tại giao diện SePay, lưu trực tiếp vào `SEPAY_WEBHOOK_SECRET` trong `.env` hoặc secret manager. Không dùng API token làm secret.
4. Bật tùy chọn retry khi HTTP ngoài 200–299. Nếu tạo qua OAuth API, tài liệu hiện yêu cầu HMAC dùng `bank_account_ids` hoặc `bank_mode=all`, không dùng `bank_account_id` đơn lẻ: [API webhooks](https://docs.sepay.vn/oauth2/api-webhooks.html).
5. Chỉ khi chủ cửa hàng cho phép mới bật `PAYMENT_LIVE_ENABLED=true` và khởi động lại server. Dùng chức năng gửi thử của SePay để kiểm tra kết nối; thực hiện kiểm chứng tiền thật nhỏ chỉ khi có chấp thuận riêng.
6. Kiểm tra mapping mã đơn, ngân hàng, số tài khoản, số tiền, giao dịch lặp, thông báo thành công và đối soát Admin. Không coi gửi thử thành công là bằng chứng đầy đủ cho chuyển tiền thật.

Nếu cần tunnel local, máy đã có localtunnel. Cần cấu hình tunnel HTTPS và origin nhất quán; chưa tự mở tunnel vì chưa cần công khai cửa hàng và Admin trên Internet. Domain/tunnel URL là thông tin còn thiếu để cung cấp URL public chính xác.

## Ngoại lệ

UNDERPAID/OVERPAID không tự xác nhận, không tự cộng nhiều khoản thiếu. LATE_PAYMENT, EXTRA_PAYMENT, WRONG_ACCOUNT, OUTGOING, UNMATCHED và MODE_MISMATCH đều được lưu. Mỗi webhook xử lý trong transaction; lỗi DB cần retry. Hết hạn giữ chỗ sau 30 phút, worker chạy mỗi phút. Thanh toán đến sau hạn được giữ để đối soát, không khôi phục tồn kho đã bán cho người khác.

Hoàn tiền và đối soát bù khi webhook mất hoàn toàn hiện xử lý thủ công trên SePay/ngân hàng, chưa có tự động gọi API. Không có chức năng frontend xác nhận đã thanh toán. Hủy đơn đã thu tiền đánh dấu REFUND_PENDING để tránh coi là đã hoàn tiền.
