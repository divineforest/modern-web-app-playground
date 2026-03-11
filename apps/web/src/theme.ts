import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#4F46E5',
      light: '#818CF8',
      dark: '#3730A3',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#E11D48',
      light: '#FB7185',
      dark: '#BE123C',
      contrastText: '#ffffff',
    },
    error: {
      main: '#DC2626',
    },
    warning: {
      main: '#D97706',
    },
    info: {
      main: '#0284C7',
    },
    success: {
      main: '#059669',
    },
    background: {
      default: '#FAFAF9',
      paper: '#FFFFFF',
    },
    text: {
      primary: '#1C1917',
      secondary: '#78716C',
    },
    divider: '#E7E5E4',
  },
  typography: {
    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    h1: { fontSize: '2.75rem', fontWeight: 700, letterSpacing: '-0.035em', lineHeight: 1.2 },
    h2: { fontSize: '2.125rem', fontWeight: 700, letterSpacing: '-0.025em', lineHeight: 1.25 },
    h3: { fontSize: '1.75rem', fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.3 },
    h4: { fontSize: '1.5rem', fontWeight: 600, letterSpacing: '-0.015em' },
    h5: { fontSize: '1.25rem', fontWeight: 600, letterSpacing: '-0.01em' },
    h6: { fontSize: '1.0625rem', fontWeight: 600, letterSpacing: '-0.005em' },
    body1: { fontSize: '0.9375rem', lineHeight: 1.6, letterSpacing: '0.01em' },
    body2: { fontSize: '0.875rem', lineHeight: 1.6, letterSpacing: '0.01em' },
    subtitle1: { fontWeight: 500, letterSpacing: '-0.005em' },
    subtitle2: {
      fontSize: '0.75rem',
      fontWeight: 600,
      letterSpacing: '0.06em',
      textTransform: 'uppercase' as const,
    },
    button: { fontWeight: 600, letterSpacing: '0.02em' },
    caption: { color: '#A8A29E', letterSpacing: '0.02em' },
  },
  spacing: 8,
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: '#FAFAF9',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          borderRadius: 10,
          padding: '10px 22px',
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        },
        contained: {
          boxShadow: '0 1px 3px rgba(79, 70, 229, 0.15)',
          '&:hover': {
            boxShadow: '0 4px 14px rgba(79, 70, 229, 0.35)',
            transform: 'translateY(-1px)',
          },
          '&:active': {
            transform: 'translateY(0)',
            boxShadow: '0 1px 2px rgba(79, 70, 229, 0.15)',
          },
        },
        outlined: {
          borderWidth: 1.5,
          borderColor: '#D6D3D1',
          '&:hover': {
            borderWidth: 1.5,
            borderColor: '#4F46E5',
            backgroundColor: '#EEF2FF',
          },
        },
        text: {
          '&:hover': {
            backgroundColor: '#EEF2FF',
          },
        },
        sizeLarge: {
          padding: '14px 32px',
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
          boxShadow: '0 1px 3px rgba(28, 25, 23, 0.04), 0 4px 12px rgba(28, 25, 23, 0.04)',
          borderRadius: 16,
          border: '1px solid #E7E5E4',
          transition:
            'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          '&:hover': {
            transform: 'translateY(-2px)',
            boxShadow: '0 8px 24px rgba(28, 25, 23, 0.10), 0 2px 8px rgba(28, 25, 23, 0.05)',
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
            backgroundColor: '#FAFAF9',
            transition: 'background-color 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            '& fieldset': {
              borderColor: '#D6D3D1',
              transition: 'border-color 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            },
            '&:hover': {
              backgroundColor: '#F5F5F4',
              '& fieldset': {
                borderColor: '#A8A29E',
              },
            },
            '&.Mui-focused': {
              backgroundColor: '#ffffff',
              '& fieldset': {
                borderColor: '#4F46E5',
                borderWidth: 2,
              },
            },
          },
          '& .MuiInputLabel-root.Mui-focused': {
            color: '#4F46E5',
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
          boxShadow: '0 1px 3px rgba(28, 25, 23, 0.04), 0 4px 12px rgba(28, 25, 23, 0.04)',
          border: '1px solid #E7E5E4',
        },
        elevation2: {
          boxShadow: '0 2px 8px rgba(28, 25, 23, 0.06), 0 8px 24px rgba(28, 25, 23, 0.06)',
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
          backgroundColor: '#EEF2FF',
          color: '#4F46E5',
        },
        colorSuccess: {
          backgroundColor: '#ECFDF5',
          color: '#059669',
        },
        colorWarning: {
          backgroundColor: '#FFFBEB',
          color: '#D97706',
        },
        colorError: {
          backgroundColor: '#FEF2F2',
          color: '#DC2626',
        },
        colorInfo: {
          backgroundColor: '#F0F9FF',
          color: '#0284C7',
        },
      },
    },
    MuiAccordion: {
      styleOverrides: {
        root: {
          borderRadius: '16px !important',
          border: '1px solid #E7E5E4',
          boxShadow: '0 1px 3px rgba(28, 25, 23, 0.04)',
          '&:before': {
            display: 'none',
          },
          '&.Mui-expanded': {
            boxShadow: '0 4px 12px rgba(28, 25, 23, 0.08)',
            margin: '0 0 16px 0',
          },
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
          background: 'linear-gradient(135deg, #E11D48, #BE123C)',
        },
      },
    },
    MuiPagination: {
      styleOverrides: {
        root: {
          '& .MuiPaginationItem-root': {
            borderRadius: 8,
            fontWeight: 500,
            color: '#78716C',
            '&.Mui-selected': {
              backgroundColor: '#4F46E5',
              color: '#fff',
              fontWeight: 600,
              '&:hover': {
                backgroundColor: '#3730A3',
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
          border: '1px solid #FECACA',
          '& .MuiAlert-icon': {
            color: '#DC2626',
          },
        },
        standardSuccess: {
          backgroundColor: '#F0FDF4',
          color: '#166534',
          border: '1px solid #BBF7D0',
          '& .MuiAlert-icon': {
            color: '#059669',
          },
        },
        standardWarning: {
          border: '1px solid #FDE68A',
        },
        standardInfo: {
          border: '1px solid #BAE6FD',
        },
      },
    },
    MuiDivider: {
      styleOverrides: {
        root: {
          borderColor: '#E7E5E4',
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          '&:hover': {
            backgroundColor: '#EEF2FF',
          },
        },
      },
    },
    MuiCheckbox: {
      styleOverrides: {
        root: {
          color: '#A8A29E',
          '&.Mui-checked': {
            color: '#4F46E5',
          },
        },
      },
    },
    MuiLink: {
      styleOverrides: {
        root: {
          color: '#4F46E5',
          textDecorationColor: 'rgba(79, 70, 229, 0.3)',
        },
      },
    },
  },
});
