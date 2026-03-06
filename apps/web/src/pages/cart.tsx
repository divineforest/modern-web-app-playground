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
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import noPhoto from '../assets/no-photo.svg';
import { tsr } from '../lib/api-client';

export function CartPage() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const { data, isPending } = tsr.cart.getCart.useQuery({
    queryKey: ['cart'],
  });

  const cart = data?.status === 200 ? data.body : null;

  const formatPrice = (price: string, currency: string) => {
    const numericPrice = Number.parseFloat(price);
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(numericPrice);
  };

  const updateItemMutation = tsr.cart.updateItem.useMutation({
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: ['cart'] });
      const previous = queryClient.getQueryData(['cart']);

      queryClient.setQueryData(['cart'], (old: typeof data) => {
        if (old?.status !== 200) return old;

        return {
          ...old,
          body: {
            ...old.body,
            items: old.body.items.map((item) =>
              item.id === vars.params.itemId
                ? {
                    ...item,
                    quantity: vars.body.quantity,
                    lineTotal: (Number.parseFloat(item.unitPrice) * vars.body.quantity).toFixed(2),
                  }
                : item
            ),
          },
        };
      });

      return { previous };
    },
    onError: (_, __, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['cart'], context.previous);
      }
      setError('Failed to update quantity');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['cart'] });
    },
  });

  const updateQuantity = (itemId: string, newQuantity: number) => {
    if (newQuantity < 1) return;
    updateItemMutation.mutate({
      params: { itemId },
      body: { quantity: newQuantity },
    });
  };

  const removeItemMutation = tsr.cart.removeItem.useMutation({
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: ['cart'] });
      const previous = queryClient.getQueryData(['cart']);

      queryClient.setQueryData(['cart'], (old: typeof data) => {
        if (old?.status !== 200) return old;

        return {
          ...old,
          body: {
            ...old.body,
            items: old.body.items.filter((item) => item.id !== vars.params.itemId),
          },
        };
      });

      return { previous };
    },
    onError: (_, __, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['cart'], context.previous);
      }
      setError('Failed to remove item');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['cart'] });
    },
  });

  const removeItem = (itemId: string) => {
    removeItemMutation.mutate({
      params: { itemId },
    });
  };

  const clearCartMutation = tsr.cart.clearCart.useMutation({
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['cart'] });
      const previous = queryClient.getQueryData(['cart']);

      queryClient.setQueryData(['cart'], (old: typeof data) => {
        if (old?.status !== 200) return old;

        return {
          ...old,
          body: {
            items: [],
            subtotal: '0.00',
            itemCount: 0,
            currency: null,
          },
        };
      });

      return { previous };
    },
    onError: (_, __, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['cart'], context.previous);
      }
      setError('Failed to clear cart');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['cart'] });
    },
  });

  const clearCart = () => {
    clearCartMutation.mutate();
  };

  if (isPending) {
    return (
      <Container maxWidth="lg">
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
          <CircularProgress />
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
      {updateItemMutation.error && (
        <Alert severity="error" onClose={() => updateItemMutation.reset()} sx={{ mb: 2 }}>
          {updateItemMutation.error instanceof Error
            ? updateItemMutation.error.message
            : 'Failed to update item'}
        </Alert>
      )}
      {removeItemMutation.error && (
        <Alert severity="error" onClose={() => removeItemMutation.reset()} sx={{ mb: 2 }}>
          {removeItemMutation.error instanceof Error
            ? removeItemMutation.error.message
            : 'Failed to remove item'}
        </Alert>
      )}
      {clearCartMutation.error && (
        <Alert severity="error" onClose={() => clearCartMutation.reset()} sx={{ mb: 2 }}>
          {clearCartMutation.error instanceof Error
            ? clearCartMutation.error.message
            : 'Failed to clear cart'}
        </Alert>
      )}

      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 3 }}>
        <Box sx={{ flex: 1 }}>
          {cart.items.map((item) => (
            <Card key={item.id} data-testid="cart-item" sx={{ mb: 2 }}>
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
                      onClick={() => removeItem(item.id)}
                      disabled={removeItemMutation.isPending || updateItemMutation.isPending}
                      size="small"
                      color="error"
                    >
                      <Delete />
                    </IconButton>

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <IconButton
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        disabled={
                          item.quantity <= 1 ||
                          updateItemMutation.isPending ||
                          removeItemMutation.isPending
                        }
                        size="small"
                      >
                        <Remove />
                      </IconButton>
                      <Typography
                        variant="body1"
                        data-testid="cart-item-quantity"
                        sx={{ minWidth: 30, textAlign: 'center' }}
                      >
                        {item.quantity}
                      </Typography>
                      <IconButton
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        disabled={updateItemMutation.isPending || removeItemMutation.isPending}
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

          <Button
            onClick={() => clearCart()}
            color="error"
            data-testid="clear-cart-button"
            sx={{ mt: 2 }}
            disabled={clearCartMutation.isPending}
          >
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

          <Button
            component={Link}
            to="/checkout"
            variant="contained"
            fullWidth
            size="large"
            sx={{ mb: 2 }}
          >
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
