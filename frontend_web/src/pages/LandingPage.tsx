import { useEffect, useRef, useState } from 'react';
import {
  AppBar,
  Box,
  Button,
  Container,
  CssBaseline,
  IconButton,
  Menu,
  MenuItem,
  ThemeProvider,
  Toolbar,
  Typography,
  createTheme,
  styled,
  Modal,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import * as THREE from 'three';
import confetti from 'canvas-confetti';
import YouTube from 'react-youtube';
import appIcon from '../assets/20250711_1205_Chemisttasker Badge Design_remix_01jzwbh9q5ez49phsbaz65h9cd.png';
import logoBanner from '../assets/logo-banner.jpg';

// --- Constants ---
const PAGE_ROUTES = {
  login: '/login',
  register: '/register',
  publicJobBoard: '/shifts/public-board',
};

// --- Theme and Global Styles ---
const theme = createTheme({
  palette: {
    primary: {
      main: '#00a99d',
    },
    secondary: {
      main: '#c724b1',
    },
    text: {
      primary: '#344767',
      secondary: '#0d1a2e',
    },
    background: {
      default: '#f8f9fa',
      paper: '#ffffff',
    },
  },
  typography: {
    fontFamily: "'Inter', sans-serif",
    h1: {
      fontWeight: 800,
      color: '#0d1a2e',
    },
    h2: {
      fontWeight: 700,
      color: '#0d1a2e',
    },
    h3: {
      fontWeight: 700,
      color: '#0d1a2e',
    },
    h4: {
      fontWeight: 700,
      color: '#0d1a2e',
    },
  },
});

// --- Styled Components ---
const CtaButton = styled(Button)(({ theme }) => ({
  transition: 'all 0.3s ease',
  boxShadow: `0 4px 6px rgba(0, 0, 0, 0.1), 0 10px 20px ${theme.palette.primary.main}33`,
  backgroundColor: theme.palette.primary.main,
  color: 'white',
  borderRadius: '8px',
  fontWeight: 600,
  '&:hover': {
    backgroundColor: theme.palette.primary.dark,
    transform: 'translateY(-5px) scale(1.05)',
    boxShadow: `0 7px 14px rgba(0, 0, 0, 0.1), 0 15px 30px ${theme.palette.primary.main}4D`,
  },
}));

const SecondaryCtaButton = styled(Button)(({ theme }) => ({
  border: `1px solid #e2e8f0`,
  transition: 'all 0.3s ease',
  color: theme.palette.text.primary,
  borderRadius: '8px',
  fontWeight: 600,
  '&:hover': {
    backgroundColor: '#f1f5f9',
    transform: 'translateY(-3px)',
    borderColor: '#cbd5e1',
  },
}));

const FeatureCard = styled(Box)({
  backgroundColor: 'white',
  borderRadius: '1.5rem',
  border: '1px solid #e2e8f0',
  transition: 'all 0.3s ease',
  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
  height: '100%',
  textAlign: 'center',
  padding: '2rem',
  '&:hover': {
    transform: 'translateY(-10px)',
    boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
  },
});

// --- Main LandingPage Component ---
function LandingPage() {
  const [anchorElNav, setAnchorElNav] = useState<null | HTMLElement>(null);

  const handleOpenNavMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorElNav(event.currentTarget);
  };

  const handleCloseNavMenu = () => {
    setAnchorElNav(null);
  };

  const handleNavClick = (anchor: string) => {
    document.querySelector(anchor)?.scrollIntoView({ behavior: 'smooth' });
    handleCloseNavMenu();
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />

      {/* Header */}
      <AppBar position="sticky" sx={{ bgcolor: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(10px)', boxShadow: 'none', borderBottom: '1px solid #e2e8f0' }}>
        <Container maxWidth="xl">
          <Toolbar disableGutters sx={{ justifyContent: 'space-between' }}>
            <a href="/" style={{ display: 'flex', alignItems: 'center' }}>
              <img src={logoBanner} alt="ChemistTaskerRx Logo" style={{ height: '48px', width: 'auto' }} />
            </a>

            {/* Desktop Menu */}
            <Box sx={{ flexGrow: 1, display: { xs: 'none', md: 'flex' }, justifyContent: 'flex-end', alignItems: 'center', gap: 4 }}>
              <Button onClick={() => handleNavClick('#automation-flow')} sx={{ color: 'text.primary', fontWeight: 500 }}>How It Works</Button>
              <Button onClick={() => handleNavClick('#for-who')} sx={{ color: 'text.primary', fontWeight: 500 }}>For Who?</Button>
              <Button href={PAGE_ROUTES.login} sx={{ color: 'text.primary', fontWeight: 500 }}>Login</Button>
              <CtaButton href={PAGE_ROUTES.register} variant="contained" size="small" sx={{ px: 2.5, py: 1 }}>Sign Up</CtaButton>
            </Box>

            {/* Mobile Menu */}
            <Box sx={{ flexGrow: 1, display: { xs: 'flex', md: 'none' }, justifyContent: 'flex-end' }}>
              <IconButton size="large" onClick={handleOpenNavMenu} color="inherit">
                <MenuIcon sx={{ color: 'text.primary' }} />
              </IconButton>
              <Menu
                anchorEl={anchorElNav}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                keepMounted
                transformOrigin={{ vertical: 'top', horizontal: 'left' }}
                open={Boolean(anchorElNav)}
                onClose={handleCloseNavMenu}
                sx={{ display: { xs: 'block', md: 'none' } }}
              >
                <MenuItem onClick={() => handleNavClick('#automation-flow')}><Typography>How It Works</Typography></MenuItem>
                <MenuItem onClick={() => handleNavClick('#for-who')}><Typography>For Who?</Typography></MenuItem>
                <MenuItem component="a" href={PAGE_ROUTES.login}><Typography>Login</Typography></MenuItem>
                <MenuItem component="a" href={PAGE_ROUTES.register}>
                  <CtaButton variant="contained" fullWidth>Sign Up</CtaButton>
                </MenuItem>
              </Menu>
            </Box>
          </Toolbar>
        </Container>
      </AppBar>

      {/* Main Content */}
      <main>
        {/* Hero Section */}
        <HeroSection />

        {/* Automation Flow Section with Pop-in Video */}
        <AutomationFlowSection />

        {/* For Who Section */}
        <ForWhoSection />

        {/* Final CTA Section */}
        <FinalCTASection />
      </main>

      {/* Footer */}
      <Box component="footer" sx={{ bgcolor: '#e9ecef', py: 4, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          &copy; {new Date().getFullYear()} ChemistTasker Pty Ltd. All rights reserved.
        </Typography>
      </Box>
    </ThemeProvider>
  );
}

// --- Hero Section ---
const HeroSection = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    let scene: THREE.Scene, camera: THREE.PerspectiveCamera, renderer: THREE.WebGLRenderer, network: THREE.Group;
    let mouseX = 0;
    const heroSection = canvasRef.current.parentElement as HTMLElement;

    const init = () => {
      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(60, heroSection.offsetWidth / heroSection.offsetHeight, 1, 2000);
      camera.position.z = 500;

      renderer = new THREE.WebGLRenderer({ canvas: canvasRef.current!, antialias: true, alpha: true });
      renderer.setSize(heroSection.offsetWidth, heroSection.offsetHeight);
      renderer.setClearColor(0xffffff, 0);

      network = new THREE.Group();
      scene.add(network);

      const nodeGeometry = new THREE.SphereGeometry(4, 16, 16);
      const nodeMaterial = new THREE.MeshBasicMaterial({ color: 0x00a99d });
      const nodes: THREE.Mesh[] = [];
      for (let i = 0; i < 50; i++) {
        const node = new THREE.Mesh(nodeGeometry, nodeMaterial);
        node.position.set(
          (Math.random() - 0.5) * 1000,
          (Math.random() - 0.5) * 1000,
          (Math.random() - 0.5) * 1000
        );
        network.add(node);
        nodes.push(node);
      }
      const lineMaterial = new THREE.LineBasicMaterial({ color: 0x00a99d, transparent: true, opacity: 0.1 });
      const pulseMaterial = new THREE.MeshBasicMaterial({ color: 0xc724b1 });
      const pulseGeometry = new THREE.SphereGeometry(2, 8, 8);
      nodes.forEach(startNode => {
        const endNode = nodes[Math.floor(Math.random() * nodes.length)];
        if (startNode === endNode) return;

        const points = [startNode.position, endNode.position];
        const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);
        const line = new THREE.Line(lineGeometry, lineMaterial);
        network.add(line);

        if (Math.random() > 0.8) {
          const pulse = new THREE.Mesh(pulseGeometry, pulseMaterial);
          Object.assign(pulse.userData, {
            start: startNode.position,
            end: endNode.position,
            progress: Math.random()
          });
          network.add(pulse);
        }
      });

      const onMouseMove = (event: MouseEvent) => {
        mouseX = (event.clientX / window.innerWidth) * 2 - 1;
      };

      const onWindowResize = () => {
        camera.aspect = heroSection.offsetWidth / heroSection.offsetHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(heroSection.offsetWidth, heroSection.offsetHeight);
      };

      document.addEventListener('mousemove', onMouseMove);
      window.addEventListener('resize', onWindowResize);

      let animationFrameId: number;
      const animate = () => {
        animationFrameId = requestAnimationFrame(animate);
        network.rotation.y += 0.0005 + (mouseX * 0.001);

        network.children.forEach((child: THREE.Object3D) => {
          if (child.userData.start) {
            child.userData.progress = (child.userData.progress + 0.01) % 1;
            child.position.lerpVectors(child.userData.start, child.userData.end, child.userData.progress);
          }
        });

        renderer.render(scene, camera);
      };

      animate();

      return () => {
        cancelAnimationFrame(animationFrameId);
        document.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('resize', onWindowResize);
        renderer.dispose();
      };
    };

    const cleanup = init();
    return cleanup;
  }, []);

  return (
    <Box
      component="section"
      sx={{
        position: 'relative',
        minHeight: '90vh',
        display: 'flex',
        alignItems: 'center',
        overflow: 'hidden',
        bgcolor: 'background.paper',
      }}
    >
      <Box
        component="canvas"
        ref={canvasRef}
        sx={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 1 }}
      />
<Container sx={{ position: 'relative', zIndex: 2, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '90vh' }}>
  <Box
    sx={{
      px: { xs: 2, sm: 6, md: 10 },
      py: { xs: 4, sm: 6, md: 8 },
      borderRadius: 6,
      bgcolor: 'rgba(255,255,255,0.82)',
      boxShadow: '0 8px 32px 0 rgba(31,38,135,0.18)',
      border: '1.5px solid rgba(255,255,255,0.32)',
      backdropFilter: 'blur(18px)',
      WebkitBackdropFilter: 'blur(18px)',
      maxWidth: 900,
      width: { xs: '98%', sm: '95%', md: '85%' }, 
      textAlign: 'center',
    }}
  >
    <Typography variant="h1" component="h1" sx={{ mb: 2, fontSize: { xs: '2.5rem', md: '3.75rem' } }}>
      Your Roster, Automated.
    </Typography>
    <Typography variant="h6" color="text.primary" component="p" sx={{ mb: 4, fontWeight: 400 }}>
      Stop chasing staff. Link your roster to ChemistTasker and let our AI instantly alert your team, your preferred locums, and the wider marketplace when a shift needs filling.
    </Typography>
    <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'center', gap: 2 }}>
      <CtaButton href={PAGE_ROUTES.register} sx={{ px: 4, py: 1.5, fontSize: '1.1rem' }}>
        Automate My Staffing
      </CtaButton>
      <SecondaryCtaButton href={PAGE_ROUTES.publicJobBoard} sx={{ px: 4, py: 1.5, fontSize: '1.1rem' }}>
        Find a Flexible Shift
      </SecondaryCtaButton>
    </Box>
  </Box>
</Container>

    </Box>
  );
};


// --- AutomationFlowSection With Video Pop-In ---
const slidesData = [
  {
    step: "Step 1",
    title: "Roster Link",
    description: "ChemistTasker detects an open shift the moment it appears in your connected rostering software. The automation begins instantly.",
    videoId: "dQw4w9WgXcQ"
  },
  {
    step: "Step 2",
    title: "Internal Team Alert",
    description: "A notification is sent to your own staff first. Give your team the first opportunity to fill the shift, boosting morale and engagement.",
    videoId: "dQw4w9WgXcQ"
  },
  {
    step: "Step 3",
    title: "Preferred Locums",
    description: "If the shift remains unfilled, your hand-picked list of trusted, favorite locums are automatically notified. No manual calls needed.",
    videoId: "dQw4w9WgXcQ"
  },
  {
    step: "Step 4",
    title: "Marketplace Escalation",
    description: "As a final step, the shift is broadcast to our wider, verified public marketplace to guarantee it gets seen and filled. Total peace of mind.",
    videoId: "dQw4w9WgXcQ"
  },
  {
    img: "https://i.ibb.co/8Y4B0W0/WhatsApp-Image-2025-05-24-at-13-01-53-7ae3ec8e.jpg",
    title: "Shift Filled!",
    description: "Your roster is complete, your pharmacy is covered, and you didn't lift a finger. That's the power of automation.",
    videoId: null
  }
];

const AutomationFlowSection = () => {
  const carouselRef = useRef<HTMLDivElement>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [videoOpenIndex, setVideoOpenIndex] = useState<number | null>(null);

  useEffect(() => {
    if (currentIndex === slidesData.length - 1) {
      confetti({ particleCount: 150, spread: 90, origin: { y: 0.6 }, colors: ['#00a99d', '#c724b1', '#ffffff'] });
    }
  }, [currentIndex]);

  const handleNext = () => setCurrentIndex(prev => (prev + 1) % slidesData.length);
  const handlePrev = () => setCurrentIndex(prev => (prev - 1 + slidesData.length) % slidesData.length);
  const handleOpenVideo = (i: number) => setVideoOpenIndex(i);
  const handleCloseVideo = () => setVideoOpenIndex(null);

  const anglePerSlide = 360 / slidesData.length;
  const radius = 400;

  return (
    <Box id="automation-flow" component="section" sx={{ py: { xs: 10, md: 16 }, bgcolor: 'background.paper', overflow: 'hidden' }}>
      <Container>
        <Box sx={{ textAlign: 'center', mb: 8 }}>
          <Typography variant="h2" component="h2">From Open Shift to Filled. Instantly.</Typography>
          <Typography color="text.primary" sx={{ mt: 2, maxWidth: '45rem', mx: 'auto' }}>
            Our smart-escalation engine works like a tireless co-pilot for your pharmacy. Use the arrows to explore the steps.
          </Typography>
        </Box>
        <Box sx={{
          position: 'relative',
          height: '500px',
          perspective: '2000px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <Box ref={carouselRef} sx={{
            width: '320px',
            height: '400px',
            position: 'absolute',
            transformStyle: 'preserve-3d',
            transition: 'transform 1s cubic-bezier(0.77, 0, 0.175, 1)',
            transform: `rotateY(${-currentIndex * anglePerSlide}deg)`
          }}>
            {slidesData.map((slide, i) => (
              <Box key={i} sx={{
                position: 'absolute',
                left: 0,
                top: 0,
                width: '320px',
                height: '400px',
                background: 'white',
                borderRadius: '1.5rem',
                boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '2rem',
                textAlign: 'center',
                backfaceVisibility: 'hidden',
                transform: `rotateY(${i * anglePerSlide}deg) translateZ(${radius}px)`
              }}>
                {slide.step && (
                  <Box component="span" sx={{ display: 'inline-block', px: 1.5, py: 0.5, borderRadius: '99px', fontSize: '0.8rem', fontWeight: 600, mb: 3, color: 'primary.main', bgcolor: 'rgba(0, 169, 157, 0.1)' }}>
                    {slide.step}
                  </Box>
                )}
                {slide.img && <img src={slide.img} alt="Mascot" style={{ height: 96, marginBottom: 16 }} />}
                <Typography variant="h5" component="h3" sx={{ fontWeight: 700, color: slide.img ? 'primary.main' : 'text.secondary', mb: 1.5 }}>{slide.title}</Typography>
                <Typography variant="body2">{slide.description}</Typography>

                {/* VIDEO BUTTON */}
                {slide.videoId && (
                  <Box sx={{ mt: 3 }}>
                    <IconButton
                      onClick={() => handleOpenVideo(i)}
                      color="primary"
                      sx={{ border: '2px solid #00a99d', borderRadius: '50%', p: 2, background: '#f3fefd', mb: 1 }}
                      aria-label="Play Illustration Video"
                    >
                      <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                        <circle cx="16" cy="16" r="16" fill="#00a99d" />
                        <polygon points="13,11 23,16 13,21" fill="#fff" />
                      </svg>
                    </IconButton>
                    <Typography variant="caption" color="textSecondary">Watch how this step works</Typography>
                  </Box>
                )}
              </Box>
            ))}
          </Box>
          {/* Carousel Navigation */}
          <IconButton onClick={handlePrev} sx={{ position: 'absolute', left: { xs: -10, sm: 0, md: 50 }, zIndex: 10 }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 18l-6-6 6-6" /></svg>
          </IconButton>
          <IconButton onClick={handleNext} sx={{ position: 'absolute', right: { xs: -10, sm: 0, md: 50 }, zIndex: 10 }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 18l6-6-6-6" /></svg>
          </IconButton>
        </Box>
      </Container>

      {/* --- Video Modal Popup --- */}
      <Modal open={videoOpenIndex !== null} onClose={handleCloseVideo} closeAfterTransition>
        <Box sx={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: { xs: '90vw', sm: 560 },
          bgcolor: 'background.paper',
          boxShadow: 24,
          p: 2,
          outline: 'none',
          borderRadius: 2,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center'
        }}>
          <IconButton
            onClick={handleCloseVideo}
            sx={{ alignSelf: 'flex-end', mb: 1 }}
            aria-label="Close Video"
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path d="M6 6l12 12M6 18L18 6" stroke="#344767" strokeWidth="2.5" />
            </svg>
          </IconButton>
          {videoOpenIndex !== null && (
            <YouTube
              videoId={slidesData[videoOpenIndex].videoId!}
              opts={{
                width: '480',
                height: '270',
                playerVars: { autoplay: 1 }
              }}
            />
          )}
        </Box>
      </Modal>
    </Box>
  );
};

// --- For Who Section ---
const ForWhoSection = () => (
  <Box id="for-who" component="section" sx={{ py: { xs: 10, md: 12 } }}>
    <Container>
      <Box sx={{ textAlign: 'center', mb: 8 }}>
        <Typography variant="h2" component="h2">An Ecosystem For Everyone in Pharmacy</Typography>
        <Typography color="text.primary" sx={{ mt: 2, maxWidth: '45rem', mx: 'auto' }}>
          We've built dedicated tools and workflows for every role, ensuring a seamless experience for all.
        </Typography>
      </Box>
      <Box sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: '1fr 1fr 1fr 1fr' },
        gap: 3,
      }}>
        <FeatureCard>
          <Typography variant="h4" sx={{ fontSize: '1.25rem' }}>Pharmacy Owners</Typography>
          <Typography color="text.primary" sx={{ mt: 1.5 }}>Access a verified talent pool, fill urgent shifts automatically, and manage your internal float team across multiple sites.</Typography>
        </FeatureCard>
        <FeatureCard>
          <Typography variant="h4" sx={{ fontSize: '1.25rem' }}>Pharmacists</Typography>
          <Typography color="text.primary" sx={{ mt: 1.5 }}>Find flexible locum work that fits your life. Get notified about shifts from your preferred pharmacies first and manage your availability with ease.</Typography>
        </FeatureCard>
        <FeatureCard>
          <Typography variant="h4" sx={{ fontSize: '1.25rem' }}>Assistants & Techs</Typography>
          <Typography color="text.primary" sx={{ mt: 1.5 }}>Gain experience and find part-time work that fits your schedule. Build your reputation and showcase skills with verified digital badges.</Typography>
        </FeatureCard>
        <FeatureCard>
          <Typography variant="h4" sx={{ fontSize: '1.25rem' }}>Students & Interns</Typography>
          <Typography color="text.primary" sx={{ mt: 1.5 }}>Connect with pharmacies for placements, shadow shifts, or casual work. Kickstart your career with valuable, real-world experience.</Typography>
        </FeatureCard>
      </Box>
    </Container>
  </Box>
);

// --- Final CTA Section ---
const FinalCTASection = () => (
  <Box component="section" sx={{ py: { xs: 10, md: 16 }, bgcolor: 'background.paper' }}>
    <Container sx={{ textAlign: 'center' }}>
      <Box sx={{ maxWidth: '48rem', mx: 'auto' }}>
        <img src={appIcon} alt="ChemistTasker App Icon" style={{ height: 500, width: 400, margin: '0' }} />

        <Typography variant="h2" component="h2" sx={{ fontSize: { xs: '2.25rem', md: '3rem' }, mb: 3 }}>
          Join the Future of Pharmacy Work.
        </Typography>
        <Typography color="text.primary" sx={{ mb: 4, maxWidth: '40rem', mx: 'auto' }}>
          Be the first to access the ChemistTasker platform. Sign up for our early access program and help us build a more connected, flexible, and resilient pharmacy industry in Australia.
        </Typography>
        <CtaButton href={PAGE_ROUTES.register} sx={{ px: 5, py: 2, fontSize: '1.25rem' }}>
          Sign Up for Early Access
        </CtaButton>
      </Box>
    </Container>
  </Box>
);

export default LandingPage;
