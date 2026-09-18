import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api/client.js';

const SaleContext = createContext(null);
const POLL_MS = 4000;

/**
 * Holds the flash-sale window and live stock counters.
 * All countdowns are driven by the *server* clock (we keep the offset between
 * server and browser time) so every customer sees the same timer.
 */
export function SaleProvider({ children }) {
  const [sale, setSale] = useState(null);
  const [now, setNow] = useState(Date.now());
  const offsetRef = useRef(0);

  const refresh = useCallback(async () => {
    try {
      const { sale: data, serverTime } = await api.get('/sale');
      offsetRef.current = new Date(serverTime).getTime() - Date.now();
      setSale(data);
      return data;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    refresh();
    const poll = setInterval(refresh, POLL_MS);
    const tick = setInterval(() => setNow(Date.now()), 250);
    return () => { clearInterval(poll); clearInterval(tick); };
  }, [refresh]);

  const value = useMemo(() => {
    const serverNow = now + offsetRef.current;
    const startAt = sale ? new Date(sale.startAt).getTime() : 0;
    const endAt = sale ? new Date(sale.endAt).getTime() : 0;

    let status = sale?.status ?? 'NONE';
    if (sale) {
      if (serverNow < startAt) status = 'SCHEDULED';
      else if (serverNow >= endAt) status = 'ENDED';
      else status = 'LIVE';
    }

    const itemsById = new Map((sale?.items ?? []).map((i) => [i.productId, i]));

    return {
      sale,
      status,
      isLive: status === 'LIVE',
      msToStart: Math.max(0, startAt - serverNow),
      msToEnd: Math.max(0, endAt - serverNow),
      saleItem: (productId) => itemsById.get(productId) ?? null,
      itemsById,
      refresh,
    };
  }, [sale, now, refresh]);

  return <SaleContext.Provider value={value}>{children}</SaleContext.Provider>;
}

export const useSale = () => useContext(SaleContext);
