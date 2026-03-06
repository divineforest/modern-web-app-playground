import { useQueryClient } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { createContext, useCallback, useContext } from 'react';
import { tsr } from '../lib/api-client';

interface CartContextValue {
  itemCount: number;
  invalidateCart: () => void;
}

const CartContext = createContext<CartContextValue>({
  itemCount: 0,
  invalidateCart: () => {},
});

export function CartProvider({ children }: { children: ReactNode }) {
  const { data } = tsr.cart.getCart.useQuery({
    queryKey: ['cart'],
  });
  const queryClient = useQueryClient();

  const itemCount = data?.status === 200 ? data.body.itemCount : 0;

  const invalidateCart = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['cart'] });
  }, [queryClient]);

  return (
    <CartContext.Provider value={{ itemCount, invalidateCart }}>{children}</CartContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useCart(): CartContextValue {
  return useContext(CartContext);
}
