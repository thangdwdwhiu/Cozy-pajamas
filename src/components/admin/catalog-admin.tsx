'use client';
import { useRef, useState, FormEvent } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  FolderOpen,
  ImagePlus,
  LoaderCircle,
  Package,
  Plus,
  Search,
  Star,
  Trash2,
  UploadCloud,
  Save,
  Pencil,
} from 'lucide-react';
import { api, money } from '../store';
type Row = Record<string, any>;
type Props = {
  tab: string;
  data: Record<string, Row[]>;
  reload: () => Promise<void>;
  navigate: (tab: string) => void;
  onError: (message: string) => void;
};
export default function CatalogAdmin({ tab, data, reload, navigate, onError }: Props) {
  const [editing, setEditing] = useState<Row | null>(null),
    [query, setQuery] = useState(''),
    [category, setCategory] = useState('all'),
    [status, setStatus] = useState('all'),
    [page, setPage] = useState(0),
    [notice, setNotice] = useState('');
  const isProduct = tab === 'products' || tab === 'new-product';
  const form = tab === 'new-product' || tab === 'new-category' || editing;
  if (form)
    return isProduct ? (
      <ProductEditor
        key={editing?.id ?? 'new'}
        product={editing}
        categories={data.categories}
        onError={onError}
        onCancel={() => (editing ? setEditing(null) : navigate('products'))}
        onSaved={async () => {
          await reload();
          if (editing) {
            setEditing(null);
            setNotice('Đã cập nhật sản phẩm');
          } else navigate('products');
        }}
      />
    ) : (
      <CategoryEditor
        category={editing}
        onError={onError}
        onCancel={() => (editing ? setEditing(null) : navigate('categories'))}
        onSaved={async () => {
          await reload();
          if (editing) {
            setEditing(null);
            setNotice('Đã cập nhật danh mục');
          } else navigate('categories');
        }}
      />
    );
  const items = (isProduct ? data.products : data.categories).filter(
    (p) =>
      p.name.toLocaleLowerCase('vi').includes(query.toLocaleLowerCase('vi')) &&
      (!isProduct ||
        ((category === 'all' || p.categoryId === category) &&
          (status === 'all' || p.active === (status === 'active')))),
  );
  const visible = items.slice(page * 10, page * 10 + 10);
  return (
    <>
      <div className="catalog-summary">
        <div>
          <span className="catalog-summary-icon">
            {isProduct ? <Package size={22} /> : <FolderOpen size={22} />}
          </span>
          <div>
            <strong>
              {isProduct ? data.products.length : data.categories.length}{' '}
              {isProduct ? 'sản phẩm' : 'danh mục'}
            </strong>
            <p>
              {isProduct
                ? 'Chăm chút từng sản phẩm trong cửa hàng.'
                : 'Sắp xếp sản phẩm để khách hàng dễ khám phá.'}
            </p>
          </div>
        </div>
        <button
          className="button"
          onClick={() => navigate(isProduct ? 'new-product' : 'new-category')}
        >
          <Plus size={17} />
          {isProduct ? 'Thêm sản phẩm' : 'Thêm danh mục'}
        </button>
      </div>
      {notice && (
        <div className="notice success">
          <Check size={16} />
          {notice}
        </div>
      )}
      <div className="catalog-toolbar">
        <label className="search">
          <Search size={18} />
          <input
            aria-label={isProduct ? 'Tìm sản phẩm quản trị' : 'Tìm danh mục'}
            placeholder={isProduct ? 'Tìm theo tên sản phẩm…' : 'Tìm theo tên danh mục…'}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(0);
            }}
          />
        </label>
        {isProduct && (
          <>
            <select
              aria-label="Lọc danh mục"
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setPage(0);
              }}
            >
              <option value="all">Tất cả danh mục</option>
              {data.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select
              aria-label="Lọc trạng thái"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(0);
              }}
            >
              <option value="all">Mọi trạng thái</option>
              <option value="active">Đang hiển thị</option>
              <option value="hidden">Đang ẩn</option>
            </select>
          </>
        )}
      </div>
      {isProduct ? (
        <div className="table-scroll catalog-table">
          <table>
            <thead>
              <tr>
                <th>Sản phẩm</th>
                <th>Danh mục</th>
                <th>Giá bán</th>
                <th>Tồn kho</th>
                <th>Hiển thị</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visible.map((p) => {
                const variants = data.variants.filter((v) => v.productId === p.id);
                return (
                  <tr key={p.id}>
                    <td>
                      <div className="table-product">
                        <img src={p.image} alt={p.name} />
                        <div>
                          <strong>{p.name}</strong>
                          <small>
                            {p.material} · {p.images?.length || 1} ảnh
                          </small>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="category-pill">
                        {data.categories.find((c) => c.id === p.categoryId)?.name ??
                          'Chưa phân loại'}
                      </span>
                    </td>
                    <td>
                      {variants.length
                        ? money(Math.min(...variants.map((v) => v.price)))
                        : 'Chưa có giá'}
                    </td>
                    <td>
                      {variants.reduce((sum, v) => sum + v.stock, 0)}
                      <small>{variants.length} phân loại</small>
                    </td>
                    <td>
                      <span className={'status-dot ' + (p.active ? 'enabled' : 'disabled')}>
                        {p.active ? 'Đang hiển thị' : 'Đang ẩn'}
                      </span>
                    </td>
                    <td>
                      <button
                        aria-label={'Chỉnh sửa ' + p.name}
                        className="icon-button edit-product"
                        onClick={() => setEditing(p)}
                      >
                        <Pencil size={17} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="admin-category-grid">
          {visible.map((c, i) => {
            const products = data.products.filter((p) => p.categoryId === c.id);
            return (
              <article className="admin-category-card" key={c.id}>
                <div className={'category-card-art tone-' + (i % 3)}>
                  {products[0] ? <img src={products[0].image} alt="" /> : <FolderOpen size={44} />}
                  <span>{products.length} sản phẩm</span>
                </div>
                <div className="category-card-copy">
                  <h3>{c.name}</h3>
                  <p>{products.filter((p) => p.active).length} sản phẩm đang hiển thị</p>
                  <button onClick={() => setEditing(c)}>
                    Chỉnh sửa danh mục <ArrowRight size={15} />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
      {!items.length && (
        <div className="empty panel">
          <Package size={34} />
          <h3>Chưa có {isProduct ? 'sản phẩm' : 'danh mục'} phù hợp</h3>
          <p>Thử tìm kiếm khác hoặc thêm mới để bắt đầu.</p>
        </div>
      )}
      <div className="list-pagination">
        <span>
          {items.length} kết quả · Trang {page + 1}/{Math.max(1, Math.ceil(items.length / 10))}
        </span>
        <div>
          <button aria-label="Trang trước" disabled={!page} onClick={() => setPage(page - 1)}>
            <ChevronLeft size={17} />
          </button>
          <button
            aria-label="Trang sau"
            disabled={(page + 1) * 10 >= items.length}
            onClick={() => setPage(page + 1)}
          >
            <ChevronRight size={17} />
          </button>
        </div>
      </div>
    </>
  );
}
function ProductEditor({
  product,
  categories,
  onError,
  onCancel,
  onSaved,
}: {
  product: Row | null;
  categories: Row[];
  onError: (s: string) => void;
  onCancel: () => void;
  onSaved: () => Promise<void>;
}) {
  const [name, setName] = useState(product?.name ?? ''),
    [description, setDescription] = useState(product?.description ?? ''),
    [material, setMaterial] = useState(product?.material ?? ''),
    [categoryId, setCategoryId] = useState(product?.categoryId ?? ''),
    [images, setImages] = useState<string[]>(
      product?.images?.length ? product.images : product?.image ? [product.image] : [],
    ),
    [active, setActive] = useState(product?.active ?? true),
    [featured, setFeatured] = useState(product?.featured ?? false),
    [saving, setSaving] = useState(false),
    [uploading, setUploading] = useState(false),
    [progress, setProgress] = useState(''),
    [uploadError, setUploadError] = useState(''),
    [price, setPrice] = useState(''),
    [color, setColor] = useState(''),
    [stock, setStock] = useState('0'),
    [sizes, setSizes] = useState(['S', 'M', 'L']);
  const inputRef = useRef<HTMLInputElement>(null);
  const locked = saving || uploading;
  async function upload(files: File[]) {
    if (uploading || saving) return;
    setUploadError('');
    const selected = files.slice(0, 10 - images.length);
    if (!selected.length) {
      setUploadError('Tối đa 10 ảnh cho một sản phẩm.');
      return;
    }
    setUploading(true);
    const failures: string[] = [];
    try {
      for (const [i, file] of selected.entries()) {
        setProgress(`Đang tải ảnh ${i + 1}/${selected.length}…`);
        if (
          file.size > 3 * 1024 * 1024 ||
          !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)
        ) {
          failures.push(`${file.name}: chọn JPG, PNG, WebP tối đa 3 MB.`);
          continue;
        }
        try {
          const form = new FormData();
          form.set('file', file);
          const response = await fetch('/api/admin/upload', { method: 'POST', body: form });
          const result = await response.json();
          if (!response.ok) throw Error(result.error ?? 'Không tải được ảnh');
          setImages((previous) => [...previous, result.url]);
        } catch (e) {
          failures.push(`${file.name}: ${(e as Error).message}`);
        }
      }
      if (files.length > selected.length) failures.push('Chỉ giữ tối đa 10 ảnh.');
      setUploadError(failures.join(' '));
    } finally {
      setUploading(false);
      setProgress('');
      if (inputRef.current) inputRef.current.value = '';
    }
  }
  function move(index: number, delta: number) {
    setImages((previous) => {
      const next = [...previous];
      [next[index], next[index + delta]] = [next[index + delta], next[index]];
      return next;
    });
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!images.length) {
      setUploadError('Vui lòng tải ít nhất một ảnh sản phẩm.');
      return;
    }
    if (!product && !sizes.length) {
      onError('Chọn ít nhất một kích thước.');
      return;
    }
    setSaving(true);
    try {
      await api('admin/product', {
        id: product?.id,
        name,
        description,
        material,
        categoryId,
        images,
        active,
        featured,
        ...(!product
          ? {
              initialVariants: sizes.map((size) => ({
                color,
                size,
                price: Number(price),
                stock: Number(stock),
              })),
            }
          : {}),
      });
      await onSaved();
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  return (
    <form className="product-editor" onSubmit={submit}>
      <div className="editor-top">
        <button type="button" className="back-link" onClick={onCancel} disabled={locked}>
          <ArrowLeft size={17} />
          Danh sách sản phẩm
        </button>
        <div>
          <button type="button" onClick={onCancel} disabled={locked}>
            Hủy
          </button>
          <button className="button" disabled={locked}>
            <Save size={17} />
            {saving ? 'Đang lưu…' : product ? 'Lưu thay đổi' : 'Tạo sản phẩm'}
          </button>
        </div>
      </div>
      <div className="editor-grid">
        <div>
          <section className="editor-card">
            <div className="editor-card-title">
              <span>01</span>
              <div>
                <h2>Thông tin sản phẩm</h2>
                <p>Những thông tin giúp khách hàng hiểu và yêu sản phẩm.</p>
              </div>
            </div>
            <label className="field">
              Tên sản phẩm{' '}
              <input
                name="name"
                required
                minLength={3}
                maxLength={150}
                placeholder="Ví dụ: Pijama lụa Rose hồng phấn"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label className="field">
              Chất liệu
              <input
                name="material"
                required
                minLength={2}
                maxLength={100}
                placeholder="Ví dụ: Lụa satin mềm mại"
                value={material}
                onChange={(e) => setMaterial(e.target.value)}
              />
            </label>
            <label className="field">
              Mô tả sản phẩm
              <textarea
                name="description"
                required
                minLength={10}
                maxLength={4000}
                placeholder="Mô tả kiểu dáng, chất liệu, cảm giác khi mặc và hướng dẫn bảo quản…"
                rows={6}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </label>
          </section>
          <section className="editor-card">
            <div className="editor-card-title">
              <span>02</span>
              <div>
                <h2>Hình ảnh sản phẩm</h2>
                <p>Ảnh đầu tiên là ảnh bìa. Thêm những góc chụp để khách dễ lựa chọn.</p>
              </div>
              <small>{images.length}/10 ảnh</small>
            </div>
            <div
              className={'upload-zone ' + (uploading ? 'uploading' : '')}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                void upload([...e.dataTransfer.files]);
              }}
            >
              <input
                ref={inputRef}
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp"
                aria-label="Tải nhiều ảnh sản phẩm"
                onChange={(e) => void upload(Array.from(e.target.files ?? []))}
                disabled={locked || images.length >= 10}
              />
              <UploadCloud size={32} />
              <strong>{uploading ? progress : 'Kéo ảnh vào đây hoặc chọn từ máy'}</strong>
              <p>Chọn nhiều ảnh cùng lúc · JPG, PNG, WebP · Tối đa 3 MB/ảnh</p>
              <button
                type="button"
                disabled={locked || images.length >= 10}
                onClick={() => inputRef.current?.click()}
              >
                {uploading ? <LoaderCircle className="spin" size={16} /> : <Plus size={16} />}Chọn
                ảnh
              </button>
            </div>
            {uploadError && (
              <p className="notice error" role="alert">
                {uploadError}
              </p>
            )}
            <div className="image-manager">
              {images.map((url, i) => (
                <div className="managed-image" key={url}>
                  <img src={url} alt={'Ảnh sản phẩm ' + (i + 1)} />
                  {i === 0 && (
                    <span className="cover-label">
                      <Star size={11} />
                      Ảnh bìa
                    </span>
                  )}
                  <div className="image-actions">
                    <button
                      type="button"
                      aria-label={'Di chuyển ảnh ' + (i + 1) + ' sang trái'}
                      disabled={locked || i === 0}
                      onClick={() => move(i, -1)}
                    >
                      <ChevronLeft size={15} />
                    </button>
                    <button
                      type="button"
                      aria-label={'Đặt ảnh ' + (i + 1) + ' làm ảnh bìa'}
                      disabled={locked || i === 0}
                      onClick={() => setImages([url, ...images.filter((x) => x !== url)])}
                    >
                      <Star size={14} />
                    </button>
                    <button
                      type="button"
                      aria-label={'Di chuyển ảnh ' + (i + 1) + ' sang phải'}
                      disabled={locked || i === images.length - 1}
                      onClick={() => move(i, 1)}
                    >
                      <ChevronRight size={15} />
                    </button>
                    <button
                      type="button"
                      aria-label={'Bỏ ảnh ' + (i + 1)}
                      disabled={locked}
                      onClick={() => setImages(images.filter((x) => x !== url))}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
          {!product ? (
            <section className="editor-card">
              <div className="editor-card-title">
                <span>03</span>
                <div>
                  <h2>Giá bán & phân loại</h2>
                  <p>
                    Thiết lập các kích thước đầu tiên. Bạn có thể bổ sung màu khác trong Kho hàng.
                  </p>
                </div>
              </div>
              <div className="editor-two-columns">
                <label className="field">
                  Giá bán (₫)
                  <input
                    type="number"
                    name="price"
                    min={1000}
                    max={100000000}
                    required
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="389000"
                  />
                </label>
                <label className="field">
                  Màu sắc
                  <input
                    name="color"
                    required
                    maxLength={50}
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    placeholder="Hồng phấn"
                  />
                </label>
              </div>
              <span className="field-label">Kích thước</span>
              <div className="size-pills">
                {['XS', 'S', 'M', 'L', 'XL', 'XXL', 'Freesize'].map((size) => (
                  <button
                    type="button"
                    className={sizes.includes(size) ? 'selected' : ''}
                    aria-pressed={sizes.includes(size)}
                    key={size}
                    onClick={() =>
                      setSizes(
                        sizes.includes(size) ? sizes.filter((x) => x !== size) : [...sizes, size],
                      )
                    }
                  >
                    {size}
                    {sizes.includes(size) && <Check size={12} />}
                  </button>
                ))}
              </div>
              <label className="field">
                Tồn kho ban đầu cho mỗi kích thước
                <input
                  name="stock"
                  type="number"
                  min={0}
                  max={100000}
                  required
                  value={stock}
                  onChange={(e) => setStock(e.target.value)}
                />
              </label>
            </section>
          ) : (
            <div className="editor-info">
              <Package size={20} />
              <span>
                Giá, màu, kích thước và tồn kho được quản lý riêng trong tab{' '}
                <strong>Kho hàng</strong>.
              </span>
            </div>
          )}
        </div>
        <aside className="editor-aside">
          <section className="editor-card">
            <h2>Phân loại sản phẩm</h2>
            <label className="field">
              Danh mục sản phẩm
              <select
                aria-label="Danh mục sản phẩm"
                name="categoryId"
                required
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
              >
                <option value="" disabled>
                  Chọn danh mục
                </option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <small>Danh mục giúp sản phẩm xuất hiện đúng nơi khách hàng tìm kiếm.</small>
            {!categories.length && (
              <p className="notice">
                Tạo danh mục trong tab Thêm danh mục trước khi thêm sản phẩm.
              </p>
            )}
          </section>
          <section className="editor-card">
            <h2>Hiển thị</h2>
            <label className="setting-toggle">
              <span>
                <strong>Hiển thị tại cửa hàng</strong>
                <small>Tắt để lưu sản phẩm ở dạng ẩn</small>
              </span>
              <input
                type="checkbox"
                name="active"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
              />
            </label>
            <label className="setting-toggle">
              <span>
                <strong>Sản phẩm nổi bật</strong>
                <small>Đánh dấu để giới thiệu trên trang chủ</small>
              </span>
              <input
                type="checkbox"
                name="featured"
                checked={featured}
                onChange={(e) => setFeatured(e.target.checked)}
              />
            </label>
          </section>
          <section className="editor-card product-preview">
            <span className="eyebrow">XEM TRƯỚC</span>
            {images[0] ? (
              <img src={images[0]} alt="Xem trước ảnh bìa" />
            ) : (
              <div className="preview-placeholder">
                <ImagePlus size={36} />
                <span>Ảnh bìa của bạn</span>
              </div>
            )}
            <small>{material || 'Chất liệu sản phẩm'}</small>
            <h3>{name || 'Tên sản phẩm'}</h3>
            <p>{categories.find((c) => c.id === categoryId)?.name ?? 'Chưa chọn danh mục'}</p>
            {price && <strong>{money(Number(price))}</strong>}
          </section>
        </aside>
      </div>
    </form>
  );
}
function CategoryEditor({
  category,
  onError,
  onCancel,
  onSaved,
}: {
  category: Row | null;
  onError: (s: string) => void;
  onCancel: () => void;
  onSaved: () => Promise<void>;
}) {
  const [name, setName] = useState(category?.name ?? ''),
    [busy, setBusy] = useState(false);
  return (
    <form
      className="category-editor"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await api('admin/category', { id: category?.id, name });
          await onSaved();
        } catch (error) {
          onError((error as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <button type="button" className="back-link" onClick={onCancel} disabled={busy}>
        <ArrowLeft size={17} />
        Danh sách danh mục
      </button>
      <div className="editor-card">
        <span className="category-editor-icon">
          <FolderOpen size={28} />
        </span>
        <h2>{category ? 'Chỉnh sửa danh mục' : 'Một góc mới cho cửa hàng'}</h2>
        <p>Nhóm những sản phẩm tương tự để khách hàng tìm thấy điều họ yêu.</p>
        <label className="field">
          Tên danh mục
          <input
            name="name"
            required
            minLength={2}
            maxLength={100}
            placeholder="Ví dụ: Pijama lụa, Váy ngủ, Đồ mặc nhà…"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <div className="editor-form-actions">
          <button type="button" disabled={busy} onClick={onCancel}>
            Hủy
          </button>
          <button className="button" disabled={busy}>
            <Save size={17} />
            {busy ? 'Đang lưu…' : category ? 'Lưu danh mục' : 'Tạo danh mục'}
          </button>
        </div>
      </div>
    </form>
  );
}
