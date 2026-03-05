import AccountCircle from '@mui/icons-material/AccountCircle';
import ShoppingCart from '@mui/icons-material/ShoppingCart';
import Badge from '@mui/material/Badge';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import { Link, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/auth-context';
import { useCart } from '../contexts/cart-context';

export function RootLayout() {
  const { itemCount } = useCart();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 4,
        }}
      >
        <Typography
          variant="h3"
          component={Link}
          to="/"
          sx={{
            textDecoration: 'none',
            color: 'inherit',
            '&:hover': {
              color: 'primary.main',
            },
          }}
        >
          Mercado
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {user ? (
            <>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <AccountCircle />
                <Typography variant="body1">
                  {user.firstName} {user.lastName}
                </Typography>
              </Box>
              <Button variant="outlined" onClick={handleLogout}>
                Logout
              </Button>
            </>
          ) : (
            <Button variant="outlined" component={Link} to="/login">
              Login
            </Button>
          )}

          <IconButton component={Link} to="/cart" color="primary" size="large">
            <Badge badgeContent={itemCount} color="error">
              <ShoppingCart />
            </Badge>
          </IconButton>
        </Box>
      </Box>
      <Outlet />
    </Container>
  );
}
