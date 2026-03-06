import { createBrowserRouter } from 'react-router-dom';
import { RequireAuth } from './components/require-auth';
import { RootLayout } from './layouts/root-layout';
import { CartPage } from './pages/cart';
import { CheckoutPage } from './pages/checkout';
import { LoginPage } from './pages/login';
import { OrderConfirmationPage } from './pages/order-confirmation';
import { OrdersPage } from './pages/orders-page';
import { ProductDetailPage } from './pages/product-detail';
import { ProductsPage } from './pages/products';
import { RegisterPage } from './pages/register';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      {
        index: true,
        element: <ProductsPage />,
      },
      {
        path: 'products/:slug',
        element: <ProductDetailPage />,
      },
      {
        path: 'cart',
        element: <CartPage />,
      },
      {
        path: 'login',
        element: <LoginPage />,
      },
      {
        path: 'register',
        element: <RegisterPage />,
      },
      {
        path: 'checkout',
        element: (
          <RequireAuth>
            <CheckoutPage />
          </RequireAuth>
        ),
      },
      {
        path: 'orders',
        element: (
          <RequireAuth>
            <OrdersPage />
          </RequireAuth>
        ),
      },
      {
        path: 'orders/:orderNumber/confirmation',
        element: (
          <RequireAuth>
            <OrderConfirmationPage />
          </RequireAuth>
        ),
      },
    ],
  },
]);
