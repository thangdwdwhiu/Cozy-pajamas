'use client';
import { useEffect, useState, FormEvent } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  ArrowRight,
  Heart,
  ShoppingBag,
  Search,
  User,
  Menu,
  X,
  Minus,
  Plus,
  Truck,
  Leaf,
  ShieldCheck,
  ArrowUpRight,
  Star,
  Check,
  LogOut,
} from 'lucide-react';
import Admin from './admin';
import ProductGallery from './product-gallery';
export type Variant = {
  id: string;
  productId: string;
  sku: string;
  color: string;
  size: string;
  price: number;
  stock: number;
};
export type Product = {
  id: string;
  slug: string;
  name: string;
  description: string;
  material: string;
  categoryId: string;
  image: string;
  images: string[];
  variants: Variant[];
  reviews: { rating: number; comment: string }[];
};
type CartItem = { variantId: string; quantity: number };
type UserData = { id: string; name: string; email: string; role: string };
type Order = {
  id: string;
  code: string;
  total: number;
  subtotal: number;
  discount: number;
  shipping: number;
  status: string;
  paymentStatus: string;
  method: string;
  test: boolean;
  createdAt: string;
  expiresAt: string;
  customer: { name: string; phone: string; email: string; address: string };
};
export const money = (v: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(v);
export const labels: Record<string, string> = {
  PENDING: 'Chờ xác nhận',
  CONFIRMED: 'Đã xác nhận',
  SHIPPING: 'Đang giao',
  COMPLETED: 'Đã giao',
  CANCELLED: 'Đã hủy',
  EXPIRED: 'Hết hạn',
  UNPAID: 'Chưa thanh toán',
  PAID: 'Đã thanh toán',
  REFUND_PENDING: 'Chờ hoàn tiền',
  REQUESTED: 'Chờ tiếp nhận',
  APPROVED: 'Đã chấp nhận',
  REJECTED: 'Từ chối',
  RECEIVED: 'Đã nhận hàng trả',
};
export async function api(path: string, body?: unknown, token?: string) {
  const response = await fetch('/api/' + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { 'x-order-token': token } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw Error(data.error ?? 'Không thể kết nối');
  return data;
}
export function Field({
  label,
  name,
  type = 'text',
  required = true,
  defaultValue,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  defaultValue?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input name={name} type={type} required={required} defaultValue={defaultValue} />
    </label>
  );
}
export default function Store({
  initial,
}: {
  initial?: {
    products: Product[];
    categories: { id: string; name: string; slug: string }[];
    content: { id: string; value: string }[];
  };
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>(initial?.products ?? []),
    [categories, setCategories] = useState<{ id: string; name: string; slug: string }[]>(
      initial?.categories ?? [],
    ),
    [content, setContent] = useState<Record<string, string>>(
      Object.fromEntries((initial?.content ?? []).map((c) => [c.id, c.value])),
    ),
    [user, setUser] = useState<UserData | null>(null),
    [loaded, setLoaded] = useState(!!initial),
    [error, setError] = useState(''),
    [toast, setToast] = useState(''),
    [cart, setCart] = useState<CartItem[]>([]),
    [wishlist, setWishlist] = useState<string[]>([]),
    [menu, setMenu] = useState(false),
    [query, setQuery] = useState(''),
    [category, setCategory] = useState('all'),
    [sort, setSort] = useState('featured'),
    [size, setSize] = useState('all'),
    [maxPrice, setMaxPrice] = useState('all'),
    [selected, setSelected] = useState(''),
    [quantity, setQuantity] = useState(1),
    [busy, setBusy] = useState(false);
  async function reload() {
    try {
      const d = await api('catalog');
      setProducts(d.products);
      setCategories(d.categories);
      setContent(
        Object.fromEntries(d.content.map((c: { id: string; value: string }) => [c.id, c.value])),
      );
      setUser(d.user);
      setError('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoaded(true);
    }
  }
  useEffect(() => {
    void reload();
    try {
      setCart(JSON.parse(localStorage.getItem('cozy-cart') ?? '[]'));
      setWishlist(JSON.parse(localStorage.getItem('cozy-wishlist') ?? '[]'));
    } catch {}
  }, []);
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(''), 3500);
      return () => clearTimeout(timer);
    }
  }, [toast]);
  useEffect(() => {
    setMenu(false);
    setSelected('');
    setQuantity(1);
    setError('');
  }, [pathname]);
  function saveCart(items: CartItem[]) {
    setCart(items);
    localStorage.setItem('cozy-cart', JSON.stringify(items));
  }
  function favorite(id: string) {
    const next = wishlist.includes(id) ? wishlist.filter((x) => x !== id) : [...wishlist, id];
    setWishlist(next);
    localStorage.setItem('cozy-wishlist', JSON.stringify(next));
  }
  const lines = cart
    .map((item) => {
      const p = products.find((p) => p.variants.some((v) => v.id === item.variantId));
      const v = p?.variants.find((v) => v.id === item.variantId);
      return { item, p, v };
    })
    .filter((l) => l.p && l.v);
  const subtotal = lines.reduce((sum, l) => sum + l.v!.price * l.item.quantity, 0);
  function add(p: Product) {
    const v = p.variants.find((v) => v.id === selected);
    if (!v) {
      setToast('Bạn chọn kích thước trước nhé.');
      return;
    }
    if (!v.stock) {
      setToast('Phân loại này đã hết hàng');
      return;
    }
    const existing = cart.find((c) => c.variantId === v.id);
    if ((existing?.quantity ?? 0) + quantity > v.stock) {
      setToast('Số lượng vượt quá tồn kho');
      return;
    }
    saveCart(
      existing
        ? cart.map((c) => (c.variantId === v.id ? { ...c, quantity: c.quantity + quantity } : c))
        : [...cart, { variantId: v.id, quantity }],
    );
    setToast('Đã thêm vào giỏ hàng');
  }
  async function act(task: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await task();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function ProductCard({ p, index = 0 }: { p: Product; index?: number }) {
    return (
      <article className="product-card">
        <div className="product-art">
          <Link href={'/san-pham/' + p.slug}>
            <img src={p.image} alt={p.name} loading="lazy" />
          </Link>
          {index < 2 && <span className="tag">{index === 0 ? 'Yêu thích nhất' : 'Mới về'}</span>}
          <button
            className={'heart icon-button ' + (wishlist.includes(p.id) ? 'saved' : '')}
            aria-label={'Yêu thích ' + p.name}
            onClick={() => favorite(p.id)}
          >
            <Heart size={18} fill={wishlist.includes(p.id) ? 'currentColor' : 'none'} />
          </button>
          <Link className="quick-shop" href={'/san-pham/' + p.slug}>
            Khám phá sản phẩm <ArrowUpRight size={16} />
          </Link>
        </div>
        <div className="product-caption">
          <div>
            <small>{p.material}</small>
            <Link href={'/san-pham/' + p.slug}>
              <h3>{p.name}</h3>
            </Link>
            <strong>
              {p.variants.length
                ? money(Math.min(...p.variants.map((v) => v.price)))
                : 'Sắp ra mắt'}
            </strong>
          </div>
          <div className={'swatch swatch-' + p.id} />
        </div>
      </article>
    );
  }
  const isHome = pathname === '/';
  const isCatalog = pathname === '/san-pham' || pathname === '/yeu-thich';
  const product = products.find((p) => pathname === '/san-pham/' + p.slug);
  const filtered = products
    .filter(
      (p) =>
        (category === 'all' || p.categoryId === category) &&
        (p.name + ' ' + p.material)
          .toLocaleLowerCase('vi')
          .includes(query.toLocaleLowerCase('vi')) &&
        (size === 'all' || p.variants.some((v) => v.size === size && v.stock > 0)) &&
        (maxPrice === 'all' || p.variants.some((v) => v.price <= Number(maxPrice))) &&
        (pathname !== '/yeu-thich' || wishlist.includes(p.id)),
    )
    .sort((a, b) =>
      sort === 'low'
        ? Math.min(...a.variants.map((v) => v.price)) - Math.min(...b.variants.map((v) => v.price))
        : sort === 'high'
          ? Math.min(...b.variants.map((v) => v.price)) -
            Math.min(...a.variants.map((v) => v.price))
          : 0,
    );
  if (pathname.startsWith('/admin'))
    return (
      <>
        {error && (
          <div className="notice error" role="alert">
            {error}
            <button onClick={() => setError('')}>Đóng</button>
          </div>
        )}
        <Admin user={user} onError={setError} />
      </>
    );
  return (
    <>
      <div className="announcement">
        {content.announcement ?? 'Miễn phí vận chuyển cho đơn từ 599.000đ'} <span>•</span> Một chút
        dịu dàng, dành riêng cho bạn
      </div>
      <header>
        <div className="nav container">
          <button
            className="icon-button mobile-only"
            aria-label="Mở menu"
            onClick={() => setMenu(!menu)}
          >
            <Menu />
          </button>
          <Link href="/" className="logo">
            cozy<span>pajamas</span>
            <i>✳</i>
          </Link>
          <nav className={menu ? 'open' : ''}>
            <Link className={isHome ? 'active' : ''} href="/">
              Trang chủ
            </Link>
            <Link
              className={isCatalog ? 'active' : ''}
              href="/san-pham"
              onClick={() => setCategory('all')}
            >
              Sản phẩm
            </Link>
            <Link
              href="/san-pham"
              onClick={() => {
                setCategory('pajama');
                setSort('featured');
              }}
            >
              Bộ sưu tập
            </Link>
            <Link href="/cau-chuyen">Về Cozy</Link>
          </nav>
          <div className="nav-icons">
            <Link aria-label="Tìm kiếm" href="/san-pham">
              <Search size={21} />
            </Link>
            <Link className="desktop-only" aria-label="Tài khoản" href="/tai-khoan">
              <User size={21} />
            </Link>
            <Link aria-label="Yêu thích" href="/yeu-thich">
              <Heart size={21} />
            </Link>
            <Link className="bag" aria-label="Giỏ hàng" href="/gio-hang">
              <ShoppingBag size={21} />
              <span>{cart.reduce((s, c) => s + c.quantity, 0)}</span>
            </Link>
          </div>
        </div>
      </header>
      {toast && (
        <div className="toast" role="status">
          <Check size={18} />
          {toast}
        </div>
      )}
      {error && (
        <div className="notice error container" role="alert">
          {error}
          <button className="icon-button" aria-label="Đóng thông báo" onClick={() => setError('')}>
            <X size={18} />
          </button>
        </div>
      )}
      {!loaded ? (
        <main className="container skeleton">
          <div />
          <div />
          <div />
          <p>Đang chuẩn bị những điều mềm mại…</p>
        </main>
      ) : pathname.startsWith('/admin') ? (
        <Admin user={user} onError={setError} />
      ) : isHome ? (
        <main>
          <section className="hero">
            <div className="hero-inner container">
              <div className="hero-copy">
                <div className="eyebrow">
                  <span /> THE ART OF SLOW LIVING
                </div>
                <h1>{content.hero ?? 'Êm ái từng khoảnh khắc.'}</h1>
                <p>
                  Gác lại bộn bề, trở về với sự dịu dàng.
                  <br />
                  Những bộ đồ thật mềm, cho những phút giây thật bạn.
                </p>
                <Link className="button" href="/san-pham">
                  Khám phá bộ sưu tập <ArrowRight size={18} />
                </Link>
                <div className="hero-note">
                  <span className="tiny-flower">✳</span> Mềm mại trên da. Nhẹ nhàng trong tâm hồn.
                </div>
              </div>
              <div className="hero-image">
                <img
                  src="/images/hero.svg"
                  alt="Minh họa bộ pijama hồng trong không gian nghỉ ngơi ấm áp"
                />
                <span className="hero-sticker">
                  made for
                  <br />
                  <em>sweet dreams</em>
                  <span>♡</span>
                </span>
                <div className="image-label">
                  THE COZY EDIT <span>01 / 03</span>
                </div>
              </div>
            </div>
            <div className="hero-bottom">
              SLOW DOWN. GET COZY. <span>✧</span> YOUR EVERYDAY SOFTNESS.
            </div>
          </section>
          <section className="benefits container">
            <div>
              <Truck />
              <span>
                <strong>Giao hàng toàn quốc</strong>
                <small>Miễn phí từ 599.000đ</small>
              </span>
            </div>
            <div>
              <Leaf />
              <span>
                <strong>Chất liệu nâng niu làn da</strong>
                <small>Mềm mại trong từng chuyển động</small>
              </span>
            </div>
            <div>
              <ShieldCheck />
              <span>
                <strong>An tâm mua sắm</strong>
                <small>Hỗ trợ đổi trả trong 7 ngày</small>
              </span>
            </div>
          </section>
          <section className="container section">
            <div className="section-heading">
              <div>
                <div className="eyebrow">FIND YOUR COZY</div>
                <h2>Hôm nay, bạn muốn mặc gì?</h2>
              </div>
              <p>Một chút thoải mái cho mỗi ngày.</p>
            </div>
            <div className="category-grid">
              {categories.map((c, i) => (
                <Link
                  href="/san-pham"
                  onClick={() => setCategory(c.id)}
                  className={'category category-' + i}
                  key={c.id}
                >
                  <img src={'/images/' + ['rose', 'pearl', 'sage'][i % 3] + '.svg'} alt={c.name} />
                  <div>
                    <h3>{c.name}</h3>
                    <span>
                      Khám phá <ArrowUpRight size={18} />
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
          <section className="container section">
            <div className="section-heading">
              <div>
                <div className="eyebrow">LOVED BY YOU</div>
                <h2>Những điều mềm mại được yêu thích</h2>
              </div>
              <Link className="text-link" href="/san-pham">
                Xem tất cả <ArrowRight size={17} />
              </Link>
            </div>
            <div className="product-grid">
              {products.slice(0, 4).map((p, i) => (
                <ProductCard key={p.id} p={p} index={i} />
              ))}
            </div>
          </section>
          <section className="story container">
            <div className="story-art">
              <span>
                the little
                <br />
                <em>joy of</em>
                <br />
                staying in.
              </span>
              <i>✳</i>
            </div>
            <div>
              <div className="eyebrow">A LITTLE ABOUT COZY</div>
              <h2>
                Ở nhà, cũng là lúc
                <br />
                bạn xứng đáng đẹp.
              </h2>
              <p>{content.about}</p>
              <Link className="text-link" href="/cau-chuyen">
                Câu chuyện của chúng mình <ArrowRight size={17} />
              </Link>
            </div>
          </section>
          <section className="cozy-club">
            <span>♡</span>
            <h2>Dành một chút dịu dàng cho bản thân.</h2>
            <p>Bắt đầu hành trình cùng Cozy. Giảm 10% với mã COZY10 cho đơn từ 300.000đ.</p>
            <Link href="/san-pham" className="button">
              Tìm điều mềm mại của bạn <ArrowRight size={17} />
            </Link>
          </section>
        </main>
      ) : isCatalog ? (
        <main className="container section">
          <div className="breadcrumb">
            <Link href="/">Trang chủ</Link> / {pathname === '/yeu-thich' ? 'Yêu thích' : 'Sản phẩm'}
          </div>
          <div className="catalog-title">
            <div className="eyebrow">YOUR EVERYDAY SOFTNESS</div>
            <h1>
              {pathname === '/yeu-thich'
                ? 'Dành riêng một góc yêu'
                : 'Tủ đồ của những ngày dịu dàng'}
            </h1>
            <p>Thiết kế tinh tế. Chất liệu mềm mại. Thoải mái là chính bạn.</p>
          </div>
          <div className="filters">
            <label className="search">
              <Search size={18} />
              <input
                placeholder="Tìm bộ đồ bạn yêu…"
                aria-label="Tìm sản phẩm"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <select
              aria-label="Danh mục"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="all">Tất cả danh mục</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select aria-label="Kích thước" value={size} onChange={(e) => setSize(e.target.value)}>
              <option value="all">Mọi kích thước</option>
              {['S', 'M', 'L', 'XL'].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            <select
              aria-label="Khoảng giá"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
            >
              <option value="all">Mọi mức giá</option>
              <option value="350000">Dưới 350.000đ</option>
              <option value="400000">Dưới 400.000đ</option>
            </select>
            <select aria-label="Sắp xếp" value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="featured">Nổi bật</option>
              <option value="low">Giá tăng dần</option>
              <option value="high">Giá giảm dần</option>
            </select>
          </div>
          <p className="muted">{filtered.length} sản phẩm dành cho bạn</p>
          <div className="product-grid">
            {filtered.map((p, i) => (
              <ProductCard key={p.id} p={p} index={i} />
            ))}
          </div>
          {!filtered.length && (
            <div className="empty">
              <Heart />
              <h2>Chưa có sản phẩm ở đây</h2>
              <p>Thử lựa chọn khác hoặc lưu những món đồ bạn yêu.</p>
              <button
                onClick={() => {
                  setQuery('');
                  setCategory('all');
                  setSize('all');
                  setMaxPrice('all');
                }}
              >
                Xóa bộ lọc
              </button>
            </div>
          )}
        </main>
      ) : product ? (
        <main className="container section">
          <div className="breadcrumb">
            <Link href="/san-pham">Sản phẩm</Link> / {product.name}
          </div>
          <div className="product-detail">
            <ProductGallery
              key={product.id}
              name={product.name}
              images={product.images?.length ? product.images : [product.image]}
            />
            <div className="detail-copy">
              <div className="eyebrow">THE COZY ESSENTIALS</div>
              <h1>{product.name}</h1>
              <p className="muted">{product.material} · Phom thoải mái</p>
              <div className="detail-price">
                {money(
                  product.variants.find((v) => v.id === selected)?.price ??
                    product.variants[0]?.price ??
                    0,
                )}
              </div>
              <p>{product.description}</p>
              <h4>Màu sắc & kích thước</h4>
              <div className="size-options">
                {product.variants.map((v) => (
                  <button
                    className={selected === v.id ? 'selected' : ''}
                    disabled={!v.stock}
                    key={v.id}
                    onClick={() => setSelected(v.id)}
                  >
                    {v.color} / {v.size}
                  </button>
                ))}
              </div>
              <details>
                <summary>Hướng dẫn chọn kích thước</summary>
                <table>
                  <thead>
                    <tr>
                      <th>Size</th>
                      <th>Cân nặng tham khảo</th>
                      <th>Vòng ngực</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['S', '40–47 kg', '80–84 cm'],
                      ['M', '48–54 kg', '85–89 cm'],
                      ['L', '55–61 kg', '90–94 cm'],
                      ['XL', '62–68 kg', '95–100 cm'],
                    ].map((r) => (
                      <tr key={r[0]}>
                        {r.map((c) => (
                          <td key={c}>{c}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <small>Số đo tham khảo; ưu tiên số đo cơ thể và độ rộng mong muốn.</small>
              </details>
              <div className="buy-row">
                <div className="quantity">
                  <button
                    aria-label="Giảm số lượng"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  >
                    <Minus size={15} />
                  </button>
                  {quantity}
                  <button
                    aria-label="Tăng số lượng"
                    onClick={() => setQuantity(Math.min(20, quantity + 1))}
                  >
                    <Plus size={15} />
                  </button>
                </div>
                <button className="button" onClick={() => add(product)}>
                  <ShoppingBag size={18} />
                  Thêm vào giỏ hàng
                </button>
                <button
                  className="icon-button"
                  aria-label="Lưu yêu thích"
                  onClick={() => favorite(product.id)}
                >
                  <Heart fill={wishlist.includes(product.id) ? 'currentColor' : 'none'} />
                </button>
              </div>
              <p className="muted">
                {selected
                  ? `${product.variants.find((v) => v.id === selected)?.stock} sản phẩm có sẵn`
                  : 'Chọn phân loại để xem tồn kho'}
              </p>
              <div className="detail-perks">
                <span>
                  <Truck size={18} /> Giao hàng toàn quốc
                </span>
                <span>
                  <ShieldCheck size={18} /> Hỗ trợ đổi trả 7 ngày
                </span>
              </div>
            </div>
          </div>
          <section className="section">
            <h2>Lời nhắn từ những người đã yêu Cozy</h2>
            {product.reviews.length ? (
              product.reviews.map((r, i) => (
                <blockquote key={i}>
                  {'★'.repeat(r.rating)}
                  <p>{r.comment}</p>
                </blockquote>
              ))
            ) : (
              <p className="muted">Chưa có đánh giá. Chia sẻ cảm nhận sau khi nhận hàng nhé.</p>
            )}
            {user && (
              <form
                className="review-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  void act(async () => {
                    await api('reviews', {
                      productId: product.id,
                      rating: Number(f.get('rating')),
                      comment: f.get('comment'),
                    });
                    setToast('Đánh giá đã gửi và đang chờ duyệt');
                  });
                }}
              >
                <select name="rating" aria-label="Số sao">
                  {[5, 4, 3, 2, 1].map((n) => (
                    <option key={n} value={n}>
                      {n} sao
                    </option>
                  ))}
                </select>
                <input name="comment" required minLength={5} placeholder="Cảm nhận của bạn" />
                <button disabled={busy}>Gửi đánh giá</button>
              </form>
            )}
          </section>
        </main>
      ) : pathname === '/gio-hang' || pathname === '/thanh-toan' ? (
        <main className="container section">
          <div className="eyebrow">A LITTLE HAPPINESS TO TAKE HOME</div>
          <h1>{pathname === '/gio-hang' ? 'Giỏ đồ mềm mại' : 'Hoàn tất đơn hàng'}</h1>
          {!lines.length ? (
            <div className="empty">
              <ShoppingBag size={44} />
              <h2>Giỏ hàng đang chờ những điều dễ thương</h2>
              <Link href="/san-pham" className="button">
                Khám phá sản phẩm <ArrowRight size={18} />
              </Link>
            </div>
          ) : (
            <div className="checkout-grid">
              <div>
                {pathname === '/thanh-toan' ? (
                  <form
                    id="checkout"
                    className="panel"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const f = new FormData(e.currentTarget);
                      void act(async () => {
                        let key = sessionStorage.getItem('cozy-checkout-key');
                        if (!key) {
                          key = crypto.randomUUID();
                          sessionStorage.setItem('cozy-checkout-key', key);
                        }
                        const result = await api('checkout', {
                          items: cart,
                          customer: Object.fromEntries(
                            ['name', 'email', 'phone', 'address'].map((k) => [k, f.get(k)]),
                          ),
                          method: f.get('method'),
                          voucher: f.get('voucher') || undefined,
                          idempotencyKey: key,
                        });
                        localStorage.setItem('order-' + result.id, result.access);
                        sessionStorage.removeItem('cozy-checkout-key');
                        saveCart([]);
                        router.push('/don-hang/' + result.id);
                      });
                    }}
                  >
                    <h2>Thông tin nhận hàng</h2>
                    <p className="muted">Bạn có thể đặt hàng mà không cần tạo tài khoản.</p>
                    <Field label="Họ và tên" name="name" defaultValue={user?.name} />
                    <Field label="Email" name="email" type="email" defaultValue={user?.email} />
                    <Field label="Số điện thoại" name="phone" type="tel" />
                    <Field label="Địa chỉ đầy đủ (số nhà, phường/xã, tỉnh/thành)" name="address" />
                    <h3>Phương thức thanh toán</h3>
                    <label className="radio">
                      <input type="radio" name="method" value="COD" defaultChecked /> Thanh toán khi
                      nhận hàng (COD)
                    </label>
                    <label className="radio">
                      <input type="radio" name="method" value="BANK" /> Chuyển khoản QR ngân hàng
                    </label>
                    <p className="muted">
                      Khi thanh toán thật chưa bật, đơn QR được đánh dấu thử nghiệm và không hiển
                      thị mã chuyển tiền thật.
                    </p>
                    <Field label="Mã ưu đãi" name="voucher" required={false} />
                    <p className="muted">
                      COZY10: giảm 10% cho đơn từ 300.000đ. Ưu đãi được kiểm tra khi đặt hàng.
                    </p>
                  </form>
                ) : (
                  lines.map(({ item, p, v }) => (
                    <div className="cart-line" key={item.variantId}>
                      <img src={p!.image} alt={p!.name} />
                      <div>
                        <Link href={'/san-pham/' + p!.slug}>
                          <h3>{p!.name}</h3>
                        </Link>
                        <p>
                          {v!.color} / {v!.size}
                        </p>
                        <strong>{money(v!.price)}</strong>
                        <div className="quantity">
                          <button
                            aria-label="Giảm số lượng"
                            onClick={() =>
                              saveCart(
                                cart.map((c) =>
                                  c.variantId === item.variantId
                                    ? { ...c, quantity: Math.max(1, c.quantity - 1) }
                                    : c,
                                ),
                              )
                            }
                          >
                            <Minus size={14} />
                          </button>
                          {item.quantity}
                          <button
                            aria-label="Tăng số lượng"
                            onClick={() =>
                              saveCart(
                                cart.map((c) =>
                                  c.variantId === item.variantId
                                    ? { ...c, quantity: Math.min(v!.stock, c.quantity + 1) }
                                    : c,
                                ),
                              )
                            }
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                      </div>
                      <button
                        className="icon-button"
                        aria-label="Xóa sản phẩm"
                        onClick={() => saveCart(cart.filter((c) => c.variantId !== item.variantId))}
                      >
                        <X size={18} />
                      </button>
                    </div>
                  ))
                )}
              </div>
              <aside className="order-summary">
                <h2>Đơn hàng của bạn</h2>
                {pathname === '/thanh-toan' &&
                  lines.map((l) => (
                    <p key={l.item.variantId}>
                      {l.p!.name} × {l.item.quantity}
                      <span>{money(l.v!.price * l.item.quantity)}</span>
                    </p>
                  ))}
                <p>
                  Tạm tính <span>{money(subtotal)}</span>
                </p>
                <p>
                  Phí vận chuyển <span>{subtotal >= 599000 ? 'Miễn phí' : money(30000)}</span>
                </p>
                <p className="total">
                  Tổng trước ưu đãi{' '}
                  <span>{money(subtotal + (subtotal >= 599000 ? 0 : 30000))}</span>
                </p>
                {pathname === '/gio-hang' ? (
                  <Link href="/thanh-toan" className="button">
                    Tiến hành thanh toán <ArrowRight size={18} />
                  </Link>
                ) : (
                  <button className="button" type="submit" form="checkout" disabled={busy}>
                    {busy ? 'Đang tạo đơn…' : 'Đặt hàng'}
                  </button>
                )}
                <p className="muted">
                  Bằng việc đặt hàng, bạn đồng ý với{' '}
                  <Link href="/chinh-sach">chính sách mua hàng</Link> của Cozy.
                </p>
              </aside>
            </div>
          )}
        </main>
      ) : pathname === '/tai-khoan' ? (
        <Account user={user} reload={reload} act={act} busy={busy} />
      ) : pathname.startsWith('/don-hang/') ? (
        <OrderView id={pathname.split('/')[2]} act={act} busy={busy} />
      ) : (
        <main className="container section prose">
          <div className="eyebrow">WITH LOVE, COZY</div>
          <h1>
            {pathname === '/cau-chuyen'
              ? 'Nhẹ nhàng, từ những điều nhỏ nhất.'
              : pathname === '/chinh-sach'
                ? 'An tâm cùng Cozy'
                : 'Trang bạn tìm chưa có ở đây'}
          </h1>
          {pathname === '/cau-chuyen' ? (
            <>
              <p>{content.about}</p>
              <img
                className="about-image"
                src="/images/hero.svg"
                alt="Không gian dịu dàng của Cozy"
              />
              <h2>Đẹp theo cách thoải mái nhất</h2>
              <p>
                Chúng mình chọn những chất liệu mềm mại và phom dáng tự nhiên, để mỗi khoảnh khắc ở
                nhà đều đáng được nâng niu.
              </p>
              <Link href="/san-pham" className="button">
                Khám phá Cozy <ArrowRight size={18} />
              </Link>
            </>
          ) : pathname === '/chinh-sach' ? (
            <>
              <h2>Giao hàng & thanh toán</h2>
              <p>
                Phí giao hàng 30.000đ, miễn phí từ 599.000đ. Thời gian dự kiến 2–5 ngày làm việc sau
                khi xác nhận đơn. COD hoặc chuyển khoản khi cửa hàng kích hoạt thanh toán ngân hàng.
              </p>
              <h2>Đổi trả</h2>
              <p>
                Gửi yêu cầu đổi trả từ trang đơn hàng trong 7 ngày kể từ khi nhận. Sản phẩm chưa sử
                dụng, còn tem nhãn, không có dấu hiệu giặt hoặc hư hỏng do sử dụng. Cửa hàng kiểm
                tra và phản hồi trước khi bạn gửi hàng về.
              </p>
              <h2>Quyền riêng tư</h2>
              <p>
                Thông tin liên hệ và địa chỉ được sử dụng để xử lý đơn hàng và hỗ trợ mua sắm. Không
                chia sẻ liên kết hoặc mã truy cập đơn hàng với người khác. Cookie thiết yếu được
                dùng để duy trì phiên đăng nhập; giỏ hàng lưu trên thiết bị của bạn.
              </p>
              <h2>Hỗ trợ</h2>
              <p>
                Bạn có thể theo dõi, hủy đơn đang chờ hoặc gửi yêu cầu đổi trả trực tiếp ở trang đơn
                hàng. Kênh liên hệ chính thức sẽ được cửa hàng cập nhật trước khi mở bán.
              </p>
            </>
          ) : (
            <Link href="/">Về trang chủ</Link>
          )}
        </main>
      )}
      <footer>
        <div className="container footer-grid">
          <div>
            <Link href="/" className="logo">
              cozy<span>pajamas</span>
              <i>✳</i>
            </Link>
            <p>
              Mềm mại từng chất liệu.
              <br />
              Dịu dàng từng khoảnh khắc.
            </p>
            <small>Designed for your sweetest moments.</small>
          </div>
          <div>
            <h4>Khám phá Cozy</h4>
            <Link href="/san-pham">Tất cả sản phẩm</Link>
            <Link href="/yeu-thich">Sản phẩm yêu thích</Link>
            <Link href="/cau-chuyen">Câu chuyện thương hiệu</Link>
          </div>
          <div>
            <h4>Chúng mình ở đây</h4>
            <Link href="/chinh-sach">Giao hàng & đổi trả</Link>
            <Link href="/tai-khoan">Tài khoản & đơn hàng</Link>
            <Link href="/chinh-sach">Chính sách bảo mật</Link>
          </div>
          <div>
            <h4>Một chút yêu thương</h4>
            <p>
              Chăm sóc bản thân bắt đầu
              <br />
              từ những điều giản dị nhất.
            </p>
            {user && ['ADMIN', 'STAFF'].includes(user.role) && (
              <Link href="/admin">Quản trị cửa hàng ↗</Link>
            )}
          </div>
        </div>
        <div className="container footer-bottom">
          <span>© {new Date().getFullYear()} Cozy pajamas.</span>
          <span>Made with softness & a little love ♡</span>
          <span>Việt Nam · VND</span>
        </div>
      </footer>
    </>
  );
}
function Account({
  user,
  reload,
  act,
  busy,
}: {
  user: UserData | null;
  reload: () => Promise<void>;
  act: (f: () => Promise<void>) => Promise<void>;
  busy: boolean;
}) {
  const [register, setRegister] = useState(false),
    [data, setData] = useState<{
      orders: Order[];
      addresses: { id: string; name: string; phone: string; address: string }[];
    } | null>(null);
  useEffect(() => {
    if (user) void act(async () => setData(await api('account')));
  }, [user]);
  return (
    <main className="container section account">
      {!user ? (
        <div className="auth-card">
          <div className="eyebrow">WELCOME TO YOUR COZY CORNER</div>
          <h1>{register ? 'Chào bạn mới' : 'Mừng bạn trở lại'}</h1>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void act(async () => {
                await api(register ? 'auth/register' : 'auth/login', Object.fromEntries(f));
                await reload();
              });
            }}
          >
            {register && <Field label="Họ và tên" name="name" />}
            <Field label="Email" name="email" type="email" />
            <Field label="Mật khẩu (ít nhất 10 ký tự)" name="password" type="password" />
            <button className="button" disabled={busy}>
              {busy ? 'Đang xử lý…' : register ? 'Tạo tài khoản' : 'Đăng nhập'}
            </button>
          </form>
          <button className="text-link" onClick={() => setRegister(!register)}>
            {register ? 'Đã có tài khoản? Đăng nhập' : 'Chưa có tài khoản? Đăng ký'}
          </button>
        </div>
      ) : (
        <>
          <div className="section-heading">
            <div>
              <div className="eyebrow">YOUR COZY CORNER</div>
              <h1>Xin chào, {user.name}</h1>
            </div>
            <button
              onClick={() =>
                void act(async () => {
                  await api('auth/logout', {});
                  await reload();
                })
              }
            >
              <LogOut size={16} /> Đăng xuất
            </button>
          </div>
          {['ADMIN', 'STAFF'].includes(user.role) && (
            <Link className="button" href="/admin">
              Quản trị cửa hàng <ArrowUpRight size={17} />
            </Link>
          )}
          <h2>Đơn hàng của bạn</h2>
          {data?.orders.length ? (
            data.orders.map((o) => (
              <Link href={'/don-hang/' + o.id} className="order-row" key={o.id}>
                <div>
                  <strong>{o.code}</strong>
                  <small>{new Date(o.createdAt).toLocaleDateString('vi-VN')}</small>
                </div>
                <span className="badge">{labels[o.status]}</span>
                <strong>{money(o.total)}</strong>
                <ArrowRight size={18} />
              </Link>
            ))
          ) : (
            <p className="muted">Bạn chưa có đơn hàng. Tìm một món đồ thật êm nhé.</p>
          )}
          <h2>Sổ địa chỉ</h2>
          <div className="address-grid">
            {data?.addresses.map((a) => (
              <div className="panel" key={a.id}>
                <strong>{a.name}</strong>
                <p>{a.phone}</p>
                <p>{a.address}</p>
              </div>
            ))}
          </div>
          <form
            className="panel narrow"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void act(async () => {
                await api('addresses', Object.fromEntries(f));
                setData(await api('account'));
              });
            }}
          >
            <h3>Thêm địa chỉ</h3>
            <Field name="name" label="Người nhận" />
            <Field name="phone" label="Điện thoại" />
            <Field name="address" label="Địa chỉ" />
            <button disabled={busy}>Lưu địa chỉ</button>
          </form>
        </>
      )}
    </main>
  );
}
function OrderView({
  id,
  act,
  busy,
}: {
  id: string;
  act: (f: () => Promise<void>) => Promise<void>;
  busy: boolean;
}) {
  const [data, setData] = useState<{
      order: Order;
      items: {
        id: string;
        name: string;
        image: string;
        color: string;
        size: string;
        price: number;
        quantity: number;
      }[];
      qr: string | null;
      bankName: string | null;
      bankAccount: string | null;
      returns: { status: string }[];
    } | null>(null),
    [pollError, setPollError] = useState('');
  async function load() {
    try {
      setData(
        await api('orders/' + id, undefined, localStorage.getItem('order-' + id) ?? undefined),
      );
      setPollError('');
    } catch (e) {
      setPollError((e as Error).message);
    }
  }
  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 5000);
    return () => clearInterval(t);
  }, [id]);
  if (!data)
    return (
      <main className="container section">
        <h1>Đơn hàng của bạn</h1>
        <p>{pollError || 'Đang tải đơn hàng…'}</p>
        <Link href="/tai-khoan">Đăng nhập để xem đơn hàng</Link>
      </main>
    );
  const o = data.order;
  return (
    <main className="container section">
      <div className="eyebrow">THANK YOU FOR CHOOSING COZY</div>
      <h1>Cảm ơn bạn đã chọn sự dịu dàng.</h1>
      <p>
        Đơn hàng <strong>{o.code}</strong>
      </p>
      {pollError && <p className="notice error">{pollError} — sẽ tự kết nối lại.</p>}
      <div className="checkout-grid">
        <section className="panel">
          <div className="status-row">
            <span className="badge">{labels[o.status]}</span>
            <span className="badge">{labels[o.paymentStatus]}</span>
            {o.test && <span className="badge warning">Đơn thanh toán thử nghiệm</span>}
          </div>
          {data.items.map((i) => (
            <div className="cart-line" key={i.id}>
              <img src={i.image} alt={i.name} />
              <div>
                <h3>{i.name}</h3>
                <p>
                  {i.color} / {i.size} × {i.quantity}
                </p>
                <strong>{money(i.price * i.quantity)}</strong>
              </div>
            </div>
          ))}
          <h3>Giao đến</h3>
          <p>
            {o.customer.name} · {o.customer.phone}
          </p>
          <p>{o.customer.address}</p>
          {o.status === 'PENDING' && (
            <button
              disabled={busy}
              onClick={() => {
                if (confirm('Hủy đơn hàng này và hoàn lại tồn kho?'))
                  void act(async () => {
                    await api('orders/action', {
                      id,
                      token: localStorage.getItem('order-' + id),
                      action: 'cancel',
                    });
                    await load();
                  });
              }}
            >
              Hủy đơn hàng
            </button>
          )}
          {o.status === 'COMPLETED' && !data.returns.length && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                void act(async () => {
                  await api('orders/action', {
                    id,
                    token: localStorage.getItem('order-' + id),
                    action: 'return',
                    reason: f.get('reason'),
                  });
                  await load();
                });
              }}
            >
              <Field name="reason" label="Lý do đổi trả (ít nhất 10 ký tự)" />
              <button disabled={busy}>Gửi yêu cầu đổi trả</button>
            </form>
          )}
          {data.returns.map((r, i) => (
            <p className="notice" key={i}>
              Đổi trả: {labels[r.status]}
            </p>
          ))}
        </section>
        <aside className="order-summary">
          <h2>Chi tiết thanh toán</h2>
          <p>
            Tạm tính<span>{money(o.subtotal)}</span>
          </p>
          <p>
            Vận chuyển<span>{money(o.shipping)}</span>
          </p>
          <p>
            Ưu đãi<span>−{money(o.discount)}</span>
          </p>
          <p className="total">
            Tổng cộng<span>{money(o.total)}</span>
          </p>
          {o.method === 'BANK' ? (
            o.test ? (
              <div className="notice">
                Chế độ thử nghiệm: không chuyển tiền thật. Hệ thống chưa bật QR thanh toán thực tế.
              </div>
            ) : data.qr ? (
              <>
                <img className="qr" src={data.qr} alt="QR thanh toán ngân hàng" />
                <p>{data.bankName}</p>
                <p>VietinBank · {data.bankAccount}</p>
                <p>Nội dung: {o.code}</p>
                <small>
                  Thanh toán trước {new Date(o.expiresAt).toLocaleTimeString('vi-VN')}. Trạng thái
                  tự cập nhật mỗi 5 giây.
                </small>
              </>
            ) : (
              <p>
                {o.paymentStatus === 'PAID'
                  ? 'Đã ghi nhận thanh toán.'
                  : 'Mã thanh toán không còn hiệu lực.'}
              </p>
            )
          ) : (
            <p>Thanh toán khi nhận hàng.</p>
          )}
        </aside>
      </div>
    </main>
  );
}
