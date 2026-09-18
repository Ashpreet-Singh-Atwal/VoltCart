import Countdown from './Countdown.jsx';
import { useSale } from '../context/SaleContext.jsx';

export default function SaleBanner() {
  const { sale, status, msToStart, msToEnd } = useSale();
  if (!sale) return null;

  if (status === 'SCHEDULED') {
    return (
      <section className="banner banner--waiting">
        <div>
          <p className="banner__eyebrow">Get ready</p>
          <h1 className="banner__title">{sale.title}</h1>
          <p className="banner__sub">{sale.tagline}</p>
        </div>
        <Countdown ms={msToStart} label="Sale starts in" />
      </section>
    );
  }

  if (status === 'LIVE') {
    return (
      <section className="banner banner--live">
        <div>
          <p className="banner__eyebrow banner__eyebrow--pulse">● SALE IS LIVE</p>
          <h1 className="banner__title">{sale.title}</h1>
          <p className="banner__sub">{sale.tagline}</p>
        </div>
        <Countdown ms={msToEnd} label="Ends in" />
      </section>
    );
  }

  return (
    <section className="banner banner--ended">
      <div>
        <p className="banner__eyebrow">That is a wrap</p>
        <h1 className="banner__title">{sale.title} has ended</h1>
        <p className="banner__sub">Everything is back to its regular price. Catch the next drop!</p>
      </div>
    </section>
  );
}
