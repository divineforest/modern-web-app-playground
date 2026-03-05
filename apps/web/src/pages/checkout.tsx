import type { apiContract } from '@mercado/api-contracts';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Checkbox from '@mui/material/Checkbox';
import CircularProgress from '@mui/material/CircularProgress';
import Container from '@mui/material/Container';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import type { ClientInferResponseBody } from '@ts-rest/core';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import noPhoto from '../assets/no-photo.svg';
import { useCart } from '../contexts/cart-context';
import { api } from '../lib/api-client';

type Cart = ClientInferResponseBody<typeof apiContract.cart.getCart, 200>;

interface AddressFormData {
  fullName: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  countryCode: string;
  phone: string;
}

const emptyAddress: AddressFormData = {
  fullName: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  state: '',
  postalCode: '',
  countryCode: 'US',
  phone: '',
};

export function CheckoutPage() {
  const navigate = useNavigate();
  const { updateItemCount } = useCart();
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shippingAddress, setShippingAddress] = useState<AddressFormData>(emptyAddress);
  const [billingAddress, setBillingAddress] = useState<AddressFormData>(emptyAddress);
  const [billingSameAsShipping, setBillingSameAsShipping] = useState(true);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const formatPrice = (price: string, currency: string) => {
    const numericPrice = Number.parseFloat(price);
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(numericPrice);
  };

  const fetchCart = useCallback(async () => {
    try {
      const response = await api.cart.getCart();

      if (response.status === 200) {
        if (response.body.items.length === 0) {
          navigate('/cart');
          return;
        }
        setCart(response.body);
        setError(null);
      } else {
        throw new Error('Failed to fetch cart');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    void fetchCart();
  }, [fetchCart]);

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!shippingAddress.fullName.trim()) {
      errors['shipping.fullName'] = 'Full name is required';
    }
    if (!shippingAddress.addressLine1.trim()) {
      errors['shipping.addressLine1'] = 'Address is required';
    }
    if (!shippingAddress.city.trim()) {
      errors['shipping.city'] = 'City is required';
    }
    if (!shippingAddress.postalCode.trim()) {
      errors['shipping.postalCode'] = 'Postal code is required';
    }
    if (!shippingAddress.countryCode.trim() || shippingAddress.countryCode.length !== 2) {
      errors['shipping.countryCode'] = 'Valid 2-letter country code is required';
    }

    if (!billingSameAsShipping) {
      if (!billingAddress.fullName.trim()) {
        errors['billing.fullName'] = 'Full name is required';
      }
      if (!billingAddress.addressLine1.trim()) {
        errors['billing.addressLine1'] = 'Address is required';
      }
      if (!billingAddress.city.trim()) {
        errors['billing.city'] = 'City is required';
      }
      if (!billingAddress.postalCode.trim()) {
        errors['billing.postalCode'] = 'Postal code is required';
      }
      if (!billingAddress.countryCode.trim() || billingAddress.countryCode.length !== 2) {
        errors['billing.countryCode'] = 'Valid 2-letter country code is required';
      }
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handlePlaceOrder = async () => {
    if (!validateForm()) {
      setError('Please fill in all required fields correctly.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await api.checkout.checkout({
        body: {
          shippingAddress: {
            fullName: shippingAddress.fullName,
            addressLine1: shippingAddress.addressLine1,
            addressLine2: shippingAddress.addressLine2 || undefined,
            city: shippingAddress.city,
            state: shippingAddress.state || undefined,
            postalCode: shippingAddress.postalCode,
            countryCode: shippingAddress.countryCode.toUpperCase(),
            phone: shippingAddress.phone || undefined,
          },
          billingAddress: billingSameAsShipping
            ? undefined
            : {
                fullName: billingAddress.fullName,
                addressLine1: billingAddress.addressLine1,
                addressLine2: billingAddress.addressLine2 || undefined,
                city: billingAddress.city,
                state: billingAddress.state || undefined,
                postalCode: billingAddress.postalCode,
                countryCode: billingAddress.countryCode.toUpperCase(),
                phone: billingAddress.phone || undefined,
              },
          billingSameAsShipping,
        },
      });

      if (response.status === 200) {
        updateItemCount(0);
        navigate(`/orders/${response.body.orderNumber}/confirmation`);
      } else if (response.status === 400) {
        const errorBody = response.body as {
          error?: string;
          issues?: Array<{ path: string[]; message: string }>;
        };
        if (errorBody.issues && Array.isArray(errorBody.issues)) {
          const fieldErrorsMap: Record<string, string> = {};
          for (const issue of errorBody.issues) {
            const path = issue.path.join('.');
            fieldErrorsMap[path] = issue.message;
          }
          setFieldErrors(fieldErrorsMap);
          setError('Please fix the validation errors below.');
        } else {
          setError(errorBody.error || 'Invalid request. Please check your input.');
        }
      } else if (response.status === 422) {
        setError(response.body.error);
      } else if (response.status === 404) {
        setError('Cart not found. Please add items to your cart.');
      } else if (response.status === 401) {
        setError('Please log in to complete your order.');
      } else {
        setError('Failed to place order. Please try again.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  const updateShippingField = (field: keyof AddressFormData, value: string) => {
    setShippingAddress((prev) => ({ ...prev, [field]: value }));
    if (billingSameAsShipping) {
      setBillingAddress((prev) => ({ ...prev, [field]: value }));
    }
    if (fieldErrors[`shipping.${field}`]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[`shipping.${field}`];
        return next;
      });
    }
  };

  const updateBillingField = (field: keyof AddressFormData, value: string) => {
    setBillingAddress((prev) => ({ ...prev, [field]: value }));
    if (fieldErrors[`billing.${field}`]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[`billing.${field}`];
        return next;
      });
    }
  };

  const handleBillingSameAsShippingChange = (checked: boolean) => {
    setBillingSameAsShipping(checked);
    if (checked) {
      setBillingAddress(shippingAddress);
      setFieldErrors((prev) => {
        const next = { ...prev };
        Object.keys(next).forEach((key) => {
          if (key.startsWith('billing.')) {
            delete next[key];
          }
        });
        return next;
      });
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

  if (error && !cart) {
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

  if (!cart) {
    return null;
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Checkout
      </Typography>

      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 3 }}>
        <Box sx={{ flex: 1 }}>
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Shipping Address
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                label="Full Name"
                value={shippingAddress.fullName}
                onChange={(e) => updateShippingField('fullName', e.target.value)}
                error={
                  !!fieldErrors['shipping.fullName'] || !!fieldErrors['shippingAddress.fullName']
                }
                helperText={
                  fieldErrors['shipping.fullName'] || fieldErrors['shippingAddress.fullName']
                }
                required
                fullWidth
              />
              <TextField
                label="Address Line 1"
                value={shippingAddress.addressLine1}
                onChange={(e) => updateShippingField('addressLine1', e.target.value)}
                error={
                  !!fieldErrors['shipping.addressLine1'] ||
                  !!fieldErrors['shippingAddress.addressLine1']
                }
                helperText={
                  fieldErrors['shipping.addressLine1'] ||
                  fieldErrors['shippingAddress.addressLine1']
                }
                required
                fullWidth
              />
              <TextField
                label="Address Line 2"
                value={shippingAddress.addressLine2}
                onChange={(e) => updateShippingField('addressLine2', e.target.value)}
                fullWidth
              />
              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField
                  label="City"
                  value={shippingAddress.city}
                  onChange={(e) => updateShippingField('city', e.target.value)}
                  error={!!fieldErrors['shipping.city'] || !!fieldErrors['shippingAddress.city']}
                  helperText={fieldErrors['shipping.city'] || fieldErrors['shippingAddress.city']}
                  required
                  fullWidth
                />
                <TextField
                  label="State/Province"
                  value={shippingAddress.state}
                  onChange={(e) => updateShippingField('state', e.target.value)}
                  fullWidth
                />
              </Box>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField
                  label="Postal Code"
                  value={shippingAddress.postalCode}
                  onChange={(e) => updateShippingField('postalCode', e.target.value)}
                  error={
                    !!fieldErrors['shipping.postalCode'] ||
                    !!fieldErrors['shippingAddress.postalCode']
                  }
                  helperText={
                    fieldErrors['shipping.postalCode'] || fieldErrors['shippingAddress.postalCode']
                  }
                  required
                  fullWidth
                />
                <TextField
                  label="Country Code"
                  value={shippingAddress.countryCode}
                  onChange={(e) => updateShippingField('countryCode', e.target.value)}
                  error={
                    !!fieldErrors['shipping.countryCode'] ||
                    !!fieldErrors['shippingAddress.countryCode']
                  }
                  helperText={
                    fieldErrors['shipping.countryCode'] ||
                    fieldErrors['shippingAddress.countryCode']
                  }
                  placeholder="US"
                  required
                  fullWidth
                />
              </Box>
              <TextField
                label="Phone"
                value={shippingAddress.phone}
                onChange={(e) => updateShippingField('phone', e.target.value)}
                fullWidth
              />
            </Box>
          </Paper>

          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Billing Address
            </Typography>
            <FormControlLabel
              control={
                <Checkbox
                  checked={billingSameAsShipping}
                  onChange={(e) => handleBillingSameAsShippingChange(e.target.checked)}
                />
              }
              label="Same as shipping address"
              sx={{ mb: 2 }}
            />
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                label="Full Name"
                value={billingSameAsShipping ? shippingAddress.fullName : billingAddress.fullName}
                onChange={(e) =>
                  !billingSameAsShipping && updateBillingField('fullName', e.target.value)
                }
                error={!!fieldErrors['billing.fullName']}
                helperText={fieldErrors['billing.fullName']}
                required
                fullWidth
                disabled={billingSameAsShipping}
              />
              <TextField
                label="Address Line 1"
                value={
                  billingSameAsShipping ? shippingAddress.addressLine1 : billingAddress.addressLine1
                }
                onChange={(e) =>
                  !billingSameAsShipping && updateBillingField('addressLine1', e.target.value)
                }
                error={!!fieldErrors['billing.addressLine1']}
                helperText={fieldErrors['billing.addressLine1']}
                required
                fullWidth
                disabled={billingSameAsShipping}
              />
              <TextField
                label="Address Line 2"
                value={
                  billingSameAsShipping ? shippingAddress.addressLine2 : billingAddress.addressLine2
                }
                onChange={(e) =>
                  !billingSameAsShipping && updateBillingField('addressLine2', e.target.value)
                }
                fullWidth
                disabled={billingSameAsShipping}
              />
              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField
                  label="City"
                  value={billingSameAsShipping ? shippingAddress.city : billingAddress.city}
                  onChange={(e) =>
                    !billingSameAsShipping && updateBillingField('city', e.target.value)
                  }
                  error={!!fieldErrors['billing.city']}
                  helperText={fieldErrors['billing.city']}
                  required
                  fullWidth
                  disabled={billingSameAsShipping}
                />
                <TextField
                  label="State/Province"
                  value={billingSameAsShipping ? shippingAddress.state : billingAddress.state}
                  onChange={(e) =>
                    !billingSameAsShipping && updateBillingField('state', e.target.value)
                  }
                  fullWidth
                  disabled={billingSameAsShipping}
                />
              </Box>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField
                  label="Postal Code"
                  value={
                    billingSameAsShipping ? shippingAddress.postalCode : billingAddress.postalCode
                  }
                  onChange={(e) =>
                    !billingSameAsShipping && updateBillingField('postalCode', e.target.value)
                  }
                  error={!!fieldErrors['billing.postalCode']}
                  helperText={fieldErrors['billing.postalCode']}
                  required
                  fullWidth
                  disabled={billingSameAsShipping}
                />
                <TextField
                  label="Country Code"
                  value={
                    billingSameAsShipping ? shippingAddress.countryCode : billingAddress.countryCode
                  }
                  onChange={(e) =>
                    !billingSameAsShipping && updateBillingField('countryCode', e.target.value)
                  }
                  error={!!fieldErrors['billing.countryCode']}
                  helperText={fieldErrors['billing.countryCode']}
                  placeholder="US"
                  required
                  fullWidth
                  disabled={billingSameAsShipping}
                />
              </Box>
              <TextField
                label="Phone"
                value={billingSameAsShipping ? shippingAddress.phone : billingAddress.phone}
                onChange={(e) =>
                  !billingSameAsShipping && updateBillingField('phone', e.target.value)
                }
                fullWidth
                disabled={billingSameAsShipping}
              />
            </Box>
          </Paper>
        </Box>

        <Box sx={{ minWidth: { xs: '100%', md: 350 } }}>
          <Paper sx={{ p: 3, position: 'sticky', top: 16 }}>
            <Typography variant="h6" gutterBottom>
              Order Summary
            </Typography>
            <Divider sx={{ my: 2 }} />

            <Box sx={{ mb: 2, maxHeight: 300, overflowY: 'auto' }}>
              {cart.items.map((item) => (
                <Card key={item.id} variant="outlined" sx={{ mb: 1 }}>
                  <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Box
                        component="img"
                        src={item.productImageUrl ?? noPhoto}
                        alt={item.productName}
                        sx={{
                          width: 50,
                          height: 50,
                          objectFit: item.productImageUrl ? 'cover' : 'none',
                          bgcolor: '#F3F4F6',
                          borderRadius: 1,
                          flexShrink: 0,
                        }}
                      />
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="body2" noWrap>
                          {item.productName}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Qty: {item.quantity} × {formatPrice(item.unitPrice, item.currency)}
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                          {formatPrice(item.lineTotal, item.currency)}
                        </Typography>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              ))}
            </Box>

            <Divider sx={{ my: 2 }} />

            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="body1">Subtotal:</Typography>
              <Typography variant="body1">
                {cart.currency ? formatPrice(cart.subtotal, cart.currency) : cart.subtotal}
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="body2" color="text.secondary">
                Tax:
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {cart.currency ? formatPrice('0.00', cart.currency) : '$0.00'}
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="body2" color="text.secondary">
                Shipping:
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {cart.currency ? formatPrice('0.00', cart.currency) : '$0.00'}
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
              variant="contained"
              fullWidth
              size="large"
              onClick={() => void handlePlaceOrder()}
              disabled={submitting}
            >
              {submitting ? <CircularProgress size={24} color="inherit" /> : 'Place Order'}
            </Button>
          </Paper>
        </Box>
      </Box>
    </Container>
  );
}
