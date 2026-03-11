import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#2563EB',
      light: '#60A5FA',
      dark: '#1E40AF',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#F97316',
      light: '#FB923C',
      dark: '#EA580C',
      contrastText: '#ffffff',
    },
    error: {
      main: '#EF4444',
    },
    warning: {
      main: '#F59E0B',
    },
    info: {
      main: '#0EA5E9',
    },
    success: {
      main: '#10B981',
    },
    background: {
      default: '#F8FAFC',
      paper: '#FFFFFF',
    },
    text: {
      primary: '#0F172A',
      secondary: '#64748B',
    },
    divider: '#E2E8F0',
  },
  typography: {
    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    h1: { fontSize: '2.5rem', fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.2 },
    h2: { fontSize: '2rem', fontWeight: 700, letterSpacing: '-0.025em', lineHeight: 1.25 },
    h3: { fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.3 },
    h4: { fontSize: '1.5rem', fontWeight: 600, letterSpacing: '-0.015em' },
    h5: { fontSize: '1.25rem', fontWeight: 600, letterSpacing: '-0.01em' },
    h6: { fontSize: '1.125rem', fontWeight: 600, letterSpacing: '-0.005em' },
    body1: { fontSize: '0.9375rem', lineHeight: 1.6 },
    body2: { fontSize: '0.875rem', lineHeight: 1.6 },
    subtitle1: { fontWeight: 500, letterSpacing: '-0.005em' },
    subtitle2: { fontWeight: 500 },
    button: { fontWeight: 600, letterSpacing: '0.01em' },
    caption: { color: '#94A3B8' },
  },
  spacing: 8,
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: '#F8FAFC',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          borderRadius: 10,
          padding: '8px 20px',
          transition: 'all 0.15s ease',
        },
        contained: {
          boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
          '&:hover': {
            boxShadow: '0 4px 14px rgba(37, 99, 235, 0.4)',
            transform: 'translateY(-1px)',
          },
          '&:active': {
            transform: 'translateY(0)',
            boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
          },
        },
        outlined: {
          borderColor: '#E2E8F0',
          '&:hover': {
            borderColor: '#2563EB',
            backgroundColor: '#EFF6FF',
          },
        },
        text: {
          '&:hover': {
            backgroundColor: '#EFF6FF',
          },
        },
        sizeLarge: {
          padding: '12px 28px',
          fontSize: '1rem',
          borderRadius: 12,
        },
        sizeSmall: {
          padding: '5px 14px',
          fontSize: '0.8125rem',
          borderRadius: 8,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.04)',
          borderRadius: 16,
          border: '1px solid #F1F5F9',
          transition: 'transform 0.2s ease, box-shadow 0.2s ease',
          '&:hover': {
            transform: 'translateY(-4px)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.05)',
          },
        },
      },
    },
    MuiCardContent: {
      styleOverrides: {
        root: {
          '&:last-child': {
            paddingBottom: 16,
          },
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 10,
            backgroundColor: '#F8FAFC',
            transition: 'background-color 0.15s ease',
            '& fieldset': {
              borderColor: '#E2E8F0',
              transition: 'border-color 0.15s ease',
            },
            '&:hover': {
              backgroundColor: '#F1F5F9',
              '& fieldset': {
                borderColor: '#94A3B8',
              },
            },
            '&.Mui-focused': {
              backgroundColor: '#ffffff',
              '& fieldset': {
                borderColor: '#2563EB',
                borderWidth: 2,
              },
            },
          },
          '& .MuiInputLabel-root.Mui-focused': {
            color: '#2563EB',
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          backgroundImage: 'none',
        },
        elevation1: {
          boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.04)',
        },
        elevation2: {
          boxShadow: '0 2px 8px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.06)',
        },
        elevation0: {
          boxShadow: 'none',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 500,
          borderRadius: 8,
          fontSize: '0.8125rem',
        },
        colorPrimary: {
          backgroundColor: '#EFF6FF',
          color: '#2563EB',
        },
      },
    },
    MuiBadge: {
      styleOverrides: {
        badge: {
          fontWeight: 700,
          fontSize: '0.6875rem',
          minWidth: 18,
          height: 18,
        },
      },
    },
    MuiPagination: {
      styleOverrides: {
        root: {
          '& .MuiPaginationItem-root': {
            borderRadius: 8,
            fontWeight: 500,
            color: '#64748B',
            '&.Mui-selected': {
              backgroundColor: '#2563EB',
              color: '#fff',
              fontWeight: 600,
              '&:hover': {
                backgroundColor: '#1E40AF',
              },
            },
          },
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          fontWeight: 500,
        },
        standardError: {
          backgroundColor: '#FEF2F2',
          color: '#991B1B',
          '& .MuiAlert-icon': {
            color: '#EF4444',
          },
        },
        standardSuccess: {
          backgroundColor: '#F0FDF4',
          color: '#166534',
          '& .MuiAlert-icon': {
            color: '#10B981',
          },
        },
      },
    },
    MuiDivider: {
      styleOverrides: {
        root: {
          borderColor: '#E2E8F0',
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          transition: 'all 0.15s ease',
          '&:hover': {
            backgroundColor: '#EFF6FF',
          },
        },
      },
    },
  },
});
