import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, money } from '../api/client.js';
import QuantityStepper from '../components/QuantityStepper.jsx';
import Countdown from '../components/Countdown.jsx';
import { useCart } from '../context/CartContext.jsx';
import { useSale } from '../context/SaleContext.jsx';
import { useToast } from '../context/ToastContext.jsx';

export default function ProductPage() {
  const { slug } = useParams();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const { status, isLive, saleItem, msToEnd } = useSale();
  const { quantityOf, setItem, addItem } = useCart();
  const toast = useToast();

  useEffect(() => {
    setLoading(true);
    api.get(`/products/${slug}`)
      .then(({ product: p }) => setProduct(p))
      .catch(() => setProduct(null))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) return <div className="page page--center"><div className="spinner" /></div>;
  if (!product) return <div className="page page--center"><p>Product not found. <Link to="/">Go home</Link></p></div>;

  const deal = saleItem(product._id);
  const onSale = Boolean(isLive && deal);
  const soldOut = onSale && deal.available <= 0;
  const quantity = quantityOf(product._id);
  const maxQty = onSale ? Math.min(deal.maxPerUser, Math.max(1, deal.available)) : 10;
  const buyingOpen = status !== 'SCHEDULED';

  return (
    <div className="page">
      <div className="pdp">
        <div className="pdp__media">
          <img src={product.image} alt={product.name} />
        </div>

        <div className="pdp__info">
          <span className="pdp__brand">{product.brand}</span>
          <h1>{product.name}</h1>

          {onSale && (
            <div className="pdp__deal">
              <span className="badge badge--deal">{deal.discountPercent}% OFF</span>
              <Countdown ms={msToEnd} label="Deal ends in" />
            </div>
          )}

          <div className="pdp__price">
            <strong>{money(onSale ? deal.salePrice : product.price)}</strong>
            {onSale && (
              <>
                <span className="pdp__mrp">{money(product.price)}</span>
                <span className="pdp__save">You save {money(product.price - deal.salePrice)}</span>
              </>
            )}
          </div>

          {onSale && (
            <p className="pdp__stock">
              {soldOut ? 'Sold out in this sale' : `Only ${deal.available} units left · max ${deal.maxPerUser} per customer`}
            </p>
          )}

          <ul className="pdp__highlights">
            {product.highlights.map((h) => <li key={h}>{h}</li>)}
          </ul>

          {!buyingOpen ? (
            <p className="pdp__teaser">Add to cart unlocks when the flash sale goes live.</p>
          ) : (
            <div className="pdp__actions">
              {quantity > 0 ? (
                <QuantityStepper value={quantity} min={0} max={maxQty} disabled={soldOut}
                  onChange={(q) => setItem(product._id, q).catch((e) => toast.error(e.message))} />
              ) : (
                <button type="button" className="btn btn--primary btn--lg" disabled={soldOut}
                  onClick={() => addItem(product._id, 1).then(() => toast.success('Added to cart')).catch((e) => toast.error(e.message))}>
                  {soldOut ? 'Sold out' : 'Add to cart'}
                </button>
              )}
              <Link to="/cart" className="btn btn--ghost btn--lg">Go to cart</Link>
            </div>
          )}
        </div>
      </div>

      <section className="pdp__description">
        <h2>Product description</h2>
        <p>{product.description}</p>
      </section>
    </div>
  );
}
