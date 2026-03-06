import AccountCircle from '@mui/icons-material/AccountCircle';
import Search from '@mui/icons-material/Search';
import ShoppingCart from '@mui/icons-material/ShoppingCart';
import Badge from '@mui/material/Badge';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/auth-context';
import { useCart } from '../contexts/cart-context';

export function RootLayout() {
  const { itemCount } = useCart();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
  };

  const handleSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const query = formData.get('q')?.toString().trim();
    if (query && query.length >= 2) {
      navigate(`/search?q=${encodeURIComponent(query)}&sort=relevance`);
    }
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

        <Box
          component="form"
          onSubmit={handleSearchSubmit}
          sx={{ display: 'flex', alignItems: 'center', flex: 1, maxWidth: 400, mx: 4 }}
        >
          <TextField
            name="q"
            placeholder="Search products..."
            size="small"
            fullWidth
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search />
                </InputAdornment>
              ),
            }}
          />
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {user ? (
            <>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <AccountCircle />
                <Typography variant="body1">
                  {user.firstName} {user.lastName}
                </Typography>
              </Box>
              <Button variant="text" component={Link} to="/orders">
                My Orders
              </Button>
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
