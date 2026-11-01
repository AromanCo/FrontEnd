import Link from 'next/link';
import type { Product } from '@/lib/api/client';

const sceneFor = (slug: string) => [...slug].reduce((sum, letter) => sum + letter.charCodeAt(0), 0) % 3;

export function ProductCard({ product }: { product: Product }) {
  return <article className="product-editorial-card">
    <div className="product-concept-art" data-scene={sceneFor(product.slug)} role="img" aria-label="تصویرسازی مفهومی؛ تصویر محصول در دسترس نیست">
      <span className="product-art-halo" /><span className="product-art-orbit" /><span className="product-art-petal product-art-petal-one" /><span className="product-art-petal product-art-petal-two" />
      <span className="product-art-caption">AROMAN · CONCEPT</span>
      <span className="product-art-label">تصویر مفهومی</span>
    </div>
    <div className="product-editorial-copy">
      <p className="eyebrow">{product.is_demo ? 'محصول نمایشی' : 'محصول'}</p>
      <h3>{product.name}</h3>
      <p className="product-description">{product.description || 'شرح محصول هنوز ارائه نشده است.'}</p>
      <Link className="product-detail-link" href={`/shop/${product.id}`}>مشاهده جزئیات <span aria-hidden="true">←</span></Link>
    </div>
  </article>;
}
