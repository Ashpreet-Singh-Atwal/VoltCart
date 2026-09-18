import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client.js';
import ProductCard from '../components/ProductCard.jsx';
import SaleBanner from '../components/SaleBanner.jsx';
import { useSale } from '../context/SaleContext.jsx';
import { useCart } from '../context/CartContext.jsx';

export default function HomePage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const { status, isLive, saleItem } = useSale();
  const { refresh: refreshCart } = useCart();
  const previousStatus = useRef(status);

  useEffect(() => {
    api.get('/products')
      .then(({ products: list }) => setProducts(list))
      .finally(() => setLoading(false));
  }, []);

  // The moment the countdown flips to LIVE, prices change - re-price the cart.
  useEffect(() => {
    if (previousStatus.current !== status) {
      previousStatus.current = status;
      refreshCart();
    }
  }, [status, refreshCart]);

  const dealProducts = products.filter((p) => saleItem(p._id));
  const restProducts = products.filter((p) => !saleItem(p._id));

  if (loading) return <div className="page page--center"><div className="spinner" /></div>;

  return (
    <div className="page">
      <SaleBanner />

      {dealProducts.length > 0 && (
        <section className="section">
          <div className="section__head">
            <h2>{isLive ? 'Live flash deals' : 'Deals dropping soon'}</h2>
            <p>{isLive ? 'Limited units. First come, first served.' : 'These prices unlock when the timer ends.'}</p>
          </div>
          <div className="grid">
            {dealProducts.map((p) => <ProductCard key={p._id} product={p} />)}
          </div>
        </section>
      )}

      <section className="section">
        <div className="section__head">
          <h2>More from VoltCart</h2>
          <p>Everyday essentials at everyday prices.</p>
        </div>
        <div className="grid">
          {restProducts.map((p) => <ProductCard key={p._id} product={p} />)}
        </div>
      </section>
    </div>
  );
}
