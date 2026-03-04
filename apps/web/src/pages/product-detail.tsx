import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getCartHeaders, setCartToken } from '../lib/cart-token';
import { useCart } from '../contexts/cart-context';
import noPhoto from '../assets/no-photo.svg';
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

interface Product {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  shortDescription: string | null;
  category: string | null;
  tags: string[] | null;
  imageUrl: string | null;
  price: string;
  compareAtPrice: string | null;
  currency: string;
}

export function ProductDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { refreshCart } = useCart();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [addingToCart, setAddingToCart] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    if (!slug) {
      setError('Product slug is missing');
      setLoading(false);
      return;
    }

    setLoading(true);

    async function fetchProduct() {
      try {
        const response = await fetch(`/api/products/by-slug/${slug}`);
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error('Product not found');
          }
          throw new Error(`Failed to fetch product: ${response.statusText}`);
        }
        const data = await response.json();
        setProduct(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    }

    void fetchProduct();
  }, [slug]);

  const formatPrice = (price: string, currency: string) => {
    const numericPrice = Number.parseFloat(price);
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(numericPrice);
  };

  const addToCart = async () => {
    if (!product) return;

    setAddingToCart(true);

    try {
      const response = await fetch('/api/cart/items', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getCartHeaders(),
        },
        body: JSON.stringify({
          productId: product.id,
          quantity,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to add item to cart');
      }

      const data = await response.json();
      if (data.newCartToken) {
        setCartToken(data.newCartToken);
      }

      refreshCart();
      setShowSuccess(true);
      setQuantity(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add to cart');
    } finally {
      setAddingToCart(false);
    }
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

  if (error || !product) {
    return (
      <Container maxWidth="lg">
        <Box sx={{ mt: 4 }}>
          <Button startIcon={<ArrowBack />} onClick={() => navigate(-1)} sx={{ mb: 2 }}>
            Back
          </Button>
          <Alert severity="error">{error || 'Product not found'}</Alert>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Button startIcon={<ArrowBack />} onClick={() => navigate(-1)} sx={{ mb: 3 }}>
        Back
      </Button>

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
                disabled={quantity <= 1 || addingToCart}
                size="small"
              >
                <Remove />
              </IconButton>
              <Typography variant="body1" sx={{ minWidth: 40, textAlign: 'center' }}>
                {quantity}
              </Typography>
              <IconButton
                onClick={() => setQuantity((prev) => prev + 1)}
                disabled={addingToCart}
                size="small"
              >
                <Add />
              </IconButton>
            </Box>

            <Button
              variant="contained"
              size="large"
              startIcon={<ShoppingCart />}
              onClick={() => void addToCart()}
              disabled={addingToCart}
              fullWidth
            >
              {addingToCart ? 'Adding...' : 'Add to Cart'}
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
