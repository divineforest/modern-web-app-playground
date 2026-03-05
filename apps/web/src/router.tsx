import { createBrowserRouter } from 'react-router-dom';
import { RootLayout } from './layouts/root-layout';
import { CartPage } from './pages/cart';
import { CheckoutPage } from './pages/checkout';
import { OrderConfirmationPage } from './pages/order-confirmation';
import { ProductDetailPage } from './pages/product-detail';
import { ProductsPage } from './pages/products';

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
        path: 'checkout',
        element: <CheckoutPage />,
      },
      {
        path: 'orders/:orderNumber/confirmation',
        element: <OrderConfirmationPage />,
      },
    ],
  },
]);
