import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../api/client.js';
import { useAuth } from './AuthContext.jsx';

const CartContext = createContext(null);
const GUEST_KEY = 'voltcart_guest_cart';

export const readGuestCart = () => {
  try { return JSON.parse(localStorage.getItem(GUEST_KEY) ?? '[]'); } catch { return []; }
};
const writeGuestCart = (items) => localStorage.setItem(GUEST_KEY, JSON.stringify(items));
export const clearGuestCart = () => localStorage.removeItem(GUEST_KEY);

/**
 * One cart API for two storages: guests keep their cart in localStorage and ask
 * the server only to price it, logged-in customers use the Mongo cart.
 */
export function CartProvider({ children }) {
  const { isAuthed, loading: authLoading } = useAuth();
  const [cart, setCart] = useState({ lines: [], pricing: { subtotal: 0, discount: 0, deliveryFee: 0, total: 0 } });
  const [loading, setLoading] = useState(false);

  const priceGuestCart = useCallback(async (items) => {
    const { cart: priced } = await api.post('/cart/price', { items });
    setCart(priced);
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      if (isAuthed) {
        const { cart: serverCart } = await api.get('/cart');
        setCart(serverCart);
      } else {
        await priceGuestCart(readGuestCart());
      }
    } catch {
      setCart({ lines: [], pricing: { subtotal: 0, discount: 0, deliveryFee: 0, total: 0 } });
    } finally {
      setLoading(false);
    }
  }, [isAuthed, priceGuestCart]);

  useEffect(() => { if (!authLoading) refresh(); }, [authLoading, refresh]);

  const setItem = useCallback(async (productId, quantity) => {
    const qty = Math.max(0, Math.min(10, quantity));
    if (isAuthed) {
      const { cart: serverCart } = await api.put('/cart/items', { productId, quantity: qty });
      setCart(serverCart);
      return;
    }
    const items = readGuestCart().filter((i) => i.productId !== productId);
    if (qty > 0) items.push({ productId, quantity: qty });
    writeGuestCart(items);
    await priceGuestCart(items);
  }, [isAuthed, priceGuestCart]);

  const addItem = useCallback(async (productId, quantity = 1) => {
    const current = cart.lines.find((l) => l.productId === productId)?.quantity ?? 0;
    await setItem(productId, current + quantity);
  }, [cart.lines, setItem]);

  const removeItem = useCallback((productId) => setItem(productId, 0), [setItem]);

  const clear = useCallback(async () => {
    if (isAuthed) {
      const { cart: serverCart } = await api.del('/cart');
      setCart(serverCart);
    } else {
      clearGuestCart();
      await priceGuestCart([]);
    }
  }, [isAuthed, priceGuestCart]);

  const value = useMemo(() => ({
    ...cart,
    loading,
    count: cart.lines.reduce((sum, l) => sum + l.quantity, 0),
    quantityOf: (productId) => cart.lines.find((l) => l.productId === productId)?.quantity ?? 0,
    setItem,
    addItem,
    removeItem,
    clear,
    refresh,
  }), [cart, loading, setItem, addItem, removeItem, clear, refresh]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export const useCart = () => useContext(CartContext);
