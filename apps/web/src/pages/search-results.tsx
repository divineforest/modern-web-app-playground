import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ButtonGroup from '@mui/material/ButtonGroup';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import CardContent from '@mui/material/CardContent';
import CardMedia from '@mui/material/CardMedia';
import CircularProgress from '@mui/material/CircularProgress';
import Container from '@mui/material/Container';
import Pagination from '@mui/material/Pagination';
import Typography from '@mui/material/Typography';
import { Link, useSearchParams } from 'react-router-dom';
import noPhoto from '../assets/no-photo.svg';
import { tsr } from '../lib/api-client';

const PAGE_SIZE = 20;

type SortOption = 'relevance' | 'price_asc' | 'price_desc';

export function SearchResultsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  const sort = (searchParams.get('sort') || 'relevance') as SortOption;
  const page = Number(searchParams.get('page')) || 1;

  const validationError =
    query.trim().length > 0 && query.trim().length < 2
      ? 'Search query must be at least 2 characters'
      : null;

  const shouldFetch = query.trim().length >= 2;

  const { data, isPending, error } = tsr.products.search.useQuery({
    queryKey: ['products-search', query, sort, page],
    queryData: {
      query: {
        q: query,
        sort,
        page,
        limit: PAGE_SIZE,
      },
    },
    enabled: shouldFetch,
  });

  const products = data?.status === 200 ? data.body.products : [];
  const pagination = data?.status === 200 ? data.body.pagination : null;

  const formatPrice = (price: string, currency: string) => {
    const numericPrice = Number.parseFloat(price);
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(numericPrice);
  };

  const handleSortChange = (newSort: SortOption) => {
    setSearchParams({ q: query, sort: newSort, page: '1' });
  };

  const handlePageChange = (_: unknown, value: number) => {
    setSearchParams({ q: query, sort, page: value.toString() });
  };

  if (!query) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Search Products
        </Typography>
        <Alert severity="info">Enter a search query to find products.</Alert>
      </Container>
    );
  }

  if (validationError) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Search Results
        </Typography>
        <Alert severity="error">{validationError}</Alert>
      </Container>
    );
  }

  if (isPending) {
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
          <Alert severity="error">
            {error instanceof Error ? error.message : 'An error occurred'}
          </Alert>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Search results for: "{query}"
      </Typography>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="body1" color="text.secondary">
          {pagination?.total || 0} {pagination?.total === 1 ? 'result' : 'results'} found
        </Typography>

        <ButtonGroup variant="outlined" size="small">
          <Button
            onClick={() => handleSortChange('relevance')}
            variant={sort === 'relevance' ? 'contained' : 'outlined'}
            aria-pressed={sort === 'relevance'}
          >
            Relevance
          </Button>
          <Button
            onClick={() => handleSortChange('price_asc')}
            variant={sort === 'price_asc' ? 'contained' : 'outlined'}
            aria-pressed={sort === 'price_asc'}
          >
            Price: Low to High
          </Button>
          <Button
            onClick={() => handleSortChange('price_desc')}
            variant={sort === 'price_desc' ? 'contained' : 'outlined'}
            aria-pressed={sort === 'price_desc'}
          >
            Price: High to Low
          </Button>
        </ButtonGroup>
      </Box>

      {products.length === 0 ? (
        <Alert severity="info">No products match your search. Try different keywords.</Alert>
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
                sx={{ display: 'flex', flexDirection: 'column', height: 'auto', minHeight: 340 }}
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
                      bgcolor: '#F5F5F4',
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
                              <Box
                                component="span"
                                sx={{ fontSize: '0.8rem', mt: '0.1em', color: 'text.secondary' }}
                              >
                                {symbol}
                              </Box>
                              <Box component="span" sx={{ fontSize: '1.5rem', lineHeight: 1 }}>
                                {integer}
                              </Box>
                              <Box
                                component="span"
                                sx={{ fontSize: '0.8rem', mt: '0.1em', color: 'text.secondary' }}
                              >
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
                onChange={handlePageChange}
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
