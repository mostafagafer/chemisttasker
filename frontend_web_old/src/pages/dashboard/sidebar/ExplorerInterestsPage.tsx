// src/pages/dashboard/sidebar/ExplorerInterestsPage.tsx
import React, { useEffect, useMemo, useState, useCallback } from 'react';
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
  Fab,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
} from '@mui/material';
import {
  FavoriteBorder as FavoriteBorderIcon,
  Favorite as FavoriteIcon,
  UploadFile as UploadFileIcon,
  Close as CloseIcon,
  Image as ImageIcon,
  InsertDriveFile as InsertDriveFileIcon,
  Add as AddIcon,
  MoreVert as MoreVertIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Chat as ChatIcon,
} from '@mui/icons-material';
import { formatDistanceToNow } from 'date-fns';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';

import apiClient from '../../../utils/apiClient';
import { API_ENDPOINTS } from '../../../constants/api';
import { useAuth } from '../../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

dayjs.extend(utc);

type AttachmentKind = 'IMAGE' | 'VIDEO' | 'FILE';

interface Attachment {
  id: number;
  kind: AttachmentKind;
  file: string;
  caption: string;
}

interface ExplorerPost {
  id: number;
  explorer_profile: number;
  headline: string;
  body: string;
  view_count: number;
  like_count: number;
  created_at: string;
  attachments: Attachment[];
  explorer_name: string;
  is_liked_by_me: boolean;
  explorer_user_id: number;
  explorer_role_type: 'STUDENT' | 'JUNIOR' | 'CAREER_SWITCHER' | null;
}

interface ExplorerOnboardingProfile {
    id: number;
    user_id: number;
    role_type: 'STUDENT' | 'JUNIOR' | 'CAREER_SWITCHER' | null;
}

const isPaginated = <T,>(data: any): data is { results: T[]; count: number } =>
  data && typeof data === 'object' && Array.isArray(data.results);

const ITEMS_PER_PAGE = 10;

const isImageFileName = (name: string) => {
  const lower = name.toLowerCase();
  return lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.gif') || lower.endsWith('.webp') || lower.endsWith('.bmp');
};

const PostMenu: React.FC<{ onEdit: () => void; onDelete: () => void; }> = ({ onEdit, onDelete }) => {
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);
  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
  };
  const handleClose = () => {
    setAnchorEl(null);
  };

  return (
    <>
      <IconButton aria-label="settings" onClick={handleClick}>
        <MoreVertIcon />
      </IconButton>
      <Menu anchorEl={anchorEl} open={open} onClose={handleClose}>
        <MenuItem onClick={() => { onEdit(); handleClose(); }}>
          <ListItemIcon><EditIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Edit Post</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => { onDelete(); handleClose(); }} sx={{ color: 'error.main' }}>
          <ListItemIcon><DeleteIcon fontSize="small" color="error" /></ListItemIcon>
          <ListItemText>Delete Post</ListItemText>
        </MenuItem>
      </Menu>
    </>
  );
};

export default function ExplorerInterestsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [isExplorer, setIsExplorer] = useState(false);
  const [explorerProfile, setExplorerProfile] = useState<ExplorerOnboardingProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  const [posts, setPosts] = useState<ExplorerPost[]>([]);
  const [totalPosts, setTotalPosts] = useState(0);
  const [loadingFeed, setLoadingFeed] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [composerState, setComposerState] = useState<{
    open: boolean;
    isEditing: boolean;
    postToEdit: ExplorerPost | null;
    headline: string;
    body: string;
    files: File[];
    submitting: boolean;
  }>({ open: false, isEditing: false, postToEdit: null, headline: '', body: '', files: [], submitting: false });

  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean, post: ExplorerPost | null }>({ open: false, post: null });
  const [snackbar, setSnackbar] = useState({ open: false, message: '' });
  const [page, setPage] = useState(1);

  const showSnackbar = (message: string) => setSnackbar({ open: true, message });

  const fetchExplorerProfile = useCallback(async () => {
    if (!user) return;
    setLoadingProfile(true);
    try {
        const res = await apiClient.get<ExplorerOnboardingProfile>('/client-profile/explorer/onboarding/me/');
        if (res.data && res.data.id) {
            setIsExplorer(true);
            setExplorerProfile(res.data);
        } else {
            setIsExplorer(false);
        }
    } catch {
        setIsExplorer(false);
    } finally {
        setLoadingProfile(false);
    }
  }, [user]);

  const loadFeed = useCallback(async (currentPage: number) => {
    setLoadingFeed(true);
    setError(null);
    try {
      const res = await apiClient.get(`${API_ENDPOINTS.explorerPostFeed}?page=${currentPage}&page_size=${ITEMS_PER_PAGE}`);
      if (isPaginated<ExplorerPost>(res.data)) {
        setPosts(res.data.results);
        setTotalPosts(res.data.count);
      } else if (Array.isArray(res.data)) {
        setPosts(res.data);
        setTotalPosts(res.data.length);
      }
    } catch {
      setError('Failed to load explorer posts.');
    } finally {
      setLoadingFeed(false);
    }
  }, []);

  useEffect(() => {
    fetchExplorerProfile();
  }, [fetchExplorerProfile]);

  useEffect(() => {
    loadFeed(page);
  }, [page, loadFeed]);

  const pageCount = useMemo(() => Math.ceil(totalPosts / ITEMS_PER_PAGE), [totalPosts]);

  const toggleLike = async (post: ExplorerPost) => {
    const wasLiked = post.is_liked_by_me;
    setPosts(prev => prev.map(p => p.id === post.id ? { ...p, is_liked_by_me: !wasLiked, like_count: p.like_count + (wasLiked ? -1 : 1) } : p));
    try {
      const endpoint = wasLiked ? API_ENDPOINTS.explorerPostUnlike(post.id) : API_ENDPOINTS.explorerPostLike(post.id);
      await apiClient.post(endpoint);
    } catch {
      showSnackbar('Action failed. Please try again.');
      setPosts(prev => prev.map(p => p.id === post.id ? { ...p, is_liked_by_me: wasLiked, like_count: p.like_count } : p));
    }
  };

  const handleChatWithExplorer = (explorerUserId: number) => {
    let basePath = '/dashboard/owner/chat';
    if (user && ['ORG_ADMIN', 'ORG_OWNER', 'ORG_STAFF'].includes(user.role)) {
      basePath = '/dashboard/organization/chat';
    }
    navigate(`${basePath}?startDmWithUser=${explorerUserId}`);
  };

  const openNewPostComposer = () => {
    if (!isExplorer) {
      showSnackbar('You must be an explorer to post.');
      return;
    }
    setComposerState({ open: true, isEditing: false, postToEdit: null, headline: '', body: '', files: [], submitting: false });
  };

  const openEditComposer = (post: ExplorerPost) => {
    setComposerState({ open: true, isEditing: true, postToEdit: post, headline: post.headline, body: post.body, files: [], submitting: false });
  };

  const closeComposer = () => {
    if (composerState.submitting) return;
    setComposerState(prev => ({ ...prev, open: false }));
  };

  const handleFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    setComposerState(prev => ({ ...prev, files: [...prev.files, ...picked] }));
  };

  const handleFileRemove = (index: number) => {
    setComposerState(prev => ({ ...prev, files: prev.files.filter((_, i) => i !== index) }));
  };

  const submitPost = async () => {
    if (!isExplorer || !explorerProfile) {
      showSnackbar('Explorer profile could not be found.');
      return;
    }
    if (!composerState.headline.trim() && !composerState.body.trim()) {
      showSnackbar('Please add a headline or some text.');
      return;
    }

    setComposerState(prev => ({ ...prev, submitting: true }));
    try {
      if (composerState.isEditing && composerState.postToEdit) {
        const { postToEdit } = composerState;
        await apiClient.patch(API_ENDPOINTS.explorerPostDetail(postToEdit.id), {
          headline: composerState.headline.trim(),
          body: composerState.body.trim(),
        });
        showSnackbar('Post updated!');
      } else {
        const createRes = await apiClient.post(API_ENDPOINTS.explorerPosts, {
          explorer_profile: explorerProfile.id,
          headline: composerState.headline.trim(),
          body: composerState.body.trim(),
        });
        const createdPost: ExplorerPost = createRes.data;

        if (composerState.files.length > 0) {
          const form = new FormData();
          composerState.files.forEach(f => form.append('file', f));
          await apiClient.post(API_ENDPOINTS.explorerPostAttachments(createdPost.id), form);
        }
        showSnackbar('Post created!');
      }
      await loadFeed(page);
      closeComposer();
    } catch (e: any) {
      showSnackbar(e?.response?.data?.detail || 'Failed to submit post.');
    } finally {
      setComposerState(prev => ({ ...prev, submitting: false }));
    }
  };

  const openDeleteDialog = (post: ExplorerPost) => setDeleteDialog({ open: true, post });
  const closeDeleteDialog = () => setDeleteDialog({ open: false, post: null });

  const confirmDelete = async () => {
    if (!deleteDialog.post) return;
    try {
      await apiClient.delete(API_ENDPOINTS.explorerPostDetail(deleteDialog.post.id));
      showSnackbar('Post deleted successfully.');
      await loadFeed(page);
    } catch (e: any) {
      showSnackbar(e?.response?.data?.detail || 'Failed to delete post.');
    } finally {
      closeDeleteDialog();
    }
  };

  const getRoleLabel = (role: ExplorerPost['explorer_role_type']) => {
    if (!role) return 'Explorer';
    return role.charAt(0) + role.slice(1).toLowerCase().replace('_', ' ');
  };

  if (loadingProfile || loadingFeed) {
    return (
      <Container sx={{ py: 4 }}>
        <Typography variant="h4" gutterBottom>Explorer Interests</Typography>
        {[...Array(3)].map((_, i) => (
          <Card key={i} sx={{ mb: 3 }}><CardContent><Skeleton variant="text" width="50%" height={40} /><Skeleton variant="text" width="80%" height={20} sx={{ mb: 2 }} /><Skeleton variant="rectangular" width="100%" height={120} /></CardContent></Card>
        ))}
      </Container>
    );
  }

  return (
    <Container sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>Explorer Interests</Typography>

      {error && <Typography color="error" sx={{ my: 2 }}>{error}</Typography>}

      {!loadingFeed && posts.length === 0 && (
        <Typography sx={{ mt: 4, textAlign: 'center' }}>No posts yet. Be the first to share your interest!</Typography>
      )}

      <Stack spacing={3}>
        {posts.map(post => (
          <Card key={post.id} sx={{ '&:hover': { boxShadow: 6 } }}>
            <CardHeader
              avatar={<Avatar>{post.explorer_name?.[0]?.toUpperCase() ?? 'E'}</Avatar>}
              action={
                user?.id === post.explorer_user_id ? (
                  <PostMenu onEdit={() => openEditComposer(post)} onDelete={() => openDeleteDialog(post)} />
                ) : (
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<ChatIcon />}
                    onClick={(e) => { e.stopPropagation(); handleChatWithExplorer(post.explorer_user_id); }}
                  >
                    Message
                  </Button>
                )
              }
              titleTypographyProps={{ fontWeight: 'bold' }}
              title={post.explorer_name}
              subheader={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                  <Chip label={getRoleLabel(post.explorer_role_type)} size="small" />
                  <Typography variant="body2" color="text.secondary">
                    • {formatDistanceToNow(dayjs.utc(post.created_at).local().toDate(), { addSuffix: true })}
                  </Typography>
                </Box>
              }
            />
            <CardContent sx={{ pt: 0 }}>
              <Typography variant="h6" sx={{ mb: 1, fontWeight: 500 }}>
                {post.headline}
              </Typography>
              
              {post.body && <Typography sx={{ whiteSpace: 'pre-wrap', mb: 2 }}>{post.body}</Typography>}

              {post.attachments?.length > 0 && (
                <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
                  {post.attachments.map(att => {
                    const filename = att.caption || att.file.split('/').pop() || 'Download File';
                    return isImageFileName(att.file) ? (
                      <Box key={att.id} sx={{ borderRadius: 2, overflow: 'hidden', border: '1px solid', borderColor: 'divider' }}>
                        <img src={att.file} alt={filename} style={{ width: '100%', height: 'auto', maxHeight: 300, objectFit: 'cover', display: 'block' }} />
                      </Box>
                    ) : (
                      <MUILink key={att.id} href={att.file} target="_blank" rel="noopener" underline="none" sx={{ display: 'block' }}>
                        <Box sx={{
                          p: 2,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1.5,
                          bgcolor: 'grey.100',
                          borderRadius: 2,
                          border: '1px solid',
                          borderColor: 'divider',
                          transition: 'background-color 0.2s',
                          '&:hover': { bgcolor: 'grey.200' }
                        }}>
                          <InsertDriveFileIcon color="action" />
                          <Typography variant="body2" sx={{ fontWeight: 500, wordBreak: 'break-all' }}>
                            {filename}
                          </Typography>
                        </Box>
                      </MUILink>
                    );
                  })}
                </Box>
              )}
            </CardContent>
            <Divider />
            <CardActions disableSpacing>
              <Tooltip title={post.is_liked_by_me ? 'Unlike' : 'Like'}>
                <IconButton aria-label="like" onClick={(e) => { e.stopPropagation(); toggleLike(post); }}>
                  {post.is_liked_by_me ? <FavoriteIcon color="error" /> : <FavoriteBorderIcon />}
                </IconButton>
              </Tooltip>
              <Typography variant="body2" color="text.secondary">{post.like_count}</Typography>
            </CardActions>
          </Card>
        ))}
      </Stack>

      {pageCount > 1 && (
        <Box display="flex" justifyContent="center" mt={4}>
          <Pagination count={pageCount} page={page} onChange={(_, v) => setPage(v)} color="primary" />
        </Box>
      )}

      {isExplorer && (
        <Fab color="primary" aria-label="add" sx={{ position: 'fixed', bottom: 32, right: 32 }} onClick={openNewPostComposer}>
          <AddIcon />
        </Fab>
      )}

      <Dialog open={composerState.open} onClose={closeComposer} fullWidth maxWidth="sm">
        <DialogTitle>{composerState.isEditing ? 'Edit Post' : 'New Post'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField label="Headline" fullWidth value={composerState.headline} onChange={e => setComposerState(prev => ({ ...prev, headline: e.target.value }))} />
            <TextField label="What’s on your mind?" fullWidth multiline minRows={4} value={composerState.body} onChange={e => setComposerState(prev => ({ ...prev, body: e.target.value }))} />
            {!composerState.isEditing && (
              <>
                <Button variant="outlined" component="label" startIcon={<UploadFileIcon />}>
                  Add attachments
                  <input hidden type="file" multiple onChange={handleFilePick} />
                </Button>
                {composerState.files.length > 0 && (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {composerState.files.map((f, idx) => (
                      <Chip key={`${f.name}-${idx}`} icon={isImageFileName(f.name) ? <ImageIcon /> : <InsertDriveFileIcon />} label={f.name} onDelete={() => handleFileRemove(idx)} />
                    ))}
                  </Box>
                )}
              </>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeComposer} disabled={composerState.submitting}>Cancel</Button>
          <Button onClick={submitPost} disabled={composerState.submitting} variant="contained">{composerState.submitting ? 'Submitting…' : 'Submit'}</Button>
        </DialogActions>
      </Dialog>
      
      <Dialog open={deleteDialog.open} onClose={closeDeleteDialog}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent><Typography>Are you sure you want to permanently delete this post?</Typography></DialogContent>
        <DialogActions>
            <Button onClick={closeDeleteDialog}>Cancel</Button>
            <Button onClick={confirmDelete} color="error">Delete</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={3500} onClose={() => setSnackbar(prev => ({ ...prev, open: false }))} message={snackbar.message} action={<IconButton size="small" color="inherit" onClick={() => setSnackbar(prev => ({ ...prev, open: false }))}><CloseIcon fontSize="small" /></IconButton>} />
    </Container>
  );
}
