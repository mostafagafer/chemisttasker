// src/pages/dashboard/sidebar/ExplorerInterestsPage.tsx
import React, { useEffect, useMemo, useState } from 'react';
import {
  Container,
  Typography,
  Card,
  CardHeader,
  CardContent,
  CardActions,
  TextField,
  Button,
  IconButton,
  Chip,
  Box,
  Snackbar,
  Skeleton,
  Pagination,
  Avatar,
  Tooltip,
  Stack,
  Link as MUILink,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import FavoriteIcon from '@mui/icons-material/Favorite';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import CloseIcon from '@mui/icons-material/Close';
import ImageIcon from '@mui/icons-material/Image';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import AddIcon from '@mui/icons-material/Add';
import { formatDistanceToNow } from 'date-fns';

import apiClient from '../../../utils/apiClient';
import { API_ENDPOINTS } from '../../../constants/api';
import { useAuth } from '../../../contexts/AuthContext';

type AttachmentKind = 'IMAGE' | 'VIDEO' | 'FILE';

interface Attachment {
  id: number;
  kind: AttachmentKind;
  file: string;
  caption: string;
  created_at: string;
}

interface ExplorerPost {
  id: number;
  explorer_profile: number;
  headline: string;
  body: string;
  view_count: number;
  like_count: number;
  reply_count: number;
  created_at: string;
  updated_at: string;
  attachments: Attachment[];
  explorer_name: string;
  is_liked_by_me: boolean;
}

// interface ExplorerMe { id: number }

const isPaginated = <T,>(data: any): data is { results: T[] } =>
  data && typeof data === 'object' && Array.isArray(data.results);

const ITEMS_PER_PAGE = 10;

const isImageFileName = (name: string) => {
  const lower = name.toLowerCase();
  return lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.gif') || lower.endsWith('.webp') || lower.endsWith('.bmp');
};

export default function ExplorerInterestsPage() {
  const auth = useAuth();
  if (!auth?.user) return null;

  // role/profile
  const [isExplorer, setIsExplorer] = useState<boolean | null>(null);
  const [explorerProfileId, setExplorerProfileId] = useState<number | null>(null);
  const [loadingRole, setLoadingRole] = useState(true);

  // feed
  const [posts, setPosts] = useState<ExplorerPost[]>([]);
  const [loadingFeed, setLoadingFeed] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // composer dialog
  const [composerOpen, setComposerOpen] = useState(false);
  const [headline, setHeadline] = useState('');
  const [body, setBody] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // ui
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMsg, setSnackbarMsg] = useState('');
  const [page, setPage] = useState(1);

  const showSnackbar = (msg: string) => {
    setSnackbarMsg(msg);
    setSnackbarOpen(true);
  };

  // ------- detect explorer + profile id
// ------- detect explorer + profile id (robust) -------
useEffect(() => {
  let mounted = true;

  const resolveExplorer = async () => {
    try {
      setLoadingRole(true);

      // 0) Fast path from auth context if available
      // @ts-ignore
      const authIsExplorer = Boolean(auth?.user?.is_explorer || auth?.user?.role === 'EXPLORER');
      // @ts-ignore
      const authProfileId = typeof auth?.user?.explorer_profile_id === 'number' ? auth.user.explorer_profile_id : null;

      if (mounted && authIsExplorer) setIsExplorer(true);
      if (mounted && authProfileId != null) setExplorerProfileId(authProfileId);

      // 1) Try primary endpoint
      try {
        const r1 = await apiClient.get('/client-profile/explorer/onboarding/me/');
        if (mounted) {
          setIsExplorer(true);
          setExplorerProfileId(typeof r1.data?.id === 'number' ? r1.data.id : (r1.data?.data?.id ?? null));
        }
      } catch {
        // 2) Try possible v2 endpoint (projects often have both)
        try {
          const r2 = await apiClient.get('/client-profile/explorer/onboarding-v2/me/');
          if (mounted) {
            setIsExplorer(true);
            setExplorerProfileId(typeof r2.data?.id === 'number' ? r2.data.id : (r2.data?.data?.id ?? null));
          }
        } catch {
          // 3) Final fallback: if auth said explorer but we still don't have an id,
          // try a generic "my onboarding list" and pick the first item.
          if (authIsExplorer && !authProfileId) {
            try {
              const r3 = await apiClient.get('/client-profile/explorer/onboarding/');
              const first = Array.isArray(r3.data?.results) ? r3.data.results[0] : (Array.isArray(r3.data) ? r3.data[0] : null);
              if (mounted && first?.id) {
                setIsExplorer(true);
                setExplorerProfileId(first.id);
              }
            } catch {
              // ignore – we’ll fall through
            }
          }
        }
      }
    } finally {
      if (mounted) setLoadingRole(false);
    }
  };

  resolveExplorer();
  return () => { mounted = false; };
}, [auth?.user]);


  // ------- feed loader
  const loadFeed = async () => {
    setLoadingFeed(true);
    setError(null);
    try {
      const res = await apiClient.get(API_ENDPOINTS.explorerPostFeed);
      const data = isPaginated<ExplorerPost>(res.data)
        ? res.data.results
        : (Array.isArray(res.data) ? res.data : []);
      setPosts(data);
    } catch {
      setError('Failed to load explorer posts.');
    } finally {
      setLoadingFeed(false);
    }
  };

  useEffect(() => {
    loadFeed();
  }, []);

  // ------- pagination
  const pageCount = useMemo(() => Math.ceil(posts.length / ITEMS_PER_PAGE), [posts.length]);
  const displayed = useMemo(
    () => posts.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE),
    [posts, page]
  );

  // ------- interactions
  const bumpView = async (postId: number) => {
    try {
      await apiClient.post(API_ENDPOINTS.explorerPostAddView(postId));
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, view_count: p.view_count + 1 } : p));
    } catch {}
  };

const toggleLike = async (post: ExplorerPost) => {
  const wasLiked = post.is_liked_by_me;

  // Optimistic update: immediately update the UI
  setPosts(prev =>
    prev.map(p =>
      p.id === post.id
        ? {
            ...p,
            is_liked_by_me: !wasLiked,
            like_count: p.like_count + (wasLiked ? -1 : +1),
          }
        : p
    )
  );

  try {
    if (wasLiked) {
      // User already liked → unlike it
      await apiClient.post(API_ENDPOINTS.explorerPostUnlike(post.id));
    } else {
      // User hasn't liked → like it
      await apiClient.post(API_ENDPOINTS.explorerPostLike(post.id));
    }
  } catch (error) {
    // Revert on failure
    setPosts(prev =>
      prev.map(p =>
        p.id === post.id
          ? {
              ...p,
              is_liked_by_me: wasLiked,
              like_count: p.like_count + (wasLiked ? +1 : -1),
            }
          : p
      )
    );
    showSnackbar('Action failed. Please try again.');
  }
};


  const onPickFiles = (evt: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(evt.target.files ?? []);
    setFiles(prev => [...prev, ...picked]);
  };

  const removeFileAt = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const openComposer = () => {
    if (!isExplorer) {
      showSnackbar('You must be an explorer to post.');
      return;
    }
    setComposerOpen(true);
  };

  const closeComposer = () => {
    if (!submitting) setComposerOpen(false);
  };

const submitPost = async () => {
  if (!isExplorer) {
    showSnackbar('This account is not marked as Explorer.');
    return;
  }
  if (!explorerProfileId) {
    showSnackbar('Explorer profile id not found. Make sure /client-profile/explorer/onboarding/me/ returns { id }.');
    return;
  }
  if (!headline.trim() && !body.trim()) {
    showSnackbar('Please add a headline or some text.');
    return;
  }
    setSubmitting(true);
    try {
      // 1) create the post
      const createRes = await apiClient.post(API_ENDPOINTS.explorerPosts, {
        explorer_profile: explorerProfileId,
        headline: headline.trim(),
        body: body.trim(),
      });
      const created: ExplorerPost = createRes.data as ExplorerPost;

      // 2) upload attachments
      if (files.length) {
        const form = new FormData();
        files.forEach(f => form.append('file', f)); // multiple "file"
        await apiClient.post(API_ENDPOINTS.explorerPostAttachments(created.id), form, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }

      // 3) refresh & reset
      await loadFeed();
      setHeadline('');
      setBody('');
      setFiles([]);
      setComposerOpen(false);
      showSnackbar('Posted!');
    } catch (e: any) {
      showSnackbar(e?.response?.data?.detail || 'Failed to post.');
    } finally {
      setSubmitting(false);
    }
  };

  // ------- loading skeleton
  if (loadingRole || (loadingFeed && posts.length === 0)) {
    return (
      <Container sx={{ py: 4 }}>
        <Typography variant="h4" gutterBottom>Explorer Interests</Typography>
        {[...Array(3)].map((_, i) => (
          <Card key={i} sx={{ mb: 2 }}>
            <CardContent>
              <Skeleton variant="text" width="50%" height={30} sx={{ mb: 1 }} />
              <Skeleton variant="text" width="80%" height={18} sx={{ mb: 1 }} />
              <Skeleton variant="rectangular" width="100%" height={120} />
            </CardContent>
          </Card>
        ))}
      </Container>
    );
  }

  return (
    <Container sx={{ py: 4 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 2 }}>
        <Typography variant="h4" sx={{ flex: 1 }}>Explorer Interests</Typography>
        {isExplorer && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={openComposer}>
            New Post
          </Button>
        )}
      </Box>

      {error && (
        <Typography color="error" sx={{ mb: 2 }}>
          {error}
        </Typography>
      )}

      {!loadingFeed && posts.length === 0 && (
        <Typography>No posts yet.</Typography>
      )}

      {displayed.map(post => (
        <Card key={post.id} sx={{ mb: 2 }} onClick={() => bumpView(post.id)}>
          <CardHeader
            avatar={<Avatar>{post.explorer_name?.[0] ?? 'E'}</Avatar>}
            title={post.headline || 'Untitled'}
            subheader={`${post.explorer_name || 'Explorer'} • ${formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}`}
          />
          <CardContent>
            {post.body && (
              <Typography sx={{ whiteSpace: 'pre-wrap', mb: 1 }}>
                {post.body}
              </Typography>
            )}

            {post.attachments?.length > 0 && (
              <Box
                sx={{
                  display: 'grid',
                  gap: 1,
                  gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                  mt: 1,
                }}
              >
                {post.attachments.map(att => {
                  const isImg = att.kind === 'IMAGE' || isImageFileName(att.file);
                  return (
                    <Box
                      key={att.id}
                      sx={{
                        borderRadius: 1,
                        overflow: 'hidden',
                        border: '1px solid',
                        borderColor: 'divider',
                      }}
                    >
                      {isImg ? (
                        <img
                          src={att.file}
                          alt={att.caption || 'attachment'}
                          style={{ width: '100%', height: 140, objectFit: 'cover', display: 'block' }}
                        />
                      ) : (
                        <Box sx={{ p: 2, display: 'flex', gap: 1, alignItems: 'center' }}>
                          <InsertDriveFileIcon />
                          <MUILink href={att.file} target="_blank" rel="noopener">
                            {att.caption || 'Open file'}
                          </MUILink>
                        </Box>
                      )}
                    </Box>
                  );
                })}
              </Box>
            )}

            <Box sx={{ mt: 1, display: 'flex', gap: 2, color: 'text.secondary' }}>
              {/* <Tooltip title="Views">
                <Typography variant="caption">{post.view_count} views</Typography>
              </Tooltip> */}
              <Tooltip title="Likes">
                <Typography variant="caption">{post.like_count} likes</Typography>
              </Tooltip>
            </Box>
          </CardContent>

<CardActions>
  <IconButton
    aria-label={post.is_liked_by_me ? 'Unlike' : 'Like'}
    onClick={e => {
      e.stopPropagation();
      toggleLike(post);
    }}
  >
    {post.is_liked_by_me ? <FavoriteIcon color="error" /> : <FavoriteBorderIcon />}
  </IconButton>
</CardActions>
        </Card>
      ))}

      {posts.length > ITEMS_PER_PAGE && (
        <Box display="flex" justifyContent="center" mt={4}>
          <Pagination
            count={pageCount}
            page={page}
            onChange={(_, v) => {
              setPage(v);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            color="primary"
          />
        </Box>
      )}

      {/* Composer dialog */}
      <Dialog open={composerOpen} onClose={closeComposer} fullWidth maxWidth="sm">
        <DialogTitle>New Post</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Headline"
              fullWidth
              value={headline}
              onChange={e => setHeadline(e.target.value)}
            />
            <TextField
              label="What’s on your mind?"
              fullWidth
              multiline
              minRows={3}
              value={body}
              onChange={e => setBody(e.target.value)}
            />
            <Box>
              <Button
                variant="outlined"
                component="label"
                startIcon={<UploadFileIcon />}
                sx={{ mr: 1 }}
              >
                Add attachments
                <input hidden type="file" multiple onChange={onPickFiles} />
              </Button>
              {files.length > 0 && (
                <Typography variant="body2" color="text.secondary" component="span">
                  {files.length} selected
                </Typography>
              )}
            </Box>
            {files.length > 0 && (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {files.map((f, idx) => (
                  <Chip
                    key={`${f.name}-${idx}`}
                    icon={isImageFileName(f.name) ? <ImageIcon /> : <InsertDriveFileIcon />}
                    label={f.name}
                    onDelete={() => removeFileAt(idx)}
                  />
                ))}
              </Box>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeComposer} disabled={submitting}>Cancel</Button>
          <Button onClick={submitPost} disabled={submitting} variant="contained">
            {submitting ? 'Posting…' : 'Post'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbarOpen}
        onClose={() => setSnackbarOpen(false)}
        message={snackbarMsg}
        autoHideDuration={3500}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        action={
          <IconButton size="small" color="inherit" onClick={() => setSnackbarOpen(false)}>
            <CloseIcon fontSize="small" />
          </IconButton>
        }
      />
    </Container>
  );
}
