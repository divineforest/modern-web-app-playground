import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import './index.css';
import { AuthProvider } from './contexts/auth-context';
import { CartProvider } from './contexts/cart-context';
import { router } from './router';
import { theme } from './theme';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

createRoot(rootElement).render(
  <StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <CartProvider>
        <AuthProvider>
          <RouterProvider router={router} />
        </AuthProvider>
      </CartProvider>
    </ThemeProvider>
  </StrictMode>
);
