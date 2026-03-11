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
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* Sticky frosted-glass header */}
      <Box
        component="header"
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: 1100,
          backgroundColor: 'rgba(255, 255, 255, 0.92)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Container maxWidth="lg">
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              height: 64,
              gap: 3,
            }}
          >
            {/* Logo */}
            <Typography
              variant="h5"
              component={Link}
              to="/"
              sx={{
                textDecoration: 'none',
                fontWeight: 800,
                letterSpacing: '-0.04em',
                color: 'primary.main',
                flexShrink: 0,
                transition: 'opacity 0.15s ease',
                '&:hover': {
                  opacity: 0.8,
                },
              }}
            >
              Mercado
            </Typography>

            {/* Search */}
            <Box component="form" onSubmit={handleSearchSubmit} sx={{ flex: 1, maxWidth: 480 }}>
              <TextField
                name="q"
                placeholder="Search products..."
                size="small"
                fullWidth
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search sx={{ color: 'text.secondary', fontSize: 18 }} />
                    </InputAdornment>
                  ),
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '50px',
                  },
                }}
              />
            </Box>

            {/* Actions */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: 'auto' }}>
              {user ? (
                <>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      px: 1.5,
                      py: 0.5,
                      borderRadius: 2,
                      bgcolor: '#F8FAFC',
                      border: '1px solid',
                      borderColor: 'divider',
                    }}
                  >
                    <AccountCircle sx={{ color: 'primary.main', fontSize: 20 }} />
                    <Typography variant="body2" fontWeight={500} color="text.primary">
                      {user.firstName} {user.lastName}
                    </Typography>
                  </Box>
                  <Button variant="text" component={Link} to="/orders" size="small">
                    My Orders
                  </Button>
                  <Button variant="outlined" onClick={handleLogout} size="small">
                    Logout
                  </Button>
                </>
              ) : (
                <Button variant="contained" component={Link} to="/login" size="small">
                  Sign in
                </Button>
              )}

              <IconButton component={Link} to="/cart" color="primary" size="medium">
                <Badge badgeContent={itemCount} color="error">
                  <ShoppingCart />
                </Badge>
              </IconButton>
            </Box>
          </Box>
        </Container>
      </Box>

      {/* Page content */}
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Outlet />
      </Container>
    </Box>
  );
}
