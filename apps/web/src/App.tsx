import { useEffect, useState } from 'react';
import noPhoto from './assets/no-photo.svg';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardMedia from '@mui/material/CardMedia';
import CircularProgress from '@mui/material/CircularProgress';
import Container from '@mui/material/Container';
import Pagination from '@mui/material/Pagination';
import Typography from '@mui/material/Typography';

const PAGE_SIZE = 20;

interface Product {
  id: string;
  name: string;
  shortDescription: string | null;
  imageUrl: string | null;
  price: string;
  compareAtPrice: string | null;
  currency: string;
}

interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

function App() {
  const [products, setProducts] = useState<Product[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);

    async function fetchProducts() {
      try {
        const params = new URLSearchParams({
          status: 'active',
          page: String(page),
          limit: String(PAGE_SIZE),
        });
        const response = await fetch(`/api/products?${params.toString()}`);
        if (!response.ok) {
          throw new Error(`Failed to fetch products: ${response.statusText}`);
        }
        const data = await response.json();
        setProducts(data.products);
        setPagination(data.pagination);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    }

    void fetchProducts();
  }, [page]);

  const formatPrice = (price: string, currency: string) => {
    const numericPrice = Number.parseFloat(price);
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(numericPrice);
  };

  if (loading) {
    return (
      <Container maxWidth="lg">
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="lg">
        <Box sx={{ mt: 4 }}>
          <Alert severity="error">{error}</Alert>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h3" component="h1" gutterBottom sx={{ mb: 4 }}>
        Mercado
      </Typography>

      {products.length === 0 ? (
        <Typography variant="body1" color="text.secondary">
          No products available at the moment.
        </Typography>
      ) : (
        <>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr',
                sm: 'repeat(2, 1fr)',
                md: 'repeat(3, 1fr)',
                lg: 'repeat(4, 1fr)',
              },
              gap: 3,
            }}
          >
            {products.map((product) => (
              <Card key={product.id} sx={{ display: 'flex', flexDirection: 'column', height: 360 }}>
                <CardMedia
                  component="img"
                  image={product.imageUrl ?? noPhoto}
                  alt={product.name}
                  sx={{
                    height: 200,
                    flexShrink: 0,
                    objectFit: product.imageUrl ? 'cover' : 'none',
                    bgcolor: '#F3F4F6',
                  }}
                />
                <CardContent
                  sx={{
                    flexGrow: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                  }}
                >
                  <Typography
                    variant="h6"
                    component="h2"
                    sx={{
                      overflow: 'hidden',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      lineHeight: 1.3,
                      mb: 0.5,
                    }}
                  >
                    {product.name}
                  </Typography>

                  {product.shortDescription && (
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{
                        overflow: 'hidden',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        mb: 1,
                      }}
                    >
                      {product.shortDescription}
                    </Typography>
                  )}

                  <Box sx={{ mt: 'auto' }}>
                    <Typography variant="h6" component="div" sx={{ fontWeight: 'bold' }}>
                      {formatPrice(product.price, product.currency)}
                    </Typography>
                    {product.compareAtPrice && (
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ textDecoration: 'line-through' }}
                      >
                        {formatPrice(product.compareAtPrice, product.currency)}
                      </Typography>
                    )}
                  </Box>
                </CardContent>
              </Card>
            ))}
          </Box>

          {pagination && pagination.totalPages > 1 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
              <Pagination
                count={pagination.totalPages}
                page={page}
                onChange={(_, value) => {
                  setPage(value);
                }}
                color="primary"
                showFirstButton
                showLastButton
              />
            </Box>
          )}
        </>
      )}
    </Container>
  );
}

export default App;
