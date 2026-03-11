import Add from '@mui/icons-material/Add';
import Remove from '@mui/icons-material/Remove';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { tsr } from '../lib/api-client';

interface Props {
  productId: string;
  productName: string;
}

export function ProductCardCartControls({ productId, productName }: Props) {
  const queryClient = useQueryClient();
  const [pendingQty, setPendingQty] = useState(1);
  const [addError, setAddError] = useState<string | null>(null);

  const { data, isPending: cartLoading } = tsr.cart.getCart.useQuery({
    queryKey: ['cart'],
  });

  const cart = data?.status === 200 ? data.body : null;
  const cartItem = cart?.items.find((item) => item.productId === productId) ?? null;

  const addItemMutation = tsr.cart.addItem.useMutation({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cart'] });
      setPendingQty(1);
      setAddError(null);
    },
    onError: () => {
      setAddError('Failed to add item');
    },
  });

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
      if (context?.previous) queryClient.setQueryData(['cart'], context.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['cart'] });
    },
  });

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
      if (context?.previous) queryClient.setQueryData(['cart'], context.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['cart'] });
    },
  });

  const isMutating = updateItemMutation.isPending || removeItemMutation.isPending;

  if (cartLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 1 }}>
        <CircularProgress size={20} />
      </Box>
    );
  }

  if (cartItem) {
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 1,
          mt: 1.5,
        }}
      >
        <IconButton
          size="small"
          onClick={() => {
            if (cartItem.quantity === 1) {
              removeItemMutation.mutate({ params: { itemId: cartItem.id } });
            } else {
              updateItemMutation.mutate({
                params: { itemId: cartItem.id },
                body: { quantity: cartItem.quantity - 1 },
              });
            }
          }}
          disabled={isMutating}
          aria-label={
            cartItem.quantity === 1
              ? `Remove one ${productName} from cart`
              : `Decrease quantity of ${productName}`
          }
          sx={{
            bgcolor: 'grey.200',
            width: 32,
            height: 32,
            '&:hover': { bgcolor: 'grey.300' },
          }}
        >
          <Remove fontSize="small" />
        </IconButton>

        <Typography
          aria-live="polite"
          sx={{ minWidth: 28, textAlign: 'center', fontWeight: 'bold' }}
        >
          {cartItem.quantity}
        </Typography>

        <IconButton
          size="small"
          onClick={() =>
            updateItemMutation.mutate({
              params: { itemId: cartItem.id },
              body: { quantity: cartItem.quantity + 1 },
            })
          }
          disabled={isMutating}
          aria-label={`Increase quantity of ${productName}`}
          sx={{
            bgcolor: 'grey.200',
            width: 32,
            height: 32,
            '&:hover': { bgcolor: 'grey.300' },
          }}
        >
          <Add fontSize="small" />
        </IconButton>
      </Box>
    );
  }

  return (
    <Box sx={{ mt: 1.5 }}>
      {addError && (
        <Alert
          severity="error"
          onClose={() => setAddError(null)}
          sx={{ mb: 1, py: 0, fontSize: '0.75rem' }}
        >
          {addError}
        </Alert>
      )}

      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mb: 1 }}>
        <IconButton
          size="small"
          onClick={() => setPendingQty((q) => Math.max(1, q - 1))}
          disabled={pendingQty <= 1 || addItemMutation.isPending}
          sx={{ bgcolor: 'grey.200', width: 28, height: 28, '&:hover': { bgcolor: 'grey.300' } }}
        >
          <Remove sx={{ fontSize: 14 }} />
        </IconButton>
        <Typography
          sx={{ minWidth: 24, textAlign: 'center', fontWeight: 'bold', fontSize: '0.9rem' }}
        >
          {pendingQty}
        </Typography>
        <IconButton
          size="small"
          onClick={() => setPendingQty((q) => q + 1)}
          disabled={addItemMutation.isPending}
          sx={{ bgcolor: 'grey.200', width: 28, height: 28, '&:hover': { bgcolor: 'grey.300' } }}
        >
          <Add sx={{ fontSize: 14 }} />
        </IconButton>
      </Box>

      <Button
        fullWidth
        variant="contained"
        disabled={addItemMutation.isPending}
        onClick={() => addItemMutation.mutate({ body: { productId, quantity: pendingQty } })}
        aria-label={`Add ${productName} to cart`}
        sx={{
          bgcolor: '#FFD814',
          color: '#0F1111',
          fontWeight: 'bold',
          borderRadius: 5,
          textTransform: 'none',
          boxShadow: 'none',
          fontSize: '0.85rem',
          py: 0.75,
          '&:hover': { bgcolor: '#F7CA00', boxShadow: 'none' },
          '&.Mui-disabled': { bgcolor: '#FFD814', opacity: 0.6, color: '#0F1111' },
        }}
      >
        {addItemMutation.isPending ? 'Adding…' : 'Add to Cart'}
      </Button>
    </Box>
  );
}
