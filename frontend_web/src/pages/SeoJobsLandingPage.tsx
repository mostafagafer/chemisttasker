import { useEffect, useMemo } from 'react';
import { Container, Typography, Box, Stack, Divider, Link as MuiLink } from '@mui/material';
import { Link as RouterLink, useParams } from 'react-router-dom';
import AuthLayout from '../layouts/AuthLayout';
import { setCanonical, setPageMeta, setSocialMeta } from '../utils/seo';
import NotFoundPage from './NotFoundPage';

type SeoPage = {
  title: string;
  description: string;
  heading: string;
  intro: string;
  roles?: Array<{ label: string; slug: string }>;
  locations?: Array<{ label: string; slug: string }>;
};

const ROLE_PAGES = [
  { label: 'Pharmacist Jobs', slug: 'pharmacist-jobs-australia' },
  { label: 'Pharmacy Assistant Jobs', slug: 'pharmacy-assistant-jobs-australia' },
  { label: 'Pharmacy Technician Jobs', slug: 'pharmacy-technician-jobs-australia' },
  { label: 'Pharmacy Intern Jobs', slug: 'pharmacy-intern-jobs-australia' },
  { label: 'Pharmacy Student Jobs', slug: 'pharmacy-student-jobs-australia' },
];

const LOCATION_PAGES = [
  { label: 'Pharmacy Jobs in Sydney', slug: 'pharmacy-jobs-sydney' },
  { label: 'Pharmacy Jobs in Melbourne', slug: 'pharmacy-jobs-melbourne' },
  { label: 'Pharmacy Jobs in Brisbane', slug: 'pharmacy-jobs-brisbane' },
  { label: 'Pharmacy Jobs in Perth', slug: 'pharmacy-jobs-perth' },
  { label: 'Pharmacy Jobs in Adelaide', slug: 'pharmacy-jobs-adelaide' },
];

const SEO_PAGES: Record<string, SeoPage> = {
  'pharmacy-jobs-australia': {
    title: 'Pharmacy Jobs in Australia | ChemistTasker',
    description:
      'Find pharmacy jobs in Australia. Browse pharmacist, assistant, technician, intern, and student shifts and apply on ChemistTasker.',
    heading: 'Pharmacy Jobs in Australia',
    intro:
      'Browse open pharmacy shifts across Australia. Whether you are a pharmacist, assistant, technician, intern, or student, ChemistTasker helps you find the right role and shift.',
    roles: ROLE_PAGES,
    locations: LOCATION_PAGES,
  },
  'pharmacist-jobs-australia': {
    title: 'Pharmacist Jobs in Australia | ChemistTasker',
    description:
      'Explore pharmacist jobs in Australia. Find locum and permanent shifts and apply on ChemistTasker.',
    heading: 'Pharmacist Jobs in Australia',
    intro:
      'Discover pharmacist shifts across Australia. Filter by location, shift type, and availability on the public job board.',
    locations: LOCATION_PAGES,
  },
  'pharmacy-assistant-jobs-australia': {
    title: 'Pharmacy Assistant Jobs in Australia | ChemistTasker',
    description:
      'Find pharmacy assistant jobs in Australia. Browse public shifts and apply through ChemistTasker.',
    heading: 'Pharmacy Assistant Jobs in Australia',
    intro:
      'Find pharmacy assistant shifts across Australia. Apply to open roles that match your availability and location.',
    locations: LOCATION_PAGES,
  },
  'pharmacy-technician-jobs-australia': {
    title: 'Pharmacy Technician Jobs in Australia | ChemistTasker',
    description:
      'Find pharmacy technician jobs in Australia. Browse public shifts and apply on ChemistTasker.',
    heading: 'Pharmacy Technician Jobs in Australia',
    intro:
      'Browse pharmacy technician shifts across Australia and apply to roles that fit your schedule.',
    locations: LOCATION_PAGES,
  },
  'pharmacy-intern-jobs-australia': {
    title: 'Pharmacy Intern Jobs in Australia | ChemistTasker',
    description:
      'Find pharmacy intern jobs in Australia. Discover intern shifts and apply through ChemistTasker.',
    heading: 'Pharmacy Intern Jobs in Australia',
    intro:
      'Explore pharmacy intern shifts across Australia and build experience with verified pharmacies.',
    locations: LOCATION_PAGES,
  },
  'pharmacy-student-jobs-australia': {
    title: 'Pharmacy Student Jobs in Australia | ChemistTasker',
    description:
      'Find pharmacy student jobs in Australia. Browse flexible shifts and apply with ChemistTasker.',
    heading: 'Pharmacy Student Jobs in Australia',
    intro:
      'Browse pharmacy student shifts and flexible roles across Australia to grow your experience.',
    locations: LOCATION_PAGES,
  },
  'pharmacy-jobs-sydney': {
    title: 'Pharmacy Jobs in Sydney | ChemistTasker',
    description:
      'Find pharmacy jobs in Sydney. Browse pharmacist, assistant, technician, and intern shifts on ChemistTasker.',
    heading: 'Pharmacy Jobs in Sydney',
    intro:
      'Browse open pharmacy shifts in Sydney. Use filters to find roles that match your availability.',
    roles: ROLE_PAGES,
  },
  'pharmacy-jobs-melbourne': {
    title: 'Pharmacy Jobs in Melbourne | ChemistTasker',
    description:
      'Find pharmacy jobs in Melbourne. Browse pharmacist, assistant, technician, and intern shifts on ChemistTasker.',
    heading: 'Pharmacy Jobs in Melbourne',
    intro:
      'Browse open pharmacy shifts in Melbourne and apply through the public job board.',
    roles: ROLE_PAGES,
  },
  'pharmacy-jobs-brisbane': {
    title: 'Pharmacy Jobs in Brisbane | ChemistTasker',
    description:
      'Find pharmacy jobs in Brisbane. Browse pharmacist, assistant, technician, and intern shifts on ChemistTasker.',
    heading: 'Pharmacy Jobs in Brisbane',
    intro:
      'Browse open pharmacy shifts in Brisbane and apply through the public job board.',
    roles: ROLE_PAGES,
  },
  'pharmacy-jobs-perth': {
    title: 'Pharmacy Jobs in Perth | ChemistTasker',
    description:
      'Find pharmacy jobs in Perth. Browse pharmacist, assistant, technician, and intern shifts on ChemistTasker.',
    heading: 'Pharmacy Jobs in Perth',
    intro:
      'Browse open pharmacy shifts in Perth and apply through the public job board.',
    roles: ROLE_PAGES,
  },
  'pharmacy-jobs-adelaide': {
    title: 'Pharmacy Jobs in Adelaide | ChemistTasker',
    description:
      'Find pharmacy jobs in Adelaide. Browse pharmacist, assistant, technician, and intern shifts on ChemistTasker.',
    heading: 'Pharmacy Jobs in Adelaide',
    intro:
      'Browse open pharmacy shifts in Adelaide and apply through the public job board.',
    roles: ROLE_PAGES,
  },
};

export default function SeoJobsLandingPage() {
  const { slug } = useParams<{ slug: string }>();

  const page = useMemo(() => (slug ? SEO_PAGES[slug] : undefined), [slug]);

  useEffect(() => {
    if (!page) {
      return;
    }
    const origin = window.location.origin;
    const url = `${origin}/jobs/${slug}`;
    const image = `${origin}/images/Chemisttasker.png`;
    setPageMeta(page.title, page.description);
    setCanonical(url);
    setSocialMeta({
      title: page.title,
      description: page.description,
      url,
      image,
      type: 'website',
    });
  }, [page, slug]);

  if (!page) {
    return <NotFoundPage />;
  }

  return (
    <AuthLayout title={page.heading} maxWidth="lg" noCard showTitle={false}>
      <Container maxWidth="lg" sx={{ py: { xs: 5, md: 8 } }}>
        <Stack spacing={3}>
          <Box>
            <Typography variant="h2" component="h1" sx={{ mb: 1 }}>
              {page.heading}
            </Typography>
            <Typography variant="body1" color="text.secondary">
              {page.intro}
            </Typography>
          </Box>

          <Box>
            <MuiLink component={RouterLink} to="/shifts/public-board" sx={{ fontWeight: 600 }}>
              Browse all public shifts
            </MuiLink>
          </Box>

          {page.roles && page.roles.length > 0 && (
            <Box>
              <Typography variant="h5" sx={{ mb: 1 }}>
                Explore roles
              </Typography>
              <Stack spacing={0.75}>
                {page.roles.map((role) => (
                  <MuiLink key={role.slug} component={RouterLink} to={`/jobs/${role.slug}`}>
                    {role.label}
                  </MuiLink>
                ))}
              </Stack>
            </Box>
          )}

          {page.locations && page.locations.length > 0 && (
            <>
              <Divider />
              <Box>
                <Typography variant="h5" sx={{ mb: 1 }}>
                  Explore locations
                </Typography>
                <Stack spacing={0.75}>
                  {page.locations.map((location) => (
                    <MuiLink key={location.slug} component={RouterLink} to={`/jobs/${location.slug}`}>
                      {location.label}
                    </MuiLink>
                  ))}
                </Stack>
              </Box>
            </>
          )}
        </Stack>
      </Container>
    </AuthLayout>
  );
}
