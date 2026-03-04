import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getCartHeaders, removeCartToken } from '../lib/cart-token';
import { useCart } from '../contexts/cart-context';
import noPhoto from '../assets/no-photo.svg';
import Add from '@mui/icons-material/Add';
import Delete from '@mui/icons-material/Delete';
import Remove from '@mui/icons-material/Remove';
import ShoppingCart from '@mui/icons-material/ShoppingCart';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CircularProgress from '@mui/material/CircularProgress';
import Container from '@mui/material/Container';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';

interface CartItem {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  productImageUrl: string | null;
  unitPrice: string;
  quantity: number;
  lineTotal: string;
  currency: string;
}

interface Cart {
  items: CartItem[];
  subtotal: string;
  itemCount: number;
  currency: string | null;
}

export function CartPage() {
  const { updateItemCount } = useCart();
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingItems, setUpdatingItems] = useState<Set<string>>(new Set());

  const formatPrice = (price: string, currency: string) => {
    const numericPrice = Number.parseFloat(price);
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(numericPrice);
  };

  const fetchCart = useCallback(async () => {
    try {
      const response = await fetch('/api/cart', {
        headers: getCartHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch cart: ${response.statusText}`);
      }

      const data = await response.json();
      setCart(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchCart();
  }, [fetchCart]);

  const updateQuantity = async (itemId: string, newQuantity: number) => {
    if (newQuantity < 1 || !cart) return;

    setUpdatingItems((prev) => new Set(prev).add(itemId));

    const previousCart = { ...cart };

    setCart({
      ...cart,
      items: cart.items.map((item) =>
        item.id === itemId
          ? {
              ...item,
              quantity: newQuantity,
              lineTotal: (Number.parseFloat(item.unitPrice) * newQuantity).toFixed(2),
            }
          : item
      ),
    });

    try {
      const response = await fetch(`/api/cart/items/${itemId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...getCartHeaders(),
        },
        body: JSON.stringify({ quantity: newQuantity }),
      });

      if (!response.ok) {
        throw new Error('Failed to update quantity');
      }

      const data = await response.json();
      setCart(data);
      updateItemCount(data.itemCount ?? 0);
    } catch (err) {
      setCart(previousCart);
      setError(err instanceof Error ? err.message : 'Failed to update quantity');
    } finally {
      setUpdatingItems((prev) => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
    }
  };

  const removeItem = async (itemId: string) => {
    if (!cart) return;

    setUpdatingItems((prev) => new Set(prev).add(itemId));

    const previousCart = { ...cart };

    setCart({
      ...cart,
      items: cart.items.filter((item) => item.id !== itemId),
    });

    try {
      const response = await fetch(`/api/cart/items/${itemId}`, {
        method: 'DELETE',
        headers: getCartHeaders(),
      });

      if (!response.ok) {
        throw new Error('Failed to remove item');
      }

      const data = await response.json();
      setCart(data);
      updateItemCount(data.itemCount ?? 0);

      if (data.items.length === 0) {
        removeCartToken();
      }
    } catch (err) {
      setCart(previousCart);
      setError(err instanceof Error ? err.message : 'Failed to remove item');
    } finally {
      setUpdatingItems((prev) => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
    }
  };

  const clearCart = async () => {
    if (!cart) return;

    const previousCart = { ...cart };

    setCart({
      items: [],
      subtotal: '0.00',
      itemCount: 0,
      currency: null,
    });

    try {
      const response = await fetch('/api/cart', {
        method: 'DELETE',
        headers: getCartHeaders(),
      });

      if (!response.ok) {
        throw new Error('Failed to clear cart');
      }

      removeCartToken();
      updateItemCount(0);
    } catch (err) {
      setCart(previousCart);
      setError(err instanceof Error ? err.message : 'Failed to clear cart');
    }
  };

  if (loading) {
    return (
      <Container maxWidth="lg">
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="lg">
        <Box sx={{ mt: 4 }}>
          <Alert severity="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        </Box>
      </Container>
    );
  }

  if (!cart || cart.items.length === 0) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Shopping Cart
        </Typography>
        <Paper sx={{ p: 6, textAlign: 'center' }}>
          <ShoppingCart sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" gutterBottom>
            Your cart is empty
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Add some products to get started!
          </Typography>
          <Button component={Link} to="/" variant="contained" size="large">
            Continue Shopping
          </Button>
        </Paper>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Shopping Cart
      </Typography>

      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 3 }}>
        <Box sx={{ flex: 1 }}>
          {cart.items.map((item) => (
            <Card key={item.id} sx={{ mb: 2 }}>
              <CardContent>
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <Box
                    component="img"
                    src={item.productImageUrl ?? noPhoto}
                    alt={item.productName}
                    sx={{
                      width: 120,
                      height: 120,
                      objectFit: item.productImageUrl ? 'cover' : 'none',
                      bgcolor: '#F3F4F6',
                      borderRadius: 1,
                      flexShrink: 0,
                    }}
                  />

                  <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <Typography variant="h6" component="h2" gutterBottom>
                      {item.productName}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      SKU: {item.productSku}
                    </Typography>
                    <Typography variant="body1" sx={{ mt: 'auto' }}>
                      {formatPrice(item.unitPrice, item.currency)}
                    </Typography>
                  </Box>

                  <Box
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-end',
                      justifyContent: 'space-between',
                      minWidth: 150,
                    }}
                  >
                    <IconButton
                      onClick={() => void removeItem(item.id)}
                      disabled={updatingItems.has(item.id)}
                      size="small"
                      color="error"
                    >
                      <Delete />
                    </IconButton>

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <IconButton
                        onClick={() => void updateQuantity(item.id, item.quantity - 1)}
                        disabled={item.quantity <= 1 || updatingItems.has(item.id)}
                        size="small"
                      >
                        <Remove />
                      </IconButton>
                      <Typography variant="body1" sx={{ minWidth: 30, textAlign: 'center' }}>
                        {item.quantity}
                      </Typography>
                      <IconButton
                        onClick={() => void updateQuantity(item.id, item.quantity + 1)}
                        disabled={updatingItems.has(item.id)}
                        size="small"
                      >
                        <Add />
                      </IconButton>
                    </Box>

                    <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                      {formatPrice(item.lineTotal, item.currency)}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          ))}

          <Button onClick={() => void clearCart()} color="error" sx={{ mt: 2 }}>
            Clear Cart
          </Button>
        </Box>

        <Paper sx={{ p: 3, height: 'fit-content', minWidth: { xs: '100%', md: 300 } }}>
          <Typography variant="h6" gutterBottom>
            Cart Summary
          </Typography>
          <Divider sx={{ my: 2 }} />

          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="body1">Items:</Typography>
            <Typography variant="body1">{cart.itemCount}</Typography>
          </Box>

          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="body1">Subtotal:</Typography>
            <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
              {cart.currency ? formatPrice(cart.subtotal, cart.currency) : cart.subtotal}
            </Typography>
          </Box>

          <Divider sx={{ my: 2 }} />

          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
            <Typography variant="h6">Total:</Typography>
            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
              {cart.currency ? formatPrice(cart.subtotal, cart.currency) : cart.subtotal}
            </Typography>
          </Box>

          <Button variant="contained" fullWidth size="large" disabled sx={{ mb: 2 }}>
            Proceed to Checkout
          </Button>

          <Button component={Link} to="/" variant="outlined" fullWidth>
            Continue Shopping
          </Button>
        </Paper>
      </Box>
    </Container>
  );
}
