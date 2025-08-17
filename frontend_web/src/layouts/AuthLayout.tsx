import { ReactNode, useMemo } from 'react';
import {
  Container,
  Paper,
  Typography,
  Box,
  GlobalStyles,
  ThemeProvider,
  CssBaseline,
  createTheme,
} from '@mui/material';
import AnimatedBackground from '../components/AnimatedBackground';

interface AuthLayoutProps {
  children: ReactNode;
  title: string;
  maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | false;
}

export default function AuthLayout({ children, title, maxWidth = 'sm' }: AuthLayoutProps) {
  // 🔒 Local, hard-light theme ONLY for auth pages (doesn't affect dashboards)
  const authTheme = useMemo(
    () =>
      createTheme({
        palette: {
          mode: 'light',
          background: { default: '#ffffff', paper: '#ffffff' },
          text: { primary: '#0f172a', secondary: '#475569' },
          divider: '#e2e8f0',
          primary: { main: '#00a99d' }, // matches your brand buttons on auth pages
        },
        shape: { borderRadius: 12 },
        components: {
          MuiCssBaseline: {
            styleOverrides: {
              ':root': { colorScheme: 'light' }, // ignore OS/dark prefs here
              html: { backgroundColor: '#ffffff' },
              body: { backgroundColor: '#ffffff', color: '#0f172a' },
              '#root': { backgroundColor: '#ffffff' },
            },
          },
          MuiPaper: {
            defaultProps: { elevation: 6 },
            styleOverrides: {
              root: {
                border: 'none',
                backgroundImage: 'none',
                borderRadius: 12,
              },
            },
          },
        },
        typography: {
          fontFamily: '"Bai Jamjuree","Inter","Helvetica","Arial",sans-serif',
        },
      }),
    []
  );

  return (
    <ThemeProvider theme={authTheme}>
      <CssBaseline />
      <GlobalStyles
        styles={{
          'html, body, #root': {
            height: '100%',
            width: '100%',
            overflow: 'auto',
          },
        }}
      />

      <Box
        sx={{
          position: 'relative',
          width: '100%',
          minHeight: '100vh',
          bgcolor: 'background.default', // pure white
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          py: { xs: 4, md: 6 },
        }}
      >
        {/* ✅ Keep your animated background (no overlays, no removal) */}
        <AnimatedBackground />

        <Container
          maxWidth={maxWidth}
          sx={{ position: 'relative', zIndex: 2 }}
        >
          <Paper
            sx={{
              p: { xs: 3, sm: 4 },
              width: '100%',
              // a bright “glass” card that stays white on top of animation
              bgcolor: 'rgba(255,255,255,0.96)',
              backdropFilter: 'blur(10px)',
            }}
          >
            <Typography
              variant="h4"
              textAlign="center"
              mb={3}
              fontWeight={700}
              sx={{ color: 'text.primary' }}
            >
              {title}
            </Typography>
            {children}
          </Paper>
        </Container>
      </Box>
    </ThemeProvider>
  );
}
