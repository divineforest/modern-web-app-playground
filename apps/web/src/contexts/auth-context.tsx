import type { UserProfile } from '@mercado/api-contracts';
import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '../lib/api-client';
import { useCart } from './cart-context';

interface AuthContextValue {
  user: UserProfile | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (firstName: string, lastName: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  login: async () => {},
  register: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const { invalidateCart } = useCart();

  const checkAuth = useCallback(async () => {
    try {
      const response = await api.auth.me();

      if (response.status === 200) {
        setUser(response.body);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void checkAuth();
  }, [checkAuth]);

  const login = useCallback(
    async (email: string, password: string) => {
      const response = await api.auth.login({
        body: { email, password },
      });

      if (response.status === 200) {
        setUser(response.body);
        invalidateCart();
      } else {
        throw new Error('Invalid email or password');
      }
    },
    [invalidateCart]
  );

  const register = useCallback(
    async (firstName: string, lastName: string, email: string, password: string) => {
      const response = await api.auth.register({
        body: { firstName, lastName, email, password },
      });

      if (response.status === 201) {
        setUser(response.body);
        invalidateCart();
      } else if (response.status === 409) {
        throw new Error(response.body.error);
      } else {
        throw new Error('Registration failed');
      }
    },
    [invalidateCart]
  );

  const logout = useCallback(async () => {
    await api.auth.logout({ body: {} });
    setUser(null);
    invalidateCart();
  }, [invalidateCart]);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
