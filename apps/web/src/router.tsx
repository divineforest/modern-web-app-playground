import { createBrowserRouter } from 'react-router-dom';
import { RootLayout } from './layouts/root-layout';
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
    ],
  },
]);
