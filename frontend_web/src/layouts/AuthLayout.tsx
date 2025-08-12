import { ReactNode } from 'react';
import { Container, Paper, Typography, Box, GlobalStyles } from '@mui/material';
import AnimatedBackground from '../components/AnimatedBackground';

interface AuthLayoutProps {
  children: ReactNode;
  title: string;
  maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | false;
}

export default function AuthLayout({ children, title, maxWidth = 'sm' }: AuthLayoutProps) {
  return (
    <>
      <GlobalStyles
        styles={{
          'html, body, #root': {
            margin: 0,
            padding: 0,
            height: '100%',
            width: '100%',
            overflow: 'auto',
            fontFamily: '"Bai Jamjuree", "Helvetica", "Arial", sans-serif',
          },
        }}
      />
      <Box
        sx={{
          position: 'relative',
          width: '100%',
          minHeight: '100vh',       // viewport height so scrolling behaves
          overflowY: 'auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <AnimatedBackground />
        <Container
          maxWidth={maxWidth}       // <-- use the prop here
          sx={{ position: 'relative', zIndex: 2, py: { xs: 4, md: 6 } }}
        >
          <Paper
            elevation={6}
            sx={{
              p: { xs: 3, sm: 4 },
              borderRadius: 3,
              width: '100%',
              bgcolor: 'rgba(255, 255, 255, 0.9)',
              backdropFilter: 'blur(10px)',
            }}
          >
            <Typography variant="h4" textAlign="center" mb={3} fontWeight={700}>
              {title}
            </Typography>
            {children}
          </Paper>
        </Container>
      </Box>
    </>
  );
}
