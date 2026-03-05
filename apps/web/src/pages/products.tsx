import type { apiContract } from '@mercado/api-contracts';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import CardContent from '@mui/material/CardContent';
import CardMedia from '@mui/material/CardMedia';
import CircularProgress from '@mui/material/CircularProgress';
import Container from '@mui/material/Container';
import Pagination from '@mui/material/Pagination';
import Typography from '@mui/material/Typography';
import type { ClientInferResponseBody } from '@ts-rest/core';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import noPhoto from '../assets/no-photo.svg';
import { api } from '../lib/api-client';

const PAGE_SIZE = 20;

type ProductsListResponse = ClientInferResponseBody<typeof apiContract.products.list, 200>;
type Product = ProductsListResponse['products'][number];
type PaginationMeta = ProductsListResponse['pagination'];

export function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);

    async function fetchProducts() {
      try {
        const response = await api.products.list({
          query: {
            status: 'active',
            page,
            limit: PAGE_SIZE,
          },
        });

        if (response.status === 200) {
          setProducts(response.body.products);
          setPagination(response.body.pagination);
        } else {
          throw new Error('Failed to fetch products');
        }
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
              <Card
                key={product.id}
                data-testid="product-card"
                sx={{ display: 'flex', flexDirection: 'column', height: 360 }}
              >
                <CardActionArea
                  component={Link}
                  to={`/products/${product.slug}`}
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    height: '100%',
                    alignItems: 'stretch',
                  }}
                >
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
                      <Box
                        sx={{ display: 'flex', alignItems: 'baseline', gap: 1, flexWrap: 'wrap' }}
                      >
                        {(() => {
                          const numericPrice = Number.parseFloat(product.price);
                          const parts = new Intl.NumberFormat('en-US', {
                            style: 'currency',
                            currency: product.currency,
                          }).formatToParts(numericPrice);
                          const symbol = parts.find((p) => p.type === 'currency')?.value ?? '';
                          const integer = parts
                            .filter((p) => p.type === 'integer' || p.type === 'group')
                            .map((p) => p.value)
                            .join('');
                          const fraction = parts.find((p) => p.type === 'fraction')?.value ?? '00';
                          return (
                            <Typography
                              component="span"
                              sx={{
                                fontWeight: 'bold',
                                display: 'inline-flex',
                                alignItems: 'flex-start',
                              }}
                            >
                              <Box component="span" sx={{ fontSize: '0.8rem', mt: '0.1em' }}>
                                {symbol}
                              </Box>
                              <Box component="span" sx={{ fontSize: '1.5rem', lineHeight: 1 }}>
                                {integer}
                              </Box>
                              <Box component="span" sx={{ fontSize: '0.8rem', mt: '0.1em' }}>
                                {fraction}
                              </Box>
                            </Typography>
                          );
                        })()}
                        {product.compareAtPrice && (
                          <Typography variant="body2" color="text.secondary">
                            Recommended:{' '}
                            <Box component="span" sx={{ textDecoration: 'line-through' }}>
                              {formatPrice(product.compareAtPrice, product.currency)}
                            </Box>
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  </CardContent>
                </CardActionArea>
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
