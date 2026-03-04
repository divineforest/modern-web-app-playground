import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { getCartHeaders, getCartToken } from '../lib/cart-token';

interface CartContextValue {
  itemCount: number;
  refreshCart: () => void;
  updateItemCount: (count: number) => void;
}

const CartContext = createContext<CartContextValue>({
  itemCount: 0,
  refreshCart: () => {},
  updateItemCount: () => {},
});

export function CartProvider({ children }: { children: ReactNode }) {
  const [itemCount, setItemCount] = useState(0);

  const fetchCartCount = useCallback(async () => {
    if (!getCartToken()) return;
    try {
      const response = await fetch('/api/cart', { headers: getCartHeaders() });
      if (!response.ok) {
        throw new Error('Failed to fetch cart');
      }
      const data = await response.json();
      setItemCount((data.itemCount as number | undefined) ?? 0);
    } catch {
      // silently ignore network errors for badge
    }
  }, []);

  useEffect(() => {
    void fetchCartCount();
  }, [fetchCartCount]);

  const refreshCart = useCallback(() => {
    void fetchCartCount();
  }, [fetchCartCount]);

  const updateItemCount = useCallback((count: number) => {
    setItemCount(count);
  }, []);

  return (
    <CartContext.Provider value={{ itemCount, refreshCart, updateItemCount }}>
      {children}
    </CartContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useCart(): CartContextValue {
  return useContext(CartContext);
}
