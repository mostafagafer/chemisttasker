import React, { useMemo, useRef } from "react";
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Stack,
  Typography,
  Box,
  FormControlLabel,
  Checkbox,
} from "@mui/material";
import { UploadFile as UploadFileIcon } from "@mui/icons-material";
import { GoogleMap, Marker, Circle, Autocomplete, useJsApiLoader } from "@react-google-maps/api";

export type PitchFormState = {
  headline: string;
  body: string;
  workTypes: string[];
  streetAddress: string;
  suburb: string;
  state: string;
  postcode: string;
  openToTravel: boolean;
  coverageRadiusKm: number;
  latitude: number | null;
  longitude: number | null;
  googlePlaceId: string;
  files: File[];
};

export type PitchAttachment = {
  id: number;
  file: string;
  kind: string;
  caption?: string | null;
};

const radiusOptions = [5, 10, 20, 30, 40, 50, 75, 100, 150, 200, 250, 300, 500, 1000];

const getFileName = (value?: string | null) => {
  if (!value) return "";
  try {
    const clean = value.split("?")[0];
    return clean.split("/").pop() || clean;
  } catch {
    return value;
  }
};

const titleCase = (value: string) =>
  value
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/(^|\s)\S/g, (t) => t.toUpperCase());

export default function PitchDialog(props: {
  open: boolean;
  isExplorer: boolean;
  existingPostId: number | null;
  pitchForm: PitchFormState;
  setPitchForm: React.Dispatch<React.SetStateAction<PitchFormState>>;
  pitchError: string | null;
  pitchSaving: boolean;
  onClose: () => void;
  onSave: () => void;
  onDelete: () => void;
  existingAttachments: PitchAttachment[];
  onExistingAttachmentRemove: (id: number) => void;
  onFilePick: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onFileRemove: (index: number) => void;
}) {
  const {
    open,
    isExplorer,
    existingPostId,
    pitchForm,
    setPitchForm,
    pitchError,
    pitchSaving,
    onClose,
    onSave,
    onDelete,
    existingAttachments,
    onExistingAttachmentRemove,
    onFilePick,
    onFileRemove,
  } = props;

  const { isLoaded: isMapsLoaded } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_Maps_API_KEY || "",
    libraries: ["places"],
  });

  const pitchMapCenter = useMemo(() => {
    if (pitchForm.latitude != null && pitchForm.longitude != null) {
      return { lat: pitchForm.latitude, lng: pitchForm.longitude };
    }
    return { lat: -37.8136, lng: 144.9631 };
  }, [pitchForm.latitude, pitchForm.longitude]);

  const pitchAutocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  const handlePitchPlaceChanged = () => {
    if (!pitchAutocompleteRef.current) return;
    const place = pitchAutocompleteRef.current.getPlace();
    if (!place || !place.geometry || !place.geometry.location) return;

    const lat = place.geometry.location.lat();
    const lng = place.geometry.location.lng();
    const components = place.address_components || [];

    const getComponent = (types: string[]) =>
      components.find((c) => types.every((t) => c.types.includes(t)))?.long_name || "";

    setPitchForm((prev) => ({
      ...prev,
      streetAddress: place.formatted_address || prev.streetAddress,
      suburb: getComponent(["locality"]) || getComponent(["sublocality", "sublocality_level_1"]) || prev.suburb,
      state: getComponent(["administrative_area_level_1"]) || prev.state,
      postcode: getComponent(["postal_code"]) || prev.postcode,
      latitude: lat,
      longitude: lng,
      googlePlaceId: place.place_id || prev.googlePlaceId,
    }));
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{existingPostId ? "Update Pitch" : "Pitch Yourself"}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {pitchError && (
            <Box sx={{ color: "error.main", fontSize: 14 }}>
              {pitchError}
            </Box>
          )}
          <TextField
            label="Headline"
            fullWidth
            value={pitchForm.headline}
            onChange={(event) => setPitchForm((prev) => ({ ...prev, headline: event.target.value }))}
          />
          <TextField
            label={isExplorer ? "What's on your mind?" : "Short Bio"}
            fullWidth
            multiline
            minRows={4}
            value={pitchForm.body}
            onChange={(event) => setPitchForm((prev) => ({ ...prev, body: event.target.value }))}
          />

          <Typography variant="subtitle2" sx={{ mt: 1 }}>
            Location & Travel
          </Typography>
          {isMapsLoaded ? (
            <Autocomplete onLoad={(ref) => (pitchAutocompleteRef.current = ref)} onPlaceChanged={handlePitchPlaceChanged}>
              <TextField
                label="Address"
                fullWidth
                value={pitchForm.streetAddress}
                onChange={(event) => setPitchForm((prev) => ({ ...prev, streetAddress: event.target.value }))}
              />
            </Autocomplete>
          ) : (
            <TextField
              label="Address"
              fullWidth
              value={pitchForm.streetAddress}
              onChange={(event) => setPitchForm((prev) => ({ ...prev, streetAddress: event.target.value }))}
            />
          )}

          {isMapsLoaded && (
            <Box sx={{ height: 220, borderRadius: 2, overflow: "hidden", border: "1px solid #e2e8f0" }}>
              <GoogleMap mapContainerStyle={{ width: "100%", height: "100%" }} center={pitchMapCenter} zoom={12}>
                {pitchForm.latitude != null && pitchForm.longitude != null && (
                  <>
                    <Marker position={pitchMapCenter} />
                    <Circle
                      center={pitchMapCenter}
                      radius={(pitchForm.coverageRadiusKm || 0) * 1000}
                      options={{
                        fillColor: "#38a169",
                        fillOpacity: 0.2,
                        strokeColor: "#2f855a",
                        strokeOpacity: 0.5,
                      }}
                    />
                  </>
                )}
              </GoogleMap>
            </Box>
          )}

          <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
            <TextField
              label="Suburb"
              fullWidth
              value={pitchForm.suburb}
              onChange={(event) => setPitchForm((prev) => ({ ...prev, suburb: event.target.value }))}
            />
            <TextField
              label="State"
              fullWidth
              value={pitchForm.state}
              onChange={(event) => setPitchForm((prev) => ({ ...prev, state: event.target.value }))}
            />
            <TextField
              label="Postcode"
              fullWidth
              value={pitchForm.postcode}
              onChange={(event) => setPitchForm((prev) => ({ ...prev, postcode: event.target.value }))}
            />
          </Stack>

          <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
            <FormControl fullWidth>
              <InputLabel>Work Travel Radius (km)</InputLabel>
              <Select
                label="Work Travel Radius (km)"
                value={pitchForm.coverageRadiusKm}
                onChange={(event) =>
                  setPitchForm((prev) => ({
                    ...prev,
                    coverageRadiusKm: Number(event.target.value),
                  }))
                }
              >
                {radiusOptions.map((value) => (
                  <MenuItem key={value} value={value}>
                    {value} km
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControlLabel
              control={
                <Checkbox
                  checked={pitchForm.openToTravel}
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                    setPitchForm((prev) => ({ ...prev, openToTravel: event.target.checked }))
                  }
                />
              }
              label="Willing to travel/Regional"
            />
          </Stack>

          <FormControl fullWidth>
            <InputLabel>Engagement Type</InputLabel>
            <Select
              label="Engagement Type"
              multiple
              renderValue={(selected) =>
                Array.isArray(selected) ? selected.map((value) => titleCase(value)).join(", ") : ""
              }
              value={pitchForm.workTypes}
              onChange={(event) =>
                setPitchForm((prev) => ({
                  ...prev,
                  workTypes: event.target.value as string[],
                }))
              }
            >
              {["FULL_TIME", "PART_TIME", "CASUAL", "VOLUNTEERING", "PLACEMENT"].map((value) => (
                <MenuItem key={value} value={value}>
                  {titleCase(value)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Button variant="outlined" component="label" startIcon={<UploadFileIcon />}>
            Add attachments
            <input hidden type="file" multiple onChange={onFilePick} />
          </Button>
          {existingAttachments.length > 0 && (
            <Stack direction="row" spacing={1} flexWrap="wrap">
              {existingAttachments.map((att) => (
                <Chip
                  key={att.id}
                  label={getFileName(att.file) || att.caption || `Attachment ${att.id}`}
                  onDelete={() => onExistingAttachmentRemove(att.id)}
                />
              ))}
            </Stack>
          )}
          {pitchForm.files.length > 0 && (
            <Stack direction="row" spacing={1} flexWrap="wrap">
              {pitchForm.files.map((file, idx) => (
                <Chip key={`${file.name}-${idx}`} label={file.name} onDelete={() => onFileRemove(idx)} />
              ))}
            </Stack>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        {existingPostId && (
          <Button color="error" onClick={onDelete} disabled={pitchSaving}>
            Delete Pitch
          </Button>
        )}
        <Button onClick={onClose} disabled={pitchSaving}>
          Cancel
        </Button>
        <Button onClick={onSave} disabled={pitchSaving} variant="contained">
          {pitchSaving ? "Saving..." : existingPostId ? "Update Pitch" : "Create Pitch"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
