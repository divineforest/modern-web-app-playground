import { Outlet } from 'react-router-dom';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';

export function RootLayout() {
  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h3" component="h1" gutterBottom sx={{ mb: 4 }}>
        Mercado
      </Typography>
      <Outlet />
    </Container>
  );
}
