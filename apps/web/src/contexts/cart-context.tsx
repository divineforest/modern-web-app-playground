import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '../lib/api-client';

interface CartContextValue {
  itemCount: number;
  refreshCart: () => void;
  updateItemCount: (count: number) => void;
  clearCart: () => void;
}

const CartContext = createContext<CartContextValue>({
  itemCount: 0,
  refreshCart: () => {},
  updateItemCount: () => {},
  clearCart: () => {},
});

export function CartProvider({ children }: { children: ReactNode }) {
  const [itemCount, setItemCount] = useState(0);

  const fetchCartCount = useCallback(async () => {
    try {
      const response = await api.cart.getCart();

      if (response.status === 200) {
        setItemCount(response.body.itemCount);
      }
    } catch {
      // silently ignore network errors for badge
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchCartCount();
  }, [fetchCartCount]);

  const refreshCart = useCallback(() => {
    void fetchCartCount();
  }, [fetchCartCount]);

  const updateItemCount = useCallback((count: number) => {
    setItemCount(count);
  }, []);

  const clearCart = useCallback(() => {
    setItemCount(0);
  }, []);

  return (
    <CartContext.Provider value={{ itemCount, refreshCart, updateItemCount, clearCart }}>
      {children}
    </CartContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useCart(): CartContextValue {
  return useContext(CartContext);
}
