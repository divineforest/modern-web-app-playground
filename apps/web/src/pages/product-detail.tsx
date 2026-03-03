import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import noPhoto from '../assets/no-photo.svg';
import ArrowBack from '@mui/icons-material/ArrowBack';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Container from '@mui/material/Container';
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
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

          <Box sx={{ mb: 3 }}>
            <Typography variant="h5" component="div" sx={{ fontWeight: 'bold', mb: 0.5 }}>
              {formatPrice(product.price, product.currency)}
            </Typography>
            {product.compareAtPrice && (
              <Typography
                variant="h6"
                color="text.secondary"
                sx={{ textDecoration: 'line-through' }}
              >
                {formatPrice(product.compareAtPrice, product.currency)}
              </Typography>
            )}
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
    </Container>
  );
}
