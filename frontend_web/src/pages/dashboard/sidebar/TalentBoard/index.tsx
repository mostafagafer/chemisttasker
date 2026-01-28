import React, { useCallback, useEffect, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Drawer,
  Fab,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
} from '@mui/material';
import {
  Add as AddIcon,
  Tune as TuneIcon,
  UploadFile as UploadFileIcon,
} from '@mui/icons-material';
import { useTalentFeed } from './hooks/useTalentFeed';
import { useTalentFilters } from './hooks/useTalentFilters';
import FiltersSidebar from './components/FiltersSidebar';
import TalentCard from './components/TalentCard';
import TalentEmpty from './components/TalentEmpty';
import { DEFAULT_FILTERS } from './constants';
import { useAuth } from '../../../../contexts/AuthContext';
import {
  createExplorerPost,
  createExplorerPostAttachment,
  getOnboarding,
  updateExplorerPost,
} from '@chemisttasker/shared-core';

const TalentBoard: React.FC = () => {
  const { posts, loading, error, reload } = useTalentFeed();
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const { filtered, roleOptions, stateOptions } = useTalentFilters(posts, filters);
  const isMobile = useMediaQuery('(max-width: 1024px)');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { user } = useAuth();

  const handleContact = () => {
    // placeholder action; will wire to chat/invite later
  };

  const sidebar = (
    <FiltersSidebar
      filters={filters}
      onChange={setFilters}
      roleOptions={roleOptions}
      stateOptions={stateOptions}
    />
  );

  const [pitchOpen, setPitchOpen] = useState(false);
  const [pitchSaving, setPitchSaving] = useState(false);
  const [pitchError, setPitchError] = useState<string | null>(null);
  const [existingPostId, setExistingPostId] = useState<number | null>(null);
  const [roleTitle, setRoleTitle] = useState<string>('Explorer');
  const [explorerProfileId, setExplorerProfileId] = useState<number | null>(null);
  const [pitchForm, setPitchForm] = useState({
    headline: '',
    body: '',
    workType: '',
    suburb: '',
    state: '',
    postcode: '',
    files: [] as File[],
  });

  const isExplorer = user?.role === 'EXPLORER';
  const isPharmacist = user?.role === 'PHARMACIST';
  const isOtherStaff = user?.role === 'OTHER_STAFF';

  const resetPitchForm = useCallback(() => {
    setPitchForm({
      headline: '',
      body: '',
      workType: '',
      suburb: '',
      state: '',
      postcode: '',
      files: [],
    });
    setExplorerProfileId(null);
    setExistingPostId(null);
    setRoleTitle('Explorer');
  }, []);

  const loadPitchDefaults = useCallback(async () => {
    if (!user) return;
    setPitchError(null);
    resetPitchForm();
    try {
      if (isExplorer) {
        const onboarding: any = await getOnboarding('explorer');
        setRoleTitle((onboarding?.role_type || 'Explorer').replace('_', ' ').toLowerCase().replace(/(^|\\s)\\S/g, (t: string) => t.toUpperCase()));
        setExplorerProfileId(onboarding?.id ?? null);
        setPitchForm((prev) => ({
          ...prev,
          body: onboarding?.short_bio || '',
          suburb: onboarding?.suburb || '',
          state: onboarding?.state || '',
          postcode: onboarding?.postcode || '',
        }));
      } else if (isPharmacist) {
        const onboarding: any = await getOnboarding('pharmacist');
        setRoleTitle('Pharmacist');
        setPitchForm((prev) => ({
          ...prev,
          body: onboarding?.short_bio || '',
          suburb: onboarding?.suburb || '',
          state: onboarding?.state || '',
          postcode: onboarding?.postcode || '',
        }));
      } else if (isOtherStaff) {
        const onboarding: any = await getOnboarding('other_staff');
        const title = (onboarding?.role_type || 'Other Staff').replace('_', ' ').toLowerCase().replace(/(^|\\s)\\S/g, (t: string) => t.toUpperCase());
        setRoleTitle(title);
        setPitchForm((prev) => ({
          ...prev,
          body: onboarding?.short_bio || '',
          suburb: onboarding?.suburb || '',
          state: onboarding?.state || '',
          postcode: onboarding?.postcode || '',
        }));
      }
      const mine = posts.find((post: any) => post.authorUserId === user?.id);
      if (mine) {
        setExistingPostId(mine.id);
        setPitchForm((prev) => ({
          ...prev,
          headline: mine.headline || prev.headline,
          body: mine.body || prev.body,
          workType: mine.workType || prev.workType,
          suburb: mine.locationSuburb || prev.suburb,
          state: mine.locationState || prev.state,
          postcode: mine.locationPostcode || prev.postcode,
        }));
      }
    } catch (err: any) {
      setPitchError(err?.message || 'Failed to load your profile.');
    }
  }, [user, isExplorer, isPharmacist, isOtherStaff, posts, resetPitchForm]);

  useEffect(() => {
    if (pitchOpen) {
      loadPitchDefaults();
    }
  }, [pitchOpen, loadPitchDefaults]);

  const handleFilePick = (event: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(event.target.files ?? []);
    setPitchForm((prev) => ({ ...prev, files: [...prev.files, ...picked] }));
  };

  const handleFileRemove = (index: number) => {
    setPitchForm((prev) => ({ ...prev, files: prev.files.filter((_, i) => i !== index) }));
  };

  const handlePitchSave = async () => {
    setPitchSaving(true);
    setPitchError(null);
    try {
      if (isExplorer) {
        if (!pitchForm.headline.trim() && !pitchForm.body.trim()) {
          setPitchError('Please add a headline or some text.');
          setPitchSaving(false);
          return;
        }
        const fd = new FormData();
        if (explorerProfileId) {
          fd.append('explorer_profile', String(explorerProfileId));
        }
        fd.append('headline', pitchForm.headline.trim());
        fd.append('body', pitchForm.body.trim());
        const created: any = existingPostId
          ? await updateExplorerPost(existingPostId, {
              headline: pitchForm.headline.trim(),
              body: pitchForm.body.trim(),
            })
          : await createExplorerPost(fd);
        const postId = existingPostId || created?.id;
        if (postId && pitchForm.files.length > 0) {
          const form = new FormData();
          pitchForm.files.forEach((file) => form.append('file', file));
          await createExplorerPostAttachment(postId, form);
        }
      } else {
        const form = new FormData();
        form.append('headline', pitchForm.headline || '');
        form.append('body', pitchForm.body || '');
        form.append('role_category', isPharmacist ? 'PHARMACIST' : 'OTHER_STAFF');
        form.append('role_title', roleTitle || '');
        if (pitchForm.workType) form.append('work_type', pitchForm.workType);
        if (pitchForm.suburb) form.append('location_suburb', pitchForm.suburb);
        if (pitchForm.state) form.append('location_state', pitchForm.state);
        if (pitchForm.postcode) form.append('location_postcode', pitchForm.postcode);
        form.append('is_anonymous', 'true');
        if (existingPostId) {
          await updateExplorerPost(existingPostId, form);
        } else {
          await createExplorerPost(form);
        }
      }
      await reload();
      setPitchOpen(false);
    } catch (err: any) {
      setPitchError(err?.message || 'Failed to save pitch.');
    } finally {
      setPitchSaving(false);
    }
  };

  const showPitchButton = user?.role && ['EXPLORER', 'PHARMACIST', 'OTHER_STAFF'].includes(user.role);

  return (
    <Box sx={{ px: { xs: 2, lg: 3 }, py: 2, width: '100%' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Box>
          <Typography variant="h4" fontWeight={700}>Talent Board</Typography>
          <Typography variant="body2" color="text.secondary">
            {loading ? 'Loading...' : `Showing ${filtered.length} profiles`}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center">
          {isMobile && (
            <IconButton onClick={() => setIsSidebarOpen(true)}>
              <TuneIcon />
            </IconButton>
          )}
        </Stack>
      </Box>

      {error && (
        <Typography color="error" sx={{ mb: 2 }}>{error}</Typography>
      )}

      <Box sx={{ display: 'flex', gap: 3 }}>
        {!isMobile && (
          <Paper variant="outlined" sx={{ width: 320, flexShrink: 0, borderRadius: 3, borderColor: 'grey.200' }}>
            {sidebar}
          </Paper>
        )}

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack spacing={3}>
            {filtered.length > 0 ? (
              filtered.map((post) => (
                <TalentCard key={post.id} post={post} onContact={handleContact} />
              ))
            ) : (
              !loading && <TalentEmpty onReset={() => setFilters(DEFAULT_FILTERS)} />
            )}
          </Stack>
        </Box>
      </Box>

      <Drawer anchor="left" open={isSidebarOpen} onClose={() => setIsSidebarOpen(false)}>
        <Box sx={{ width: 320 }}>
          {sidebar}
        </Box>
      </Drawer>

      {showPitchButton && (
        <Fab
          color="primary"
          aria-label="pitch"
          sx={{ position: 'fixed', bottom: 32, right: 32 }}
          onClick={() => setPitchOpen(true)}
        >
          <AddIcon />
        </Fab>
      )}

      <Dialog open={pitchOpen} onClose={() => setPitchOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{existingPostId ? 'Update Pitch' : 'Pitch Yourself'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {pitchError && (
              <Typography color="error">{pitchError}</Typography>
            )}
            <TextField
              label="Headline"
              fullWidth
              value={pitchForm.headline}
              onChange={(event) => setPitchForm((prev) => ({ ...prev, headline: event.target.value }))}
            />
            <TextField
              label={isExplorer ? 'What’s on your mind?' : 'Short Bio'}
              fullWidth
              multiline
              minRows={4}
              value={pitchForm.body}
              onChange={(event) => setPitchForm((prev) => ({ ...prev, body: event.target.value }))}
            />

            {!isExplorer && (
              <>
                <FormControl fullWidth>
                  <InputLabel>Engagement Type</InputLabel>
                  <Select
                    label="Engagement Type"
                    value={pitchForm.workType}
                    onChange={(event) => setPitchForm((prev) => ({ ...prev, workType: event.target.value as string }))}
                  >
                    {['FULL_TIME', 'PART_TIME', 'CASUAL', 'VOLUNTEERING', 'PLACEMENT'].map((value) => (
                      <MenuItem key={value} value={value}>
                        {value.replace('_', ' ').toLowerCase().replace(/(^|\\s)\\S/g, (t) => t.toUpperCase())}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
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
              </>
            )}

            {isExplorer && (
              <>
                <Button variant="outlined" component="label" startIcon={<UploadFileIcon />}>
                  Add attachments
                  <input hidden type="file" multiple onChange={handleFilePick} />
                </Button>
                {pitchForm.files.length > 0 && (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {pitchForm.files.map((file, idx) => (
                      <Chip key={`${file.name}-${idx}`} label={file.name} onDelete={() => handleFileRemove(idx)} />
                    ))}
                  </Box>
                )}
              </>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPitchOpen(false)} disabled={pitchSaving}>Cancel</Button>
          <Button onClick={handlePitchSave} disabled={pitchSaving} variant="contained">
            {pitchSaving ? 'Saving…' : existingPostId ? 'Update Pitch' : 'Create Pitch'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default TalentBoard;
