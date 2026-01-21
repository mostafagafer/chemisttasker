import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link as RouterLink } from 'react-router-dom';
import { Container, Typography, Card, CardContent, Button, Skeleton, Chip, Divider, Stack } from '@mui/material';
import { useAuth } from '../contexts/AuthContext';
import dayjs from 'dayjs';
import { getViewSharedShift } from '@chemisttasker/shared-core';
import AuthLayout from '../layouts/AuthLayout';
import { setCanonical, setJsonLd, setPageMeta, setSocialMeta } from '../utils/seo';

const formatClockTime = (value?: string | null) => {
  if (!value) return '';
  const [hourPart = '0', minutePart = '00'] = value.split(':');
  let hour = Number(hourPart);
  const suffix = hour >= 12 ? 'PM' : 'AM';
  hour = hour % 12;
  if (hour === 0) hour = 12;
  const minutes = minutePart.padStart(2, '0');
  return `${hour}:${minutes} ${suffix}`;
};

interface Shift {
  id: number;
  pharmacy_detail?: {
    name: string;
    street_address?: string;
    suburb?: string;
    postcode?: string;
    state?: string;
  };
  pharmacyDetail?: {
    name?: string;
    streetAddress?: string | null;
    suburb?: string | null;
    postcode?: string | null;
    state?: string | null;
  } | null;
  description?: string;
  role_needed?: string;
  roleNeeded?: string;
  slots?: { date: string; start_time?: string; end_time?: string; startTime?: string; endTime?: string }[];
  post_anonymously?: boolean;
  postAnonymously?: boolean;
}

const SharedShiftLandingPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  // FIX: Only destructure the 'user' property, as 'loading' is not available.
  const { user } = useAuth();

  const [shift, setShift] = useState<Shift | null>(null);
  const [loading, setLoading] = useState(true); // This is for the local API call loading state
  const [error, setError] = useState('');

  const token = searchParams.get('token');
  const id = searchParams.get('id');

  useEffect(() => {
    const defaultTitle = 'Shift Opportunity | ChemistTasker';
    const defaultDescription = 'View shift details and apply on ChemistTasker.';
    const origin = window.location.origin;
    const fallbackUrl = `${origin}/shifts/link`;
    const defaultImage = `${origin}/images/Chemisttasker.png`;

    if (!shift) {
      setPageMeta(defaultTitle, defaultDescription);
      setCanonical(fallbackUrl);
      setSocialMeta({
        title: defaultTitle,
        description: defaultDescription,
        url: fallbackUrl,
        image: defaultImage,
        type: 'website',
      });
      setJsonLd('shared-shift');
      return;
    }

    const role = shift.role_needed ?? shift.roleNeeded ?? 'Shift';
    const location =
      shift.post_anonymously ?? shift.postAnonymously
        ? shift.pharmacy_detail?.suburb ?? shift.pharmacyDetail?.suburb
        : shift.pharmacy_detail?.suburb ??
          shift.pharmacyDetail?.suburb ??
          shift.pharmacy_detail?.state ??
          shift.pharmacyDetail?.state;
    const title = `${role} Shift${location ? ` in ${location}` : ''} | ChemistTasker`;
    const firstSlot = (shift.slots ?? [])[0];
    const slotDate = firstSlot?.date ? dayjs(firstSlot.date).format('MMM D, YYYY') : '';
    const slotTime = firstSlot
      ? `${formatClockTime(firstSlot.start_time ?? (firstSlot as any).startTime)}-${formatClockTime(
          firstSlot.end_time ?? (firstSlot as any).endTime
        )}`.trim()
      : '';

    const descriptionParts = [
      `${role} shift`,
      location ? `in ${location}` : '',
      slotDate ? `on ${slotDate}` : '',
      slotTime ? `(${slotTime})` : '',
    ]
      .filter(Boolean)
      .join(' ');

    const rawDescription = shift.description ? `${descriptionParts}. ${shift.description}` : descriptionParts;
    const description = rawDescription.length > 280 ? `${rawDescription.slice(0, 277)}...` : rawDescription;

    const canonicalUrl = `${origin}/shifts/link?id=${shift.id}`;
    setPageMeta(title, description);
    setCanonical(canonicalUrl);
    setSocialMeta({
      title,
      description,
      url: canonicalUrl,
      image: defaultImage,
      type: 'website',
    });

    const orgName = (shift.post_anonymously ?? shift.postAnonymously)
      ? 'ChemistTasker'
      : shift.pharmacy_detail?.name ?? shift.pharmacyDetail?.name ?? 'ChemistTasker';
    const legacyAddress = shift.pharmacy_detail;
    const camelAddress = shift.pharmacyDetail;
    const locationAddress = [
      legacyAddress?.street_address ?? camelAddress?.streetAddress,
      legacyAddress?.suburb ?? camelAddress?.suburb,
      legacyAddress?.state ?? camelAddress?.state,
      legacyAddress?.postcode ?? camelAddress?.postcode,
    ]
      .filter(Boolean)
      .join(', ');
    const slotDates = (shift.slots ?? [])
      .map((slot) => slot.date)
      .filter(Boolean)
      .map((value) => dayjs(value).toISOString());
    const validThrough = slotDates.length ? slotDates.sort().slice(-1)[0] : null;

    const jsonLd: Record<string, unknown> = {
      '@context': 'https://schema.org',
      '@type': 'JobPosting',
      title: `${role} Shift${location ? ` in ${location}` : ''}`,
      description: description || defaultDescription,
      identifier: {
        '@type': 'PropertyValue',
        name: 'ChemistTasker',
        value: String(shift.id),
      },
      hiringOrganization: {
        '@type': 'Organization',
        name: orgName,
      },
    };

    if (locationAddress) {
      jsonLd.jobLocation = {
        '@type': 'Place',
        address: {
          '@type': 'PostalAddress',
          streetAddress: legacyAddress?.street_address ?? camelAddress?.streetAddress,
          addressLocality: legacyAddress?.suburb ?? camelAddress?.suburb,
          addressRegion: legacyAddress?.state ?? camelAddress?.state,
          postalCode: legacyAddress?.postcode ?? camelAddress?.postcode,
          addressCountry: 'AU',
        },
      };
    }

    if (validThrough) {
      jsonLd.validThrough = validThrough;
    }

    setJsonLd('shared-shift', jsonLd);

    return () => {
      setJsonLd('shared-shift');
    };
  }, [shift]);

  useEffect(() => {
    // The effect will now re-run when the 'user' object changes (e.g., from null to a user object after login check)
    const fetchShift = async () => {
        try {
            // Avoid sending literal "null"/"undefined" tokens; only include the param when it is real.
            const params: Record<string, string> = {};
            if (token) params.token = token;
            if (id) params.id = id;

            const response: any = await getViewSharedShift(params);
            const fetchedShift = response?.data ?? response;
            setShift(fetchedShift);

            // If user is logged in, redirect them to the internal dashboard page
            if (user && fetchedShift) {
                const rolePath = user.role.toLowerCase().replace('_', '');
                navigate(`/dashboard/${rolePath}/shifts/${fetchedShift.id}`, { replace: true });
            }
        } catch (err: any) {
            setError(err.response?.data?.detail || "Could not load this shift.");
        } finally {
            // Only stop loading if the user is not logged in.
            // If they are logged in, the page will redirect away, so we don't need to change the loading state.
            if (!user) {
              setLoading(false);
            }
        }
    };

    if (!token && !id) {
        setError("No shift specified. A link must contain a shift ID or a share token.");
        setLoading(false);
    } else {
        fetchShift();
    }

  // FIX: The dependency array is simplified to not include the non-existent 'authLoading'.
  }, [id, token, user, navigate]);


  // FIX: The skeleton loader condition is simplified.
  // It will show while the API call is loading OR if a user is logged in (to hide the page before redirect).
  const renderContent = () => {
    if (loading || user) {
      return (
        <Stack spacing={3}>
          <Skeleton variant="rectangular" height={220} sx={{ borderRadius: 3 }} />
          <Skeleton variant="rectangular" height={160} sx={{ borderRadius: 3 }} />
        </Stack>
      );
    }

    if (error) {
      return (
        <Card sx={{ borderRadius: 3, boxShadow: 6 }}>
          <CardContent sx={{ textAlign: 'center' }}>
            <Typography variant="h5" color="error" gutterBottom>
              {error}
            </Typography>
            <Button sx={{ mt: 2 }} variant="contained" component={RouterLink} to="/shifts/public-board">
              Explore Other Shifts
            </Button>
          </CardContent>
        </Card>
      );
    }

    if (!shift) return null;

    return (
      <Stack spacing={3}>
        <Card sx={{ borderRadius: 3, boxShadow: '0 24px 60px rgba(0,0,0,0.08)' }}>
          <CardContent>
            <Typography variant="h4" gutterBottom>
              {shift.post_anonymously ?? shift.postAnonymously
                ? ((shift.pharmacy_detail?.suburb ?? shift.pharmacyDetail?.suburb)
                    ? `Shift in ${shift.pharmacy_detail?.suburb ?? shift.pharmacyDetail?.suburb}`
                    : 'Anonymous Shift')
                : (shift.pharmacy_detail?.name ?? shift.pharmacyDetail?.name)}
            </Typography>
            {(!(shift.post_anonymously ?? shift.postAnonymously) ||
              ((shift.post_anonymously ?? shift.postAnonymously) && (shift.pharmacy_detail?.suburb ?? shift.pharmacyDetail?.suburb))) && (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                {shift.post_anonymously ?? shift.postAnonymously
                  ? (shift.pharmacy_detail?.suburb ?? shift.pharmacyDetail?.suburb)
                  : [
                      shift.pharmacy_detail?.street_address ?? shift.pharmacyDetail?.streetAddress,
                      shift.pharmacy_detail?.suburb ?? shift.pharmacyDetail?.suburb,
                      shift.pharmacy_detail?.state ?? shift.pharmacyDetail?.state,
                      shift.pharmacy_detail?.postcode ?? shift.pharmacyDetail?.postcode,
                    ]
                      .filter(Boolean)
                      .join(', ')}
              </Typography>
            )}

            <Chip label={shift.role_needed ?? shift.roleNeeded} color="primary" sx={{ my: 2 }} />
            <Divider sx={{ mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              Slots
            </Typography>
            <Stack spacing={0.75} sx={{ mb: 2 }}>
              {(shift.slots ?? []).map((slot, index) => (
                <Typography key={index} variant="body2">
                  {dayjs(slot.date).format('MMM D, YYYY')} from{' '}
                  {formatClockTime(slot.start_time ?? (slot as any).startTime)} to{' '}
                  {formatClockTime(slot.end_time ?? (slot as any).endTime)}
                </Typography>
              ))}
            </Stack>
            {shift.description && (
              <Typography variant="body1" color="text.primary" sx={{ whiteSpace: 'pre-wrap' }}>
                {shift.description}
              </Typography>
            )}
          </CardContent>
        </Card>

        <Card
          sx={{
            borderRadius: 3,
            boxShadow: '0 18px 40px rgba(0,0,0,0.06)',
            background: 'linear-gradient(120deg, #00a99d 0%, #00877d 100%)',
            color: '#fff',
          }}
        >
          <CardContent>
            <Typography variant="h5" gutterBottom fontWeight={700}>
              Interested in this shift?
            </Typography>
            <Typography variant="body1" sx={{ mb: 2, opacity: 0.9 }}>
              Login to apply or browse more public shifts on the job board.
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <Button component={RouterLink} to="/login" variant="contained" color="inherit" sx={{ color: '#006f66' }}>
                Login to Apply
              </Button>
              <Button component={RouterLink} to="/shifts/public-board" variant="outlined" color="inherit">
                Explore Job Board
              </Button>
            </Stack>
          </CardContent>
        </Card>
      </Stack>
    );
  };

  return (
    <AuthLayout title="Shift Opportunity" maxWidth="lg" noCard showTitle={false}>
      <Container maxWidth="lg" sx={{ py: { xs: 4, md: 6 } }}>
        {renderContent()}
      </Container>
    </AuthLayout>
  );
};

export default SharedShiftLandingPage;
