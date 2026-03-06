import Add from '@mui/icons-material/Add';
import ArrowBack from '@mui/icons-material/ArrowBack';
import Remove from '@mui/icons-material/Remove';
import ShoppingCart from '@mui/icons-material/ShoppingCart';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Container from '@mui/material/Container';
import IconButton from '@mui/material/IconButton';
import Snackbar from '@mui/material/Snackbar';
import Typography from '@mui/material/Typography';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import noPhoto from '../assets/no-photo.svg';
import { tsr } from '../lib/api-client';

export function ProductDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [quantity, setQuantity] = useState(1);
  const [showSuccess, setShowSuccess] = useState(false);

  const {
    data,
    isPending,
    error: queryError,
  } = tsr.products.getBySlug.useQuery({
    queryKey: ['products', slug],
    queryData: {
      params: { slug: slug ?? '' },
    },
    enabled: !!slug,
  });

  const product = data?.status === 200 ? data.body : null;
  const error =
    queryError instanceof Error
      ? queryError.message
      : !slug
        ? 'Product slug is missing'
        : data?.status === 404
          ? 'Product not found'
          : data && data.status !== 200
            ? 'Failed to fetch product'
            : null;

  const addToCartMutation = tsr.cart.addItem.useMutation({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cart'] });
      setShowSuccess(true);
      setQuantity(1);
    },
  });

  const formatPrice = (price: string, currency: string) => {
    const numericPrice = Number.parseFloat(price);
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(numericPrice);
  };

  const addToCart = () => {
    if (!product) return;

    addToCartMutation.mutate({
      body: {
        productId: product.id,
        quantity,
      },
    });
  };

  if (isPending) {
    return (
      <Container maxWidth="lg">
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (error || !product) {
    return (
      <Container maxWidth="lg">
        <Box sx={{ mt: 4 }}>
          <Button startIcon={<ArrowBack />} onClick={() => navigate(-1)} sx={{ mb: 2 }}>
            Back
          </Button>
          <Alert severity="error">{error || 'Product not found'}</Alert>
          {addToCartMutation.error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {addToCartMutation.error instanceof Error
                ? addToCartMutation.error.message
                : 'Failed to add to cart'}
            </Alert>
          )}
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Button startIcon={<ArrowBack />} onClick={() => navigate(-1)} sx={{ mb: 3 }}>
        Back
      </Button>

      {addToCartMutation.error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {addToCartMutation.error instanceof Error
            ? addToCartMutation.error.message
            : 'Failed to add to cart'}
        </Alert>
      )}

      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          gap: 4,
        }}
      >
        <Box
          sx={{
            flex: { xs: '1 1 auto', md: '0 0 50%' },
            maxWidth: { xs: '100%', md: '50%' },
          }}
        >
          <Box
            component="img"
            src={product.imageUrl ?? noPhoto}
            alt={product.name}
            sx={{
              width: '100%',
              height: 'auto',
              maxHeight: 500,
              objectFit: product.imageUrl ? 'cover' : 'none',
              bgcolor: '#F3F4F6',
              borderRadius: 1,
            }}
          />
        </Box>

        <Box sx={{ flex: 1 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            {product.name}
          </Typography>

          {product.category && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Category: {product.category}
            </Typography>
          )}

          {product.tags && product.tags.length > 0 && (
            <Box sx={{ mb: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {product.tags.map((tag) => (
                <Chip key={tag} label={tag} size="small" />
              ))}
            </Box>
          )}

          <Box sx={{ mb: 3, display: 'flex', alignItems: 'baseline', gap: 1.5, flexWrap: 'wrap' }}>
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
                  sx={{ fontWeight: 'bold', display: 'inline-flex', alignItems: 'flex-start' }}
                >
                  <Box component="span" sx={{ fontSize: '1rem', mt: '0.15em' }}>
                    {symbol}
                  </Box>
                  <Box component="span" sx={{ fontSize: '2rem', lineHeight: 1 }}>
                    {integer}
                  </Box>
                  <Box component="span" sx={{ fontSize: '1rem', mt: '0.15em' }}>
                    {fraction}
                  </Box>
                </Typography>
              );
            })()}
            {product.compareAtPrice && (
              <Typography variant="body1" color="text.secondary">
                Recommended:{' '}
                <Box component="span" sx={{ textDecoration: 'line-through' }}>
                  {formatPrice(product.compareAtPrice, product.currency)}
                </Box>
              </Typography>
            )}
          </Box>

          <Box sx={{ mb: 3 }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Quantity
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <IconButton
                onClick={() => setQuantity((prev) => Math.max(1, prev - 1))}
                disabled={quantity <= 1 || addToCartMutation.isPending}
                size="small"
              >
                <Remove />
              </IconButton>
              <Typography
                variant="body1"
                data-testid="quantity-input"
                sx={{ minWidth: 40, textAlign: 'center' }}
              >
                {quantity}
              </Typography>
              <IconButton
                onClick={() => setQuantity((prev) => prev + 1)}
                disabled={addToCartMutation.isPending}
                size="small"
              >
                <Add />
              </IconButton>
            </Box>

            <Button
              variant="contained"
              size="large"
              startIcon={<ShoppingCart />}
              onClick={() => addToCart()}
              disabled={addToCartMutation.isPending}
              fullWidth
              data-testid="add-to-cart-button"
            >
              {addToCartMutation.isPending ? 'Adding...' : 'Add to Cart'}
            </Button>
          </Box>

          {product.description && (
            <Box>
              <Typography variant="h6" gutterBottom>
                Description
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ whiteSpace: 'pre-line' }}>
                {product.description}
              </Typography>
            </Box>
          )}
        </Box>
      </Box>

      <Snackbar
        open={showSuccess}
        autoHideDuration={3000}
        onClose={() => setShowSuccess(false)}
        message="Added to cart!"
      />
    </Container>
  );
}
