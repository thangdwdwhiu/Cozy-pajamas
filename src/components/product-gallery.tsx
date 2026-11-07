'use client';
import { useState } from 'react';
export default function ProductGallery({ name, images }: { name: string; images: string[] }) {
  const [selected, setSelected] = useState(0);
  return (
    <div className="product-gallery">
      <div className="detail-image">
        <img src={images[selected] ?? images[0]} alt={`${name} – ảnh ${selected + 1}`} />
        <small>
          {images[0]?.endsWith('.svg')
            ? 'Hình minh họa thiết kế • Ảnh thực tế sẽ được cửa hàng cập nhật'
            : 'Ảnh sản phẩm từ Cozy pajamas'}
        </small>
      </div>
      {images.length > 1 && (
        <div className="gallery-thumbnails">
          {images.map((image, i) => (
            <button
              key={image}
              className={selected === i ? 'selected' : ''}
              aria-label={'Xem ảnh ' + (i + 1)}
              aria-pressed={selected === i}
              onClick={() => setSelected(i)}
            >
              <img src={image} alt={`${name} – góc chụp ${i + 1}`} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
