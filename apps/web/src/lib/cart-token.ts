export const CART_TOKEN_KEY = 'cartToken';

export function getCartToken(): string | null {
  return localStorage.getItem(CART_TOKEN_KEY);
}

export function setCartToken(token: string): void {
  localStorage.setItem(CART_TOKEN_KEY, token);
}

export function removeCartToken(): void {
  localStorage.removeItem(CART_TOKEN_KEY);
}

export function getCartHeaders(): Record<string, string> {
  const cartToken = getCartToken();
  return cartToken ? { 'x-cart-token': cartToken } : {};
}
