import { Link, Outlet } from 'react-router-dom';
import ShoppingCart from '@mui/icons-material/ShoppingCart';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';

export function RootLayout() {
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
        <IconButton component={Link} to="/cart" color="primary" size="large">
          <ShoppingCart />
        </IconButton>
      </Box>
      <Outlet />
    </Container>
  );
}
