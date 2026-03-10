import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import type { ChipPropsColorOverrides } from '@mui/material/Chip';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Container from '@mui/material/Container';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import type { OverridableStringUnion } from '@mui/types';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import noPhoto from '../assets/no-photo.svg';
import { tsr } from '../lib/api-client';

type OrderStatus =
  | 'draft'
  | 'confirmed'
  | 'processing'
  | 'shipped'
  | 'fulfilled'
  | 'paid'
  | 'cancelled'
  | 'cart';

export function OrdersPage() {
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  const {
    data,
    isPending,
    error: queryError,
    refetch,
  } = tsr.orders.listMyOrders.useQuery({
    queryKey: ['orders', 'me'],
  });

  const orders = data?.status === 200 ? data.body.orders : [];
  const error =
    queryError instanceof Error
      ? queryError.message
      : data && data.status !== 200
        ? 'Failed to fetch orders'
        : null;

  const formatPrice = (price: string, currency: string) => {
    const numericPrice = Number.parseFloat(price);
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(numericPrice);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getStatusColor = (
    status: OrderStatus
  ): OverridableStringUnion<
    'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning',
    ChipPropsColorOverrides
  > => {
    switch (status) {
      case 'draft':
        return 'default';
      case 'confirmed':
        return 'info';
      case 'processing':
        return 'warning';
      case 'shipped':
        return 'info';
      case 'fulfilled':
        return 'success';
      case 'paid':
        return 'success';
      case 'cancelled':
        return 'error';
      default:
        return 'default';
    }
  };

  const handleAccordionChange = (orderId: string) => {
    setExpandedOrderId((prev) => (prev === orderId ? null : orderId));
  };

  const parseAddress = (addressJson: string | null) => {
    if (!addressJson) return null;
    try {
      return JSON.parse(addressJson);
    } catch {
      return null;
    }
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

  if (error) {
    return (
      <Container maxWidth="lg">
        <Box sx={{ mt: 4 }}>
          <Alert severity="error">{error}</Alert>
          <Button onClick={() => refetch()} variant="contained" sx={{ mt: 2 }}>
            Retry
          </Button>
        </Box>
      </Container>
    );
  }

  if (!orders || orders.length === 0) {
    return (
      <Container maxWidth="lg">
        <Box sx={{ mt: 4, textAlign: 'center' }}>
          <Typography variant="h5" gutterBottom>
            You haven't placed any orders yet
          </Typography>
          <Button component={Link} to="/" variant="contained" sx={{ mt: 2 }}>
            Browse Products
          </Button>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        My Orders
      </Typography>

      {orders.map((order) => {
        const shippingAddress = parseAddress(order.shippingAddress);

        return (
          <Accordion
            key={order.id}
            expanded={expandedOrderId === order.id}
            onChange={() => handleAccordionChange(order.id)}
            sx={{ mb: 2 }}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  width: '100%',
                  pr: 2,
                }}
              >
                <Box>
                  <Typography variant="h6">Order {order.orderNumber}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {formatDate(order.orderDate)}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Typography variant="h6">
                    {formatPrice(order.totalAmount, order.currency)}
                  </Typography>
                  <Chip label={order.status} color={getStatusColor(order.status as OrderStatus)} />
                </Box>
              </Box>
            </AccordionSummary>

            <AccordionDetails>
              <Box>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Order Items
                </Typography>

                {order.items.length === 0 ? (
                  <Typography variant="body2" sx={{ mb: 2 }}>
                    No items found for this order.
                  </Typography>
                ) : (
                  order.items.map((item) => (
                    <Card key={item.id} variant="outlined" sx={{ mb: 1 }}>
                      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                        <Box sx={{ display: 'flex', gap: 2 }}>
                          <Box
                            component="img"
                            src={item.productImageUrl ?? noPhoto}
                            alt={item.productName}
                            sx={{
                              width: 60,
                              height: 60,
                              objectFit: item.productImageUrl ? 'cover' : 'none',
                              bgcolor: '#F3F4F6',
                              borderRadius: 1,
                              flexShrink: 0,
                            }}
                          />
                          <Box sx={{ flex: 1 }}>
                            <Typography variant="body1">{item.productName}</Typography>
                            <Typography variant="body2" color="text.secondary">
                              SKU: {item.productSku}
                            </Typography>
                            <Typography variant="body2">
                              Quantity: {item.quantity} ×{' '}
                              {formatPrice(item.unitPrice, item.currency)}
                            </Typography>
                          </Box>
                          <Typography
                            variant="body1"
                            sx={{ fontWeight: 'bold', alignSelf: 'center' }}
                          >
                            {formatPrice(item.lineTotal, item.currency)}
                          </Typography>
                        </Box>
                      </CardContent>
                    </Card>
                  ))
                )}

                <Divider sx={{ my: 2 }} />

                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body1">Subtotal:</Typography>
                  <Typography variant="body1">
                    {formatPrice(order.subtotal, order.currency)}
                  </Typography>
                </Box>

                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    Tax:
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {formatPrice(order.taxAmount, order.currency)}
                  </Typography>
                </Box>

                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    Shipping:
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {formatPrice(order.shippingAmount, order.currency)}
                  </Typography>
                </Box>

                {order.discountAmount && Number.parseFloat(order.discountAmount) > 0 && (
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      Discount:
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      -{formatPrice(order.discountAmount, order.currency)}
                    </Typography>
                  </Box>
                )}

                <Divider sx={{ my: 2 }} />

                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
                  <Typography variant="h6">Total:</Typography>
                  <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                    {formatPrice(order.totalAmount, order.currency)}
                  </Typography>
                </Box>

                {shippingAddress && (
                  <>
                    <Divider sx={{ my: 2 }} />
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      Shipping Address
                    </Typography>
                    <Typography variant="body2">{shippingAddress.fullName}</Typography>
                    <Typography variant="body2">{shippingAddress.addressLine1}</Typography>
                    {shippingAddress.addressLine2 && (
                      <Typography variant="body2">{shippingAddress.addressLine2}</Typography>
                    )}
                    <Typography variant="body2">
                      {shippingAddress.city}
                      {shippingAddress.state && `, ${shippingAddress.state}`}{' '}
                      {shippingAddress.postalCode}
                    </Typography>
                    <Typography variant="body2">{shippingAddress.countryCode}</Typography>
                    {shippingAddress.phone && (
                      <Typography variant="body2">{shippingAddress.phone}</Typography>
                    )}
                  </>
                )}

                {order.paymentTransactionId && (
                  <>
                    <Divider sx={{ my: 2 }} />
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      Payment
                    </Typography>
                    <Typography variant="body2">
                      Transaction ID: {order.paymentTransactionId}
                    </Typography>
                  </>
                )}

                {order.expectedDeliveryDate && (
                  <>
                    <Divider sx={{ my: 2 }} />
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      Timeline
                    </Typography>
                    <Typography variant="body2">
                      Expected Delivery: {formatDate(order.expectedDeliveryDate)}
                    </Typography>
                  </>
                )}
              </Box>
            </AccordionDetails>
          </Accordion>
        );
      })}
    </Container>
  );
}
