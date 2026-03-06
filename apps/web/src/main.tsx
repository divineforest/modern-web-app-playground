import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import './index.css';
import { AuthProvider } from './contexts/auth-context';
import { CartProvider } from './contexts/cart-context';
import { tsr } from './lib/api-client';
import { router } from './router';
import { theme } from './theme';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

createRoot(rootElement).render(
  <StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <QueryClientProvider client={queryClient}>
        <tsr.ReactQueryProvider>
          <AuthProvider>
            <CartProvider>
              <RouterProvider router={router} />
            </CartProvider>
          </AuthProvider>
        </tsr.ReactQueryProvider>
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>
);
