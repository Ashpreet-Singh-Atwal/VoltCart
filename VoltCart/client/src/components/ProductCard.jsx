import { Link } from 'react-router-dom';
import { money } from '../api/client.js';
import { useCart } from '../context/CartContext.jsx';
import { useSale } from '../context/SaleContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import QuantityStepper from './QuantityStepper.jsx';

export default function ProductCard({ product }) {
  const { status, isLive, saleItem } = useSale();
  const { quantityOf, setItem, addItem } = useCart();
  const toast = useToast();

  const deal = saleItem(product._id);
  const onSale = Boolean(isLive && deal);
  const soldOut = onSale && deal.available <= 0;
  const quantity = quantityOf(product._id);
  const maxQty = onSale ? Math.min(deal.maxPerUser, Math.max(1, deal.available)) : 10;

  // Before the sale opens nothing can be added to the cart - the grid is a teaser.
  const buyingOpen = status !== 'SCHEDULED';

  const handleAdd = async () => {
    try {
      await addItem(product._id, 1);
      toast.success(`${product.name} added to cart`);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleChange = async (next) => {
    try { await setItem(product._id, next); } catch (err) { toast.error(err.message); }
  };

  return (
    <article className={`card ${soldOut ? 'card--sold-out' : ''}`}>
      <Link to={`/product/${product.slug}`} className="card__media">
        <img src={product.image} alt={product.name} loading="lazy" />
        {onSale && <span className="badge badge--deal">{deal.discountPercent}% OFF</span>}
        {soldOut && <span className="badge badge--sold">SOLD OUT</span>}
      </Link>

      <div className="card__body">
        <span className="card__brand">{product.brand}</span>
        <Link to={`/product/${product.slug}`} className="card__name">{product.name}</Link>

        <div className="card__price">
          <strong>{money(onSale ? deal.salePrice : product.price)}</strong>
          {onSale && <span className="card__mrp">{money(product.price)}</span>}
        </div>

        {onSale && (
          <div className="card__stock">
            <div className="stockbar">
              <div
                className="stockbar__fill"
                style={{ width: `${Math.round((deal.available / deal.totalQuantity) * 100)}%` }}
              />
            </div>
            <span>{deal.available} of {deal.totalQuantity} left · max {deal.maxPerUser}/customer</span>
          </div>
        )}

        {!buyingOpen && <p className="card__teaser">Goes on sale when the timer hits zero</p>}

        {buyingOpen && (
          quantity > 0 ? (
            <QuantityStepper value={quantity} min={0} max={maxQty} onChange={handleChange} disabled={soldOut} />
          ) : (
            <button type="button" className="btn btn--primary" onClick={handleAdd} disabled={soldOut}>
              {soldOut ? 'Sold out' : 'Add to cart'}
            </button>
          )
        )}
      </div>
    </article>
  );
}
