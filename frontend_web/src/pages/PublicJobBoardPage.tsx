import { useEffect, useState, useCallback } from 'react';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Snackbar,
  Typography,
} from '@mui/material';
import ShiftsBoard from '../components/shifts/ShiftsBoard';
import {
  Shift,
  PaginatedResponse,
  getPublicJobBoard,
} from '@chemisttasker/shared-core';
import AuthLayout from '../layouts/AuthLayout';

type FilterConfig = {
  city: string[];
  roles: string[];
  employmentTypes: string[];
  minRate: number;
  search: string;
  timeOfDay: Array<'morning' | 'afternoon' | 'evening'>;
  dateRange: { start: string; end: string };
  onlyUrgent: boolean;
  negotiableOnly: boolean;
  flexibleOnly: boolean;
  travelProvided: boolean;
  accommodationProvided: boolean;
  bulkShiftsOnly: boolean;
};

const DEFAULT_FILTERS: FilterConfig = {
  city: [],
  roles: [],
  employmentTypes: [],
  minRate: 0,
  search: '',
  timeOfDay: [],
  dateRange: { start: '', end: '' },
  onlyUrgent: false,
  negotiableOnly: false,
  flexibleOnly: false,
  travelProvided: false,
  accommodationProvided: false,
  bulkShiftsOnly: false,
};

// Show all supported roles in the public filter, even when no shifts exist yet.
const PUBLIC_ROLE_OPTIONS = ['Pharmacist', 'Intern', 'Assistant', 'Technician', 'Student'];

const normalizeRoleForApi = (role: string) =>
  role
    ? role
        .toString()
        .trim()
        .replace(/\s+/g, '_')
        .toUpperCase()
    : '';

export default function PublicJobBoardPage() {
  const [searchParams] = useSearchParams();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorOpen, setErrorOpen] = useState(false);
  const [filters, setFilters] = useState<FilterConfig>(DEFAULT_FILTERS);
  const [debouncedFilters, setDebouncedFilters] = useState<FilterConfig>(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [totalCount, setTotalCount] = useState<number | undefined>(undefined);
  const [loginDialogOpen, setLoginDialogOpen] = useState(false);

  const mapPublicShift = (raw: any): Shift => {
    const pharmacy = raw.pharmacy_detail || raw.pharmacyDetail || {};
    const slots = (raw.slots || []).map((slot: any) => ({
      ...slot,
      id: slot.id,
      date: slot.date,
      startTime: slot.start_time ?? slot.startTime ?? '',
      endTime: slot.end_time ?? slot.endTime ?? '',
      startHour: slot.start_hour ?? slot.startHour,
      rate: slot.rate,
    }));
    return {
      ...raw,
      roleLabel: raw.role_label ?? raw.roleLabel ?? raw.role_needed ?? raw.roleNeeded,
      roleNeeded: raw.role_needed ?? raw.roleNeeded,
      employmentType: raw.employment_type ?? raw.employmentType,
      rateType: raw.rate_type ?? raw.rateType,
      minHourlyRate: raw.min_hourly_rate ?? raw.minHourlyRate,
      maxHourlyRate: raw.max_hourly_rate ?? raw.maxHourlyRate,
      minAnnualSalary: raw.min_annual_salary ?? raw.minAnnualSalary,
      maxAnnualSalary: raw.max_annual_salary ?? raw.maxAnnualSalary,
      fixedRate: raw.fixed_rate ?? raw.fixedRate,
      superPercent: raw.super_percent ?? raw.superPercent,
      paymentPreference: raw.payment_preference ?? raw.paymentPreference,
      postAnonymously: raw.post_anonymously ?? raw.postAnonymously,
      slots,
      flexibleTiming: raw.flexible_timing ?? raw.flexibleTiming,
      singleUserOnly: raw.single_user_only ?? raw.singleUserOnly,
      workloadTags: raw.workload_tags ?? raw.workloadTags ?? [],
      mustHave: raw.must_have ?? raw.mustHave ?? [],
      niceToHave: raw.nice_to_have ?? raw.niceToHave ?? [],
      hasTravel: raw.has_travel ?? raw.hasTravel ?? false,
      hasAccommodation: raw.has_accommodation ?? raw.hasAccommodation ?? false,
      isUrgent: raw.is_urgent ?? raw.isUrgent ?? false,
      uiIsNegotiable: raw.ui_is_negotiable ?? raw.uiIsNegotiable,
      uiIsFlexibleTime: raw.ui_is_flexible_time ?? raw.uiIsFlexibleTime,
      uiAllowPartial: raw.ui_allow_partial ?? raw.uiAllowPartial,
      uiLocationCity: raw.ui_location_city ?? raw.uiLocationCity ?? pharmacy.suburb,
      uiLocationState: raw.ui_location_state ?? raw.uiLocationState ?? pharmacy.state,
      uiAddressLine: raw.ui_address_line ?? raw.uiAddressLine ?? [
        pharmacy.street_address ?? pharmacy.streetAddress,
        pharmacy.suburb,
        pharmacy.state,
        pharmacy.postcode,
      ].filter(Boolean).join(', '),
      uiDistanceKm: raw.ui_distance_km ?? raw.uiDistanceKm,
      uiIsUrgent: raw.ui_is_urgent ?? raw.uiIsUrgent ?? raw.is_urgent ?? raw.isUrgent,
      pharmacyDetail: {
        name: pharmacy.name,
        streetAddress: pharmacy.street_address ?? pharmacy.streetAddress,
        suburb: pharmacy.suburb,
        state: pharmacy.state,
        postcode: pharmacy.postcode,
      },
      createdAt: raw.created_at ?? raw.createdAt,
    } as Shift;
  };

  const showError = (message: string) => {
    setError(message);
    setErrorOpen(true);
  };

  const loadShifts = useCallback(
    async (activeFilters: FilterConfig, activePage: number) => {
      setLoading(true);
      setError(null);
      try {
        const org = searchParams.get('organization');
        const roleFilters = activeFilters.roles
          .map(normalizeRoleForApi)
          .filter((value) => Boolean(value));
        const payload: any = {
          organization: org || undefined,
          search: activeFilters.search,
          // Backend expects enum codes (e.g. PHARMACIST), while the UI uses labels.
          roles: roleFilters,
          employment_types: activeFilters.employmentTypes,
          city: activeFilters.city,
          state: [],
          min_rate: activeFilters.minRate || undefined,
          only_urgent: activeFilters.onlyUrgent || undefined,
          negotiable_only: activeFilters.negotiableOnly || undefined,
          flexible_only: activeFilters.flexibleOnly || undefined,
          travel_provided: activeFilters.travelProvided || undefined,
          accommodation_provided: activeFilters.accommodationProvided || undefined,
          bulk_shifts_only: activeFilters.bulkShiftsOnly || undefined,
          time_of_day: activeFilters.timeOfDay,
          start_date: activeFilters.dateRange.start || undefined,
          end_date: activeFilters.dateRange.end || undefined,
          page: activePage,
          page_size: pageSize,
        };

        const publicShifts = await getPublicJobBoard(payload) as PaginatedResponse<Shift>;
        const list = Array.isArray(publicShifts?.results)
          ? publicShifts.results
          : Array.isArray(publicShifts)
            ? publicShifts
            : [];
        setShifts((list as any[]).map(mapPublicShift));
        setTotalCount((publicShifts as any)?.count);
      } catch (err) {
        console.error('Failed to load public shifts', err);
        showError('Failed to load public shifts.');
      } finally {
        setLoading(false);
      }
    },
    [searchParams]
  );

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedFilters(filters), 350);
    return () => clearTimeout(handle);
  }, [filters]);

  useEffect(() => {
    loadShifts(debouncedFilters, page);
  }, [debouncedFilters, page, loadShifts]);

  const requireLogin = () => setLoginDialogOpen(true);

  const handleFiltersChange = (nextFilters: FilterConfig) => {
    setFilters(nextFilters);
  };

  const handleCloseError = () => setErrorOpen(false);

  return (
    <AuthLayout title="Public Job Board" maxWidth="lg" noCard showTitle={false}>
      <Box sx={{ px: { xs: 2, lg: 3 }, py: 3, bgcolor: 'grey.50', minHeight: '100vh' }}>
        {error && (
          <Typography color="error" sx={{ mb: 1 }}>
            {error}
          </Typography>
        )}
        <ShiftsBoard
          title="Public Job Board"
          shifts={shifts}
          loading={loading}
          useServerFiltering
          filters={filters}
          onFiltersChange={handleFiltersChange}
          totalCount={totalCount}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          enableSaved={false}
          hideSaveToggle
          readOnlyActions
          disableLocalPersistence
          roleOptionsOverride={PUBLIC_ROLE_OPTIONS}
          initialAppliedShiftIds={[]}
          initialAppliedSlotIds={[]}
          initialRejectedShiftIds={[]}
          initialRejectedSlotIds={[]}
          onApplyAll={() => requireLogin()}
          onApplySlot={() => requireLogin()}
          hideCounterOffer
          onRefresh={() => loadShifts(filters, page)}
        />
      </Box>

      <Dialog open={loginDialogOpen} onClose={() => setLoginDialogOpen(false)}>
        <DialogTitle>Log in to apply</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            You need an account to apply or send a counter offer.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLoginDialogOpen(false)}>Cancel</Button>
          <Button component={RouterLink} to="/register" variant="outlined">
            Create account
          </Button>
          <Button component={RouterLink} to="/login" variant="contained">
            Log in
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={errorOpen} autoHideDuration={4000} onClose={handleCloseError}>
        <Alert severity="error" onClose={handleCloseError} sx={{ width: '100%' }}>
          {error}
        </Alert>
      </Snackbar>
    </AuthLayout>
  );
}
