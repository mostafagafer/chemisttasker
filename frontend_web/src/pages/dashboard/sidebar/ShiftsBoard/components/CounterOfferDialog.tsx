import React from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  Paper,
  Stack,
  TextField,
  Typography,
  CircularProgress,
} from '@mui/material';
import Grid from '@mui/material/Grid';
import {
  ChatBubbleOutline as ChatBubbleOutlineIcon,
  Close as CloseIcon,
  ErrorOutline as ErrorOutlineIcon,
} from '@mui/icons-material';
import { Autocomplete } from '@react-google-maps/api';
import { COUNTER_OFFER_TRAVEL_AUTOCOMPLETE_ID } from '../constants';
import { CounterOfferFormSlot, TravelLocation } from '../types';
import { getShiftFlexibleTime, getShiftNegotiable, getShiftPharmacyName } from '../utils/shift';
import { Shift } from '@chemisttasker/shared-core';

type CounterOfferDialogProps = {
  open: boolean;
  onClose: () => void;
  counterOfferShift: Shift | null;
  counterOfferError: string | null;
  counterOfferSlots: CounterOfferFormSlot[];
  counterOfferTravel: boolean;
  counterOfferTravelLocation: TravelLocation;
  hasCounterOfferTravelLocation: boolean;
  isTravelMapsLoaded: boolean;
  travelMapsLoadError: unknown;
  counterSubmitting: boolean;
  onCounterSlotChange: (index: number, key: keyof CounterOfferFormSlot, value: string) => void;
  onCounterOfferTravelChange: (checked: boolean) => void;
  setCounterOfferTravelLocation: React.Dispatch<React.SetStateAction<TravelLocation>>;
  onClearTravelLocation: () => void;
  onPlaceChanged: () => void;
  onAutocompleteLoad: (ref: google.maps.places.Autocomplete) => void;
  onSubmit: () => void;
};

const CounterOfferDialog: React.FC<CounterOfferDialogProps> = ({
  open,
  onClose,
  counterOfferShift,
  counterOfferError,
  counterOfferSlots,
  counterOfferTravel,
  counterOfferTravelLocation,
  hasCounterOfferTravelLocation,
  isTravelMapsLoaded,
  travelMapsLoadError,
  counterSubmitting,
  onCounterSlotChange,
  onCounterOfferTravelChange,
  setCounterOfferTravelLocation,
  onClearTravelLocation,
  onPlaceChanged,
  onAutocompleteLoad,
  onSubmit,
}) => (
  <Dialog
    open={open}
    onClose={onClose}
    fullWidth
    maxWidth="md"
    disableEnforceFocus
  >
    <DialogTitle>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Box>
          <Typography variant="h6">Submit Counter Offer</Typography>
          <Typography variant="body2" color="text.secondary">
            {counterOfferShift ? getShiftPharmacyName(counterOfferShift) : ''}
          </Typography>
        </Box>
        <IconButton onClick={onClose}>
          <CloseIcon />
        </IconButton>
      </Stack>
    </DialogTitle>
    <DialogContent dividers>
      {counterOfferError && (
        <Typography color="error" variant="body2" sx={{ mb: 1 }}>
          {counterOfferError}
        </Typography>
      )}
      {counterOfferShift && (
        <Stack spacing={2}>
          <Paper variant="outlined" sx={{ p: 2, borderColor: 'grey.200' }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <ErrorOutlineIcon fontSize="small" />
              <Typography variant="body2">
                Negotiation options:{' '}
                {getShiftNegotiable(counterOfferShift) ? 'Rate negotiable.' : 'Rate fixed.'}{' '}
                {getShiftFlexibleTime(counterOfferShift) ? 'Time flexible.' : 'Time fixed.'}
              </Typography>
            </Stack>
          </Paper>
          <Stack spacing={2}>
            {counterOfferSlots.map((slot, idx) => (
              <Paper
                key={slot.slotId != null ? `${slot.slotId}-${slot.dateLabel || idx}` : `new-${idx}`}
                variant="outlined"
                sx={{ p: 2, borderColor: 'grey.200' }}
              >
                <Stack spacing={2}>
                  <Typography variant="subtitle2">
                    {slot.dateLabel}
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 12, md: 6 }}>
                      <TextField
                        label="Start time"
                        type="time"
                        size="small"
                        fullWidth
                        value={slot.startTime}
                        onChange={(event) => onCounterSlotChange(idx, 'startTime', event.target.value)}
                        disabled={!getShiftFlexibleTime(counterOfferShift)}
                        InputLabelProps={{ shrink: true }}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, md: 6 }}>
                      <TextField
                        label="End time"
                        type="time"
                        size="small"
                        fullWidth
                        value={slot.endTime}
                        onChange={(event) => onCounterSlotChange(idx, 'endTime', event.target.value)}
                        disabled={!getShiftFlexibleTime(counterOfferShift)}
                        InputLabelProps={{ shrink: true }}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, md: 6 }}>
                      <TextField
                        label="Hourly rate"
                        type="number"
                        size="small"
                        fullWidth
                        value={slot.rate}
                        onChange={(event) => onCounterSlotChange(idx, 'rate', event.target.value)}
                        disabled={!getShiftNegotiable(counterOfferShift)}
                      />
                    </Grid>
                  </Grid>
                </Stack>
              </Paper>
            ))}
          </Stack>
          {getShiftNegotiable(counterOfferShift) && (
            <FormControlLabel
              control={
                <Checkbox
                  checked={counterOfferTravel}
                  onChange={(event) => onCounterOfferTravelChange(event.target.checked)}
                />
              }
              label="Request travel allowance"
            />
          )}
          {counterOfferTravel && (
            <Paper variant="outlined" sx={{ p: 2, borderColor: 'grey.200' }}>
              <Stack spacing={1.5}>
                <Typography variant="subtitle2">Traveling from</Typography>
                {Boolean(travelMapsLoadError) && (
                  <Alert severity="error">Google Maps failed to load.</Alert>
                )}
                {isTravelMapsLoaded && !hasCounterOfferTravelLocation && (
                  <Autocomplete
                    onLoad={(ref) => onAutocompleteLoad(ref)}
                    onPlaceChanged={onPlaceChanged}
                    options={{
                      componentRestrictions: { country: 'au' },
                      fields: ['address_components', 'geometry', 'place_id', 'name'],
                    }}
                  >
                    <TextField
                      fullWidth
                      margin="normal"
                      label="Search Address"
                      id={COUNTER_OFFER_TRAVEL_AUTOCOMPLETE_ID}
                    />
                  </Autocomplete>
                )}
                {hasCounterOfferTravelLocation && (
                  <Box
                    sx={{
                      mt: 2,
                      p: 2,
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 1,
                      bgcolor: 'action.hover',
                    }}
                  >
                    <TextField
                      label="Street Address"
                      fullWidth
                      margin="normal"
                      value={counterOfferTravelLocation.streetAddress}
                      onChange={(event) =>
                        setCounterOfferTravelLocation((prev) => ({
                          ...prev,
                          streetAddress: event.target.value,
                        }))
                      }
                    />
                    <TextField
                      label="Suburb"
                      fullWidth
                      margin="normal"
                      value={counterOfferTravelLocation.suburb}
                      onChange={(event) =>
                        setCounterOfferTravelLocation((prev) => ({
                          ...prev,
                          suburb: event.target.value,
                        }))
                      }
                    />
                    <TextField
                      label="State"
                      fullWidth
                      margin="normal"
                      value={counterOfferTravelLocation.state}
                      onChange={(event) =>
                        setCounterOfferTravelLocation((prev) => ({
                          ...prev,
                          state: event.target.value,
                        }))
                      }
                    />
                    <TextField
                      label="Postcode"
                      fullWidth
                      margin="normal"
                      value={counterOfferTravelLocation.postcode}
                      onChange={(event) =>
                        setCounterOfferTravelLocation((prev) => ({
                          ...prev,
                          postcode: event.target.value,
                        }))
                      }
                    />
                    <Button size="small" onClick={onClearTravelLocation} sx={{ mt: 1 }}>
                      Clear Address & Search Again
                    </Button>
                  </Box>
                )}
              </Stack>
            </Paper>
          )}
        </Stack>
      )}
    </DialogContent>
    <DialogActions>
      <Button onClick={onClose}>Cancel</Button>
      <Button
        variant="contained"
        onClick={onSubmit}
        disabled={!counterOfferShift || counterSubmitting}
        startIcon={
          counterSubmitting ? <CircularProgress size={16} color="inherit" /> : <ChatBubbleOutlineIcon fontSize="small" />
        }
      >
        {counterSubmitting ? 'Sending...' : 'Send Offer'}
      </Button>
    </DialogActions>
  </Dialog>
);

export default CounterOfferDialog;
