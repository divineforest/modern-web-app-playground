import ShoppingCart from '@mui/icons-material/ShoppingCart';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { Link } from 'react-router-dom';
import { tsr } from '../lib/api-client';

const formatPrice = (price: string, currency: string) => {
  const numericPrice = Number.parseFloat(price);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
  }).format(numericPrice);
};

export function CartSidebar() {
  const { data, isPending } = tsr.cart.getCart.useQuery({
    queryKey: ['cart'],
  });

  const cart = data?.status === 200 ? data.body : null;

  return (
    <Paper sx={{ p: 2, position: 'sticky', top: 16 }}>
      <Typography variant="h6" gutterBottom>
        Your Cart
      </Typography>

      {isPending ? (
        <Box display="flex" justifyContent="center" py={3}>
          <CircularProgress size={24} />
        </Box>
      ) : !cart || cart.items.length === 0 ? (
        <Box display="flex" flexDirection="column" alignItems="center" py={3} gap={1}>
          <ShoppingCart sx={{ fontSize: 40, color: 'text.disabled' }} />
          <Typography variant="body2" color="text.secondary">
            Your cart is empty
          </Typography>
        </Box>
      ) : (
        <>
          <Box sx={{ maxHeight: 360, overflowY: 'auto', mb: 1 }}>
            {cart.items.map((item) => (
              <Box key={item.id} sx={{ display: 'flex', justifyContent: 'space-between', py: 1 }}>
                <Box sx={{ flex: 1, minWidth: 0, pr: 1 }}>
                  <Typography
                    variant="body2"
                    sx={{
                      overflow: 'hidden',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                    }}
                  >
                    {item.productName}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Qty: {item.quantity}
                  </Typography>
                </Box>
                <Typography variant="body2" sx={{ flexShrink: 0 }}>
                  {formatPrice(item.lineTotal, item.currency)}
                </Typography>
              </Box>
            ))}
          </Box>

          <Divider sx={{ my: 1 }} />

          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="body2" fontWeight="bold">
              Subtotal
            </Typography>
            <Typography variant="body2" fontWeight="bold">
              {cart.currency ? formatPrice(cart.subtotal, cart.currency) : cart.subtotal}
            </Typography>
          </Box>

          <Button variant="contained" fullWidth component={Link} to="/checkout" sx={{ mb: 1 }}>
            Checkout
          </Button>
          <Button variant="outlined" fullWidth component={Link} to="/cart">
            View Cart
          </Button>
        </>
      )}
    </Paper>
  );
}
