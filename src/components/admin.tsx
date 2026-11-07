'use client';
import CatalogAdmin from './admin/catalog-admin';
import { useEffect, useState, FormEvent } from 'react';
import Link from 'next/link';
import {
  LayoutDashboard,
  Package,
  ShoppingBag,
  Users,
  Ticket,
  FileText,
  CreditCard,
  MessageSquare,
  RotateCcw,
  Search,
  RefreshCw,
  FolderOpen,
  Plus,
  Boxes,
  ArrowUpRight,
} from 'lucide-react';
import { api, Field, labels, money } from './store';
type Row = Record<string, any>;
const tabs = [
  ['overview', 'Tổng quan', LayoutDashboard],
  ['products', 'Sản phẩm', Package],
  ['new-product', 'Thêm sản phẩm', Plus],
  ['categories', 'Danh mục', FolderOpen],
  ['new-category', 'Thêm danh mục', Plus],
  ['inventory', 'Kho hàng', Boxes],
  ['orders', 'Đơn hàng', ShoppingBag],
  ['users', 'Khách hàng & nhân viên', Users],
  ['vouchers', 'Khuyến mãi', Ticket],
  ['transactions', 'Đối soát thanh toán', CreditCard],
  ['reviews', 'Đánh giá', MessageSquare],
  ['returns', 'Đổi trả', RotateCcw],
  ['content', 'Nội dung', FileText],
] as const;
export default function Admin({
  user,
  onError,
}: {
  user: { role: string } | null;
  onError: (s: string) => void;
}) {
  const [data, setData] = useState<Record<string, Row[]> | null>(null),
    [tab, setTab] = useState('overview'),
    [q, setQ] = useState(''),
    [page, setPage] = useState(0),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    [editing, setEditing] = useState<Row | null>(null);
  async function load() {
    try {
      setData(await api('admin'));
    } catch (e) {
      onError((e as Error).message);
    }
  }
  useEffect(() => {
    if (user && ['ADMIN', 'STAFF'].includes(user.role)) void load();
  }, [user]);
  async function action(path: string, body: unknown) {
    setBusy(true);
    setMessage('');
    try {
      await api('admin/' + path, body);
      await load();
      setMessage('Đã lưu thay đổi');
      setEditing(null);
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function submit(e: FormEvent<HTMLFormElement>, path: string, transform?: (b: Row) => Row) {
    e.preventDefault();
    const b = Object.fromEntries(new FormData(e.currentTarget));
    void action(path, transform ? transform(b) : b);
  }
  if (!user || !['ADMIN', 'STAFF'].includes(user.role))
    return (
      <main className="container empty">
        <h1>Khu vực quản trị</h1>
        <p>Vui lòng đăng nhập bằng tài khoản có quyền quản trị.</p>
        <Link className="button" href="/tai-khoan">
          Đăng nhập
        </Link>
      </main>
    );
  if (!data) return <main className="container section">Đang tải dữ liệu cửa hàng…</main>;
  const rows = (data[tab] ?? []).filter((r) =>
    JSON.stringify(r).toLowerCase().includes(q.toLowerCase()),
  );
  const shown = rows.slice(page * 12, page * 12 + 12);
  const revenue = data.orders
    .filter((o) => o.paymentStatus === 'PAID' && !o.test)
    .reduce((sum, o) => sum + o.total, 0);
  return (
    <main className="admin">
      <aside className="admin-sidebar">
        <Link className="studio-brand" href="/admin">
          cozy<span>STUDIO / QUẢN TRỊ</span>
        </Link>
        <div className="sidebar-label">KHÔNG GIAN LÀM VIỆC</div>
        {tabs.map(([id, title, Icon]) => (
          <button
            className={tab === id ? 'selected' : ''}
            key={id}
            onClick={() => {
              setTab(id);
              setPage(0);
              setQ('');
              setEditing(null);
            }}
          >
            <Icon size={18} />
            {title}
          </button>
        ))}
        <Link className="sidebar-store" href="/">
          Xem cửa hàng <ArrowUpRight size={16} />
        </Link>
        <div className="sidebar-profile">
          <span>C</span>
          <div>
            Cozy pajamas<small>{user.role === 'ADMIN' ? 'Chủ cửa hàng' : 'Nhân viên'}</small>
          </div>
        </div>
      </aside>
      <section className="admin-main">
        <div className="section-heading">
          <div>
            <div className="admin-breadcrumb">
              Cozy Studio <span>/</span> Quản lý cửa hàng
            </div>
            <h1>{tabs.find((t) => t[0] === tab)?.[1]}</h1>
            <p className="admin-subtitle">Mọi điều nhỏ được chăm chút, từ đây.</p>
          </div>
          <button onClick={() => void load()}>
            <RefreshCw size={16} /> Làm mới
          </button>
        </div>
        {message && (
          <div className="notice" role="status">
            {message}
          </div>
        )}
        {tab === 'overview' ? (
          <>
            <div className="stats">
              <div>
                <small>Doanh thu đã thu · đơn thực</small>
                <strong>{money(revenue)}</strong>
              </div>
              <div>
                <small>Tổng đơn trong danh sách</small>
                <strong>{data.orders.length}</strong>
              </div>
              <div>
                <small>Đang chờ xác nhận</small>
                <strong>{data.orders.filter((o) => o.status === 'PENDING').length}</strong>
              </div>
              <div>
                <small>Biến thể tồn kho thấp</small>
                <strong>{data.variants.filter((v) => v.stock < 5).length}</strong>
              </div>
            </div>
            <div className="admin-columns">
              <div className="panel">
                <h2>Tình hình xử lý đơn</h2>
                {['PENDING', 'CONFIRMED', 'SHIPPING', 'COMPLETED', 'CANCELLED'].map((status) => (
                  <div className="bar-row" key={status}>
                    <span>{labels[status]}</span>
                    <div>
                      <i
                        style={{
                          width: `${Math.max(2, (data.orders.filter((o) => o.status === status).length / Math.max(1, data.orders.length)) * 100)}%`,
                        }}
                      />
                    </div>
                    <strong>{data.orders.filter((o) => o.status === status).length}</strong>
                  </div>
                ))}
              </div>
              <div className="panel">
                <h2>Công việc cần chú ý</h2>
                <p>
                  {data.transactions.filter((t) => t.outcome !== 'MATCHED').length} giao dịch cần
                  kiểm tra
                </p>
                <p>
                  {data.returns.filter((r) => r.status === 'REQUESTED').length} yêu cầu đổi trả mới
                </p>
                <p>{data.reviews.filter((r) => !r.approved).length} đánh giá chờ duyệt</p>
                <button disabled={busy} onClick={() => void action('expire', {})}>
                  Giải phóng đơn QR hết hạn
                </button>
              </div>
            </div>
            <div className="panel">
              <h2>Nhật ký hoạt động</h2>
              {data.audit.slice(0, 12).map((a) => (
                <p key={a.id} className="audit-line">
                  <span>{a.action}</span>
                  <small>{a.target}</small>
                  <small>{new Date(a.createdAt).toLocaleString('vi-VN')}</small>
                </p>
              ))}
              {!data.audit.length && <p>Chưa có hoạt động quản trị.</p>}
            </div>
            <p className="muted">
              Tổng quan tính trên tối đa 500 đơn gần nhất. Thanh toán thử nghiệm không tính vào
              doanh thu.
            </p>
          </>
        ) : (
          <>
            {!['products', 'new-product', 'categories', 'new-category'].includes(tab) && (
              <div className="filters">
                <label className="search">
                  <Search size={17} />
                  <input
                    aria-label="Tìm kiếm dữ liệu"
                    placeholder="Tìm trong danh sách…"
                    value={q}
                    onChange={(e) => {
                      setQ(e.target.value);
                      setPage(0);
                    }}
                  />
                </label>
                <span>{rows.length} kết quả</span>
              </div>
            )}
            {['products', 'new-product', 'categories', 'new-category'].includes(tab) && (
              <CatalogAdmin
                key={tab}
                tab={tab}
                data={data}
                reload={load}
                navigate={setTab}
                onError={onError}
              />
            )}
            {tab === 'inventory' && (
              <>
                {' '}
                <details className="panel">
                  <summary>Thêm biến thể màu / size</summary>
                  <form
                    className="admin-form"
                    onSubmit={(e) =>
                      submit(e, 'variant', (b) => ({ ...b, price: Number(b.price) }))
                    }
                  >
                    <label className="field">
                      Sản phẩm
                      <select name="productId">
                        {data.products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <Field name="sku" label="SKU duy nhất" />
                    <Field name="color" label="Màu sắc" />
                    <Field name="size" label="Kích thước" />
                    <Field name="price" label="Giá bán VND" type="number" />
                    <button disabled={busy}>Tạo biến thể</button>
                  </form>
                </details>
                <h2>Quản lý tồn kho</h2>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>SKU</th>
                        <th>Màu / size</th>
                        <th>Giá</th>
                        <th>Tồn</th>
                        <th>Nhập / xuất kho</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.variants
                        .filter((v) =>
                          (v.sku + ' ' + v.color).toLowerCase().includes(q.toLowerCase()),
                        )
                        .map((v) => (
                          <tr key={v.id}>
                            <td>{v.sku}</td>
                            <td>
                              {v.color} / {v.size}
                            </td>
                            <td>
                              <form
                                className="inline-form"
                                onSubmit={(e) => {
                                  e.preventDefault();
                                  const f = new FormData(e.currentTarget);
                                  void action('variant', {
                                    id: v.id,
                                    productId: v.productId,
                                    sku: v.sku,
                                    color: v.color,
                                    size: v.size,
                                    price: Number(f.get('price')),
                                  });
                                }}
                              >
                                <input
                                  aria-label={'Giá ' + v.sku}
                                  name="price"
                                  type="number"
                                  min="1000"
                                  defaultValue={v.price}
                                />
                                <button disabled={busy}>Lưu</button>
                              </form>
                            </td>
                            <td>
                              <span className={'badge ' + (v.stock < 5 ? 'warning' : '')}>
                                {v.stock}
                              </span>
                            </td>
                            <td>
                              <form
                                className="inline-form"
                                onSubmit={(e) => {
                                  e.preventDefault();
                                  const f = new FormData(e.currentTarget);
                                  void action('stock', {
                                    id: v.id,
                                    delta: Number(f.get('delta')),
                                    reason: f.get('reason'),
                                  });
                                }}
                              >
                                <input
                                  name="delta"
                                  type="number"
                                  required
                                  placeholder="+ / −"
                                  aria-label={'Điều chỉnh ' + v.sku}
                                />
                                <input
                                  name="reason"
                                  required
                                  minLength={3}
                                  placeholder="Lý do"
                                  aria-label="Lý do nhập xuất"
                                />
                                <button disabled={busy}>Lưu</button>
                              </form>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
                <details className="panel">
                  <summary>Lịch sử nhập xuất kho</summary>
                  {data.inventory.map((m) => (
                    <p key={m.id}>
                      {m.variantId} · {m.delta > 0 ? '+' : ''}
                      {m.delta} · {m.reason}
                    </p>
                  ))}
                </details>
              </>
            )}
            {tab === 'orders' && (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Đơn hàng</th>
                      <th>Khách hàng</th>
                      <th>Tổng tiền</th>
                      <th>Thanh toán</th>
                      <th>Xử lý</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((o) => (
                      <tr key={o.id}>
                        <td>
                          <Link href={'/don-hang/' + o.id}>{o.code} ↗</Link>
                          {o.test && <small>Thử nghiệm</small>}
                        </td>
                        <td>
                          {o.customer.name}
                          <small>{o.customer.phone}</small>
                        </td>
                        <td>{money(o.total)}</td>
                        <td>
                          {o.method} · {labels[o.paymentStatus]}
                          {o.method === 'COD' &&
                            o.status === 'COMPLETED' &&
                            o.paymentStatus !== 'PAID' && (
                              <button
                                disabled={busy}
                                onClick={() => {
                                  if (confirm('Xác nhận đã thực sự thu tiền COD?'))
                                    void action('cod-paid', { id: o.id });
                                }}
                              >
                                Ghi nhận đã thu
                              </button>
                            )}
                        </td>
                        <td>
                          <span className="badge">{labels[o.status]}</span>
                          <div className="row-actions">
                            {(
                              {
                                PENDING: ['CONFIRMED', 'CANCELLED'],
                                CONFIRMED: ['SHIPPING', 'CANCELLED'],
                                SHIPPING: ['COMPLETED'],
                              } as Record<string, string[]>
                            )[o.status]?.map((status) => (
                              <button
                                disabled={busy}
                                key={status}
                                onClick={() => {
                                  if (confirm(`Chuyển đơn sang ${labels[status]}?`))
                                    void action('order', { id: o.id, status });
                                }}
                              >
                                {labels[status]}
                              </button>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {tab === 'users' && (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Họ tên</th>
                      <th>Email</th>
                      <th>Vai trò</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((u) => (
                      <tr key={u.id}>
                        <td>{u.name}</td>
                        <td>{u.email}</td>
                        <td>
                          {user.role === 'ADMIN' ? (
                            <select
                              aria-label={'Vai trò ' + u.name}
                              value={u.role}
                              disabled={busy}
                              onChange={(e) => {
                                if (confirm('Thay đổi quyền truy cập của tài khoản này?'))
                                  void action('role', { id: u.id, role: e.target.value });
                              }}
                            >
                              {['CUSTOMER', 'STAFF', 'ADMIN'].map((r) => (
                                <option key={r}>{r}</option>
                              ))}
                            </select>
                          ) : (
                            u.role
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {tab === 'vouchers' && (
              <>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Mã</th>
                        <th>Ưu đãi</th>
                        <th>Tối thiểu</th>
                        <th>Đã dùng</th>
                        <th>Hết hạn</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shown.map((v) => (
                        <tr key={v.id}>
                          <td>{v.code}</td>
                          <td>{v.percent}%</td>
                          <td>{money(v.minimum)}</td>
                          <td>
                            {v.used}/{v.limit}
                          </td>
                          <td>
                            {new Date(v.expiresAt).toLocaleDateString('vi-VN')}
                            <button onClick={() => setEditing(v)}>Sửa</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <form
                  key={editing?.id ?? 'voucher'}
                  className="panel admin-form"
                  onSubmit={(e) =>
                    submit(e, 'voucher', (b) => ({
                      ...b,
                      percent: Number(b.percent),
                      minimum: Number(b.minimum),
                      limit: Number(b.limit),
                      active: b.active === 'on',
                    }))
                  }
                >
                  <h3>{editing ? 'Sửa' : 'Thêm'} voucher</h3>
                  <Field name="code" label="Mã" defaultValue={editing?.code} />
                  <Field
                    name="percent"
                    label="Phần trăm giảm"
                    type="number"
                    defaultValue={String(editing?.percent ?? 10)}
                  />
                  <Field
                    name="minimum"
                    label="Giá trị đơn tối thiểu"
                    type="number"
                    defaultValue={String(editing?.minimum ?? 300000)}
                  />
                  <Field
                    name="limit"
                    label="Số lượt tối đa"
                    type="number"
                    defaultValue={String(editing?.limit ?? 100)}
                  />
                  <Field
                    name="expiresAt"
                    label="Hết hạn"
                    type="date"
                    defaultValue={editing?.expiresAt?.slice(0, 10)}
                  />
                  <label>
                    <input name="active" type="checkbox" defaultChecked={editing?.active ?? true} />{' '}
                    Kích hoạt
                  </label>
                  <button disabled={busy}>Lưu voucher</button>
                </form>
              </>
            )}
            {tab === 'transactions' && (
              <>
                <div className="notice">
                  Webhook chỉ tự xác nhận khi khớp đầy đủ. Giao dịch thiếu, thừa, trễ hoặc không
                  khớp được giữ lại để đối soát; không tự cộng vào doanh thu.
                </div>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Giao dịch</th>
                        <th>Số tiền</th>
                        <th>Kết quả đối chiếu</th>
                        <th>Đơn liên quan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shown.map((t) => (
                        <tr key={t.id}>
                          <td>{t.providerId}</td>
                          <td>{money(t.amount)}</td>
                          <td>
                            <span className="badge">{t.outcome}</span>
                          </td>
                          <td>
                            {t.orderId ? (
                              <Link href={'/don-hang/' + t.orderId}>Xem đơn ↗</Link>
                            ) : (
                              'Không xác định'
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
            {tab === 'reviews' &&
              shown.map((r) => (
                <div className="panel" key={r.id}>
                  <strong>
                    {'★'.repeat(r.rating)} · {r.productId}
                  </strong>
                  <p>{r.comment}</p>
                  <button
                    disabled={busy}
                    onClick={() => void action('review', { id: r.id, approved: !r.approved })}
                  >
                    {r.approved ? 'Ẩn đánh giá' : 'Duyệt đánh giá'}
                  </button>
                </div>
              ))}
            {tab === 'returns' &&
              shown.map((r) => (
                <div className="panel" key={r.id}>
                  <Link href={'/don-hang/' + r.orderId}>Xem đơn ↗</Link>
                  <p>{r.reason}</p>
                  <span className="badge">{labels[r.status]}</span>
                  <div className="row-actions">
                    {['APPROVED', 'REJECTED', 'RECEIVED'].map((status) => (
                      <button
                        key={status}
                        disabled={busy}
                        onClick={() => {
                          if (confirm(`Cập nhật đổi trả: ${labels[status]}?`))
                            void action('return', { id: r.id, status });
                        }}
                      >
                        {labels[status]}
                      </button>
                    ))}
                  </div>
                  <small>
                    Nhập lại tồn kho sau khi kiểm tra hàng nhận. Hoàn tiền cần thực hiện và kiểm
                    chứng ngoài hệ thống.
                  </small>
                </div>
              ))}
            {tab === 'content' &&
              data.content.map((c) => (
                <form
                  key={c.id}
                  className="panel"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    void action('content', { id: c.id, value: f.get('value') });
                  }}
                >
                  <h3>
                    {{
                      hero: 'Tiêu đề trang chủ',
                      announcement: 'Thanh thông báo',
                      about: 'Câu chuyện thương hiệu',
                    }[c.id as string] ?? c.id}
                  </h3>
                  <textarea name="value" required defaultValue={c.value} />
                  <button disabled={busy}>Lưu nội dung</button>
                </form>
              ))}
            {!shown.length &&
              !['products', 'new-product', 'categories', 'new-category', 'inventory'].includes(
                tab,
              ) && (
                <div className="empty">
                  <Package />
                  <h3>Chưa có dữ liệu phù hợp</h3>
                </div>
              )}
            {!['products', 'new-product', 'categories', 'new-category', 'inventory'].includes(
              tab,
            ) && (
              <div className="pagination">
                <button disabled={page === 0} onClick={() => setPage(page - 1)}>
                  Trước
                </button>
                <span>
                  Trang {page + 1} / {Math.max(1, Math.ceil(rows.length / 12))}
                </span>
                <button disabled={(page + 1) * 12 >= rows.length} onClick={() => setPage(page + 1)}>
                  Sau
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
}
