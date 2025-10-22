import { useCallback, useEffect, useMemo, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Menu,
  MenuItem,
  Paper,
  Snackbar,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import AlternateEmailIcon from "@mui/icons-material/AlternateEmail";
import CommentIcon from "@mui/icons-material/Comment";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import ForumIcon from "@mui/icons-material/Forum";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import ReplyIcon from "@mui/icons-material/Reply";
import SendIcon from "@mui/icons-material/Send";
import ThumbUpAltOutlinedIcon from "@mui/icons-material/ThumbUpAltOutlined";
import CelebrationIcon from "@mui/icons-material/Celebration";
import HandshakeOutlinedIcon from "@mui/icons-material/HandshakeOutlined";
import LightbulbOutlinedIcon from "@mui/icons-material/LightbulbOutlined";
import FavoriteBorderIcon from "@mui/icons-material/FavoriteBorder";
import dayjs from "dayjs";

import {
  createPharmacyHubComment,
  createPharmacyHubPost,
  deletePharmacyHubComment,
  deletePharmacyHubPost,
  fetchPharmacyHubComments,
  fetchPharmacyHubPosts,
  pinPharmacyHubPost,
  unpinPharmacyHubPost,
  reactToPharmacyHubPost,
  removePharmacyHubReaction,
  updatePharmacyHubComment,
  updatePharmacyHubPost,
  fetchCommunityGroups,
  createCommunityGroup,
  updateCommunityGroup,
  deleteCommunityGroup,
} from "../../../../api/pharmacyHub";
import {
  HubComment,
  HubPost,
  HubReactionType,
  CommunityGroup,
  CommunityGroupPayload,
} from "../../../../types/pharmacyHub";
import {
  useAuth,
  PharmacyMembership as AuthPharmacyMembership,
} from "../../../../contexts/AuthContext";
import apiClient from "../../../../utils/apiClient";
import { API_ENDPOINTS } from "../../../../constants/api";

type CommentDraftMap = Record<number, string>;
type CommentListMap = Record<number, HubComment[]>;
type CommentLoadingMap = Record<number, boolean>;
type ReplyTargetMap = Record<number, HubComment | null>;
type CommentEditDraftMap = Record<number, string>;

type PharmacyMember = {
  id: number;
  name: string;
  role: string;
};

type GroupDialogState = {
  open: boolean;
  mode: "create" | "edit";
  target: CommunityGroup | null;
};

type CommunityGroupDialogProps = {
  open: boolean;
  mode: "create" | "edit";
  target: CommunityGroup | null;
  members: PharmacyMember[];
  loading: boolean;
  onClose: () => void;
  onSubmit: (payload: CommunityGroupPayload) => Promise<void>;
  onDelete?: () => Promise<void>;
};

const HUB_POLL_INTERVAL_MS = 45000;

const REACTIONS: { type: HubReactionType; label: string; Icon: typeof ThumbUpAltOutlinedIcon }[] = [
  { type: "LIKE", label: "Like", Icon: ThumbUpAltOutlinedIcon },
  { type: "CELEBRATE", label: "Celebrate", Icon: CelebrationIcon },
  { type: "SUPPORT", label: "Support", Icon: HandshakeOutlinedIcon },
  { type: "INSIGHTFUL", label: "Insightful", Icon: LightbulbOutlinedIcon },
  { type: "LOVE", label: "Love", Icon: FavoriteBorderIcon },
];

type SimpleUser = {
  firstName: string | null;
  lastName: string | null;
  email: string | null;
};

const toSimpleUserFromAuth = (authUser: unknown): SimpleUser => {
  if (!authUser || typeof authUser !== "object") {
    return { firstName: null, lastName: null, email: null };
  }
  const record = authUser as Record<string, unknown>;
  return {
    firstName: (record.firstName ?? record.first_name ?? null) as string | null,
    lastName: (record.lastName ?? record.last_name ?? null) as string | null,
    email: (record.email ?? null) as string | null,
  };
};

const formatDisplayName = (member?: SimpleUser) => {
  if (!member) return "Unknown member";
  const parts = [member.firstName, member.lastName].filter(Boolean);
  if (parts.length) {
    return parts.join(" ");
  }
  return member.email ?? "Unnamed member";
};

const getInitials = (member?: SimpleUser) => {
  if (!member) return "";
  const letters = [member.firstName?.[0], member.lastName?.[0]].filter(Boolean).join("");
  if (letters) {
    return letters.toUpperCase();
  }
  return (member.email ?? "?").slice(0, 2).toUpperCase();
};

const buildCommentTree = (comments: HubComment[]) => {
  const map = new Map<number, (HubComment & { replies: HubComment[] })>();
  const roots: (HubComment & { replies: HubComment[] })[] = [];

  comments.forEach((comment) => {
    map.set(comment.id, { ...comment, replies: [] });
  });

  map.forEach((node) => {
    if (node.parentCommentId && map.has(node.parentCommentId)) {
      map.get(node.parentCommentId)!.replies.push(node);
    } else {
      roots.push(node);
    }
  });

  return roots;
};

const sortHubPosts = (posts: HubPost[]) => {
  return [...posts].sort((a, b) => {
    if (a.isPinned !== b.isPinned) {
      return a.isPinned ? -1 : 1;
    }
    const aPin = a.pinnedAt ? dayjs(a.pinnedAt).valueOf() : 0;
    const bPin = b.pinnedAt ? dayjs(b.pinnedAt).valueOf() : 0;
    if (aPin !== bPin) {
      return bPin - aPin;
    }
    return dayjs(b.createdAt).valueOf() - dayjs(a.createdAt).valueOf();
  });
};

const addTagToText = (value: string, tag: string) => {
  const trimmed = value.trimEnd();
  const separator = trimmed.length === 0 ? "" : " ";
  return `${trimmed}${separator}${tag} `;
};

const CommunityGroupDialog = ({
  open,
  mode,
  target,
  members,
  loading,
  onClose,
  onSubmit,
  onDelete,
}: CommunityGroupDialogProps) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedMemberIds, setSelectedMemberIds] = useState<number[]>([]);

  useEffect(() => {
    if (!open) {
      setName("");
      setDescription("");
      setSelectedMemberIds([]);
      return;
    }
    if (mode === "edit" && target) {
      setName(target.name);
      setDescription(target.description ?? "");
      setSelectedMemberIds(target.members.map((member) => member.membershipId));
    } else {
      setName("");
      setDescription("");
      setSelectedMemberIds([]);
    }
  }, [open, mode, target]);

  const toggleMember = (memberId: number) => {
    setSelectedMemberIds((prev) =>
      prev.includes(memberId) ? prev.filter((id) => id !== memberId) : [...prev, memberId]
    );
  };

  const handleSubmit = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) return;
    await onSubmit({
      name: trimmedName,
      description: description.trim() || null,
      memberIds: selectedMemberIds,
    });
  };

  return (
    <Dialog open={open} onClose={loading ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>
        {mode === "create" ? "Create Community Group" : "Edit Community Group"}
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <TextField
            label="Group name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            fullWidth
          />
          <TextField
            label="Description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            fullWidth
            multiline
            minRows={2}
            placeholder="Optional"
          />
          <Divider />
          <Typography variant="subtitle2" color="text.secondary">
            Select members
          </Typography>
          <List dense sx={{ maxHeight: 260, overflowY: "auto" }}>
            {members.map((member) => (
              <ListItem
                key={member.id}
                secondaryAction={
                  <Checkbox
                    edge="end"
                    checked={selectedMemberIds.includes(member.id)}
                    onChange={() => toggleMember(member.id)}
                  />
                }
              >
                <ListItemAvatar>
                  <Avatar>{member.name.slice(0, 2).toUpperCase()}</Avatar>
                </ListItemAvatar>
                <ListItemText primary={member.name} secondary={member.role} />
              </ListItem>
            ))}
          </List>
        </Stack>
      </DialogContent>
      <DialogActions>
        {mode === "edit" && onDelete && (
          <Button color="error" onClick={onDelete} disabled={loading}>
            Delete
          </Button>
        )}
        <Box flexGrow={1} />
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button variant="contained" onClick={handleSubmit} disabled={loading || !name.trim()}>
          {loading ? "Saving..." : "Save"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const PharmacyHubPage = () => {
  const { user } = useAuth();
  const viewerUser = useMemo(() => toSimpleUserFromAuth(user), [user]);

  const pharmacyMemberships = useMemo(() => {
    if (!user?.memberships) return [];
    return (
      user.memberships.filter(
        (membership): membership is AuthPharmacyMembership =>
          (membership as AuthPharmacyMembership).pharmacy_id !== undefined
      ) ?? []
    ).map((membership) => ({
      id: membership.pharmacy_id,
      name: membership.pharmacy_name ?? "Pharmacy",
      role: membership.role,
    }));
  }, [user]);

  const [selectedPharmacyId, setSelectedPharmacyId] = useState<number | null>(
    pharmacyMemberships.length ? pharmacyMemberships[0].id : null
  );
  const [communityGroups, setCommunityGroups] = useState<CommunityGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [availableMembers, setAvailableMembers] = useState<PharmacyMember[]>([]);

  const [posts, setPosts] = useState<HubPost[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [composerValue, setComposerValue] = useState("");
  const [creatingPost, setCreatingPost] = useState(false);

  const [expandedPostIds, setExpandedPostIds] = useState<Set<number>>(new Set());
  const [commentsByPost, setCommentsByPost] = useState<CommentListMap>({});
  const [commentsLoading, setCommentsLoading] = useState<CommentLoadingMap>({});
  const [commentDrafts, setCommentDrafts] = useState<CommentDraftMap>({});
  const [replyTargets, setReplyTargets] = useState<ReplyTargetMap>({});
  const [commentEditDrafts, setCommentEditDrafts] = useState<CommentEditDraftMap>({});
  const [editingCommentId, setEditingCommentId] = useState<number | null>(null);
  const [commentSavingId, setCommentSavingId] = useState<number | null>(null);

  const [postMenuAnchor, setPostMenuAnchor] = useState<HTMLElement | null>(null);
  const [postMenuPostId, setPostMenuPostId] = useState<number | null>(null);
  const [postMenuBusy, setPostMenuBusy] = useState(false);

  const [groupDialog, setGroupDialog] = useState<GroupDialogState>({
    open: false,
    mode: "create",
    target: null,
  });
  const [groupDialogSaving, setGroupDialogSaving] = useState(false);

  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: "success" | "error";
  }>({ open: false, message: "", severity: "success" });

  useEffect(() => {
    if (pharmacyMemberships.length && !selectedPharmacyId) {
      setSelectedPharmacyId(pharmacyMemberships[0].id);
    }
  }, [pharmacyMemberships, selectedPharmacyId]);

  useEffect(() => {
    if (!selectedPharmacyId) {
      setCommunityGroups([]);
      setSelectedGroupId(null);
      return;
    }
    let cancelled = false;
    setGroupsLoading(true);
    fetchCommunityGroups(selectedPharmacyId)
      .then((groups) => {
        if (cancelled) return;
        const ordered = [...groups].sort((a, b) => a.name.localeCompare(b.name));
        setCommunityGroups(ordered);
        if (!selectedGroupId || !ordered.some((group) => group.id === selectedGroupId)) {
          setSelectedGroupId(ordered.length ? ordered[0].id : null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCommunityGroups([]);
          setSelectedGroupId(null);
        }
      })
      .finally(() => {
        if (!cancelled) setGroupsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedPharmacyId, selectedGroupId]);

  useEffect(() => {
    if (!selectedPharmacyId) {
      setAvailableMembers([]);
      return;
    }
    let cancelled = false;
    apiClient
      .get(API_ENDPOINTS.membershipList, {
        params: { pharmacy: selectedPharmacyId, is_active: true },
      })
      .then((response) => {
        if (cancelled) return;
        const payload = Array.isArray(response.data?.results)
          ? response.data.results
          : Array.isArray(response.data)
          ? response.data
          : [];
        const members: PharmacyMember[] = payload.map((item: any) => {
          const details = item.user_details || item.user || {};
          const firstName = details.firstName ?? details.first_name ?? "";
          const lastName = details.lastName ?? details.last_name ?? "";
          const email = details.email ?? "";
          const invitedName = item.invited_name ?? "";
          const name =
            invitedName.trim() ||
            [firstName, lastName].filter(Boolean).join(" ").trim() ||
            email ||
            "Pharmacy member";
          return {
            id: item.id ?? details.id ?? Math.random(),
            name,
            role: item.role ?? "Member",
          };
        });
        setAvailableMembers(members);
      })
      .catch(() => {
        if (!cancelled) setAvailableMembers([]);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedPharmacyId]);

  const communityScopeOptions = useMemo(
    () => (selectedGroupId ? { communityGroupId: selectedGroupId } : undefined),
    [selectedGroupId]
  );

  const loadPosts = useCallback(async () => {
    if (!selectedPharmacyId) {
      setPosts([]);
      return;
    }
    setLoadingPosts(true);
    try {
      const payload = await fetchPharmacyHubPosts(selectedPharmacyId, 1, communityScopeOptions);
      setPosts(sortHubPosts(payload.results));
      const commentMap: CommentListMap = {};
      payload.results.forEach((post) => {
        commentMap[post.id] = post.recentComments;
      });
      setCommentsByPost(commentMap);
    } catch (error: any) {
      setPosts([]);
      setSnackbar({
        open: true,
        message: error?.response?.data?.detail ?? "Unable to load hub posts.",
        severity: "error",
      });
    } finally {
      setLoadingPosts(false);
    }
  }, [selectedPharmacyId, communityScopeOptions]);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  useEffect(() => {
    if (!selectedPharmacyId) return;
    const interval = window.setInterval(loadPosts, HUB_POLL_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [selectedPharmacyId, loadPosts]);

  const openSnackbar = (message: string, severity: "success" | "error" = "success") => {
    setSnackbar({ open: true, message, severity });
  };

  const handleCreatePost = async () => {
    const trimmed = composerValue.trim();
    if (!trimmed || !selectedPharmacyId) return;
    setCreatingPost(true);
    try {
      const created = await createPharmacyHubPost(
        selectedPharmacyId,
        { body: trimmed },
        communityScopeOptions
      );
      setPosts((prev) => sortHubPosts([created, ...prev]));
      setComposerValue("");
      openSnackbar("Post created.");
    } catch (error: any) {
      openSnackbar(error?.response?.data?.detail ?? "Unable to create post.", "error");
    } finally {
      setCreatingPost(false);
    }
  };

  const ensureCommentsLoaded = async (postId: number) => {
    if (!selectedPharmacyId) return;
    if (commentsByPost[postId] && commentsByPost[postId].length) return;
    setCommentsLoading((prev) => ({ ...prev, [postId]: true }));
    try {
      const data = await fetchPharmacyHubComments(
        selectedPharmacyId,
        postId,
        1,
        communityScopeOptions
      );
      setCommentsByPost((prev) => ({ ...prev, [postId]: data }));
    } catch {
      openSnackbar("Unable to load comments.", "error");
    } finally {
      setCommentsLoading((prev) => ({ ...prev, [postId]: false }));
    }
  };

  const handleToggleExpand = async (postId: number) => {
    setExpandedPostIds((prev) => {
      const next = new Set(prev);
      if (next.has(postId)) {
        next.delete(postId);
      } else {
        next.add(postId);
      }
      return next;
    });
    await ensureCommentsLoaded(postId);
  };

  const handleCommentChange = (postId: number, value: string) => {
    setCommentDrafts((prev) => ({ ...prev, [postId]: value }));
  };

  const handleSubmitComment = async (postId: number) => {
    const draft = (commentDrafts[postId] ?? "").trim();
    if (!draft || !selectedPharmacyId) return;
    setCommentsLoading((prev) => ({ ...prev, [postId]: true }));
    try {
      const replyTarget = replyTargets[postId];
      const created = await createPharmacyHubComment(
        selectedPharmacyId,
        postId,
        {
          body: draft,
          parentComment: replyTarget ? replyTarget.id : null,
        },
        communityScopeOptions
      );
      const next = [...(commentsByPost[postId] ?? []), created];
      setCommentsByPost((prev) => ({ ...prev, [postId]: next }));
      setCommentDrafts((prev) => ({ ...prev, [postId]: "" }));
      setReplyTargets((prev) => ({ ...prev, [postId]: null }));
      setPosts((prev) =>
        sortHubPosts(
          prev.map((post) =>
            post.id === postId
              ? { ...post, commentCount: post.commentCount + 1, recentComments: next.slice(-2) }
              : post
          )
        )
      );
    } catch {
      openSnackbar("Unable to add comment.", "error");
    } finally {
      setCommentsLoading((prev) => ({ ...prev, [postId]: false }));
    }
  };

  const handleDeleteComment = async (postId: number, commentId: number) => {
    if (!selectedPharmacyId) return;
    setCommentsLoading((prev) => ({ ...prev, [postId]: true }));
    try {
      await deletePharmacyHubComment(
        selectedPharmacyId,
        postId,
        commentId,
        communityScopeOptions
      );
      const updated = (commentsByPost[postId] ?? []).map((comment) =>
        comment.id === commentId
          ? { ...comment, isDeleted: true, body: "This comment has been deleted.", canEdit: false }
          : comment
      );
      setCommentsByPost((prev) => ({ ...prev, [postId]: updated }));
      openSnackbar("Comment deleted.");
    } catch {
      openSnackbar("Unable to delete comment.", "error");
    } finally {
      setCommentsLoading((prev) => ({ ...prev, [postId]: false }));
    }
  };

  const startEditingComment = (postId: number, comment: HubComment) => {
    setEditingCommentId(comment.id);
    setCommentEditDrafts((prev) => ({ ...prev, [comment.id]: comment.body }));
    setExpandedPostIds((prev) => new Set(prev).add(postId));
  };

  const cancelEditingComment = (commentId: number) => {
    setEditingCommentId(null);
    setCommentEditDrafts((prev) => {
      const next = { ...prev };
      delete next[commentId];
      return next;
    });
  };

  const saveCommentEdit = async (postId: number, commentId: number) => {
    const draft = (commentEditDrafts[commentId] ?? "").trim();
    if (!draft || !selectedPharmacyId) return;
    setCommentSavingId(commentId);
    try {
      const updated = await updatePharmacyHubComment(
        selectedPharmacyId,
        postId,
        commentId,
        { body: draft },
        communityScopeOptions
      );
      const comments = (commentsByPost[postId] ?? []).map((comment) =>
        comment.id === commentId ? updated : comment
      );
      setCommentsByPost((prev) => ({ ...prev, [postId]: comments }));
      cancelEditingComment(commentId);
    } catch {
      openSnackbar("Unable to update comment.", "error");
    } finally {
      setCommentSavingId(null);
    }
  };

  const handleReact = async (post: HubPost, reaction: HubReactionType) => {
    if (!selectedPharmacyId) return;
    const previousReaction = post.viewerReaction;
    const removing = previousReaction === reaction;

    setPosts((prev) =>
      prev.map((item) => {
        if (item.id !== post.id) return item;
        const summary = { ...item.reactionSummary };
        if (previousReaction) {
          summary[previousReaction] = Math.max(0, (summary[previousReaction] ?? 0) - 1);
        }
        if (!removing) {
          summary[reaction] = (summary[reaction] ?? 0) + 1;
        }
        return {
          ...item,
          viewerReaction: removing ? null : reaction,
          reactionSummary: summary,
        };
      })
    );

    try {
      if (removing) {
        await removePharmacyHubReaction(selectedPharmacyId, post.id, communityScopeOptions);
      } else {
        await reactToPharmacyHubPost(selectedPharmacyId, post.id, reaction, communityScopeOptions);
      }
    } catch {
      openSnackbar("Unable to update reaction.", "error");
      loadPosts();
    }
  };

  const openPostMenu = (event: ReactMouseEvent<HTMLButtonElement>, postId: number) => {
    setPostMenuAnchor(event.currentTarget);
    setPostMenuPostId(postId);
  };

  const closePostMenu = () => {
    setPostMenuAnchor(null);
    setPostMenuPostId(null);
  };

  const handleDeletePost = async (postId: number) => {
    if (!selectedPharmacyId) return;
    setPostMenuBusy(true);
    try {
      await deletePharmacyHubPost(selectedPharmacyId, postId, communityScopeOptions);
      setPosts((prev) => prev.filter((post) => post.id !== postId));
      openSnackbar("Post deleted.");
    } catch {
      openSnackbar("Unable to delete post.", "error");
    } finally {
      setPostMenuBusy(false);
      closePostMenu();
    }
  };

  const handleToggleCommentsAllowed = async (post: HubPost, allow: boolean) => {
    if (!selectedPharmacyId) return;
    setPostMenuBusy(true);
    try {
      const updated = await updatePharmacyHubPost(
        selectedPharmacyId,
        post.id,
        { allowComments: allow },
        communityScopeOptions
      );
      setPosts((prev) => sortHubPosts(prev.map((item) => (item.id === post.id ? updated : item))));
    } catch {
      openSnackbar("Unable to update post.", "error");
    } finally {
      setPostMenuBusy(false);
      closePostMenu();
    }
  };

  const handleTogglePin = async (post: HubPost, pin: boolean) => {
    if (!selectedPharmacyId) return;
    setPostMenuBusy(true);
    try {
      const updated = pin
        ? await pinPharmacyHubPost(selectedPharmacyId, post.id, communityScopeOptions)
        : await unpinPharmacyHubPost(selectedPharmacyId, post.id, communityScopeOptions);
      setPosts((prev) => sortHubPosts(prev.map((item) => (item.id === post.id ? updated : item))));
    } catch {
      openSnackbar("Unable to update pin state.", "error");
    } finally {
      setPostMenuBusy(false);
      closePostMenu();
    }
  };

  const openCreateGroupDialog = () => {
    setGroupDialog({ open: true, mode: "create", target: null });
  };

  const openEditGroupDialog = (group: CommunityGroup) => {
    setGroupDialog({ open: true, mode: "edit", target: group });
  };

  const closeGroupDialogHandler = () => {
    setGroupDialog({ open: false, mode: "create", target: null });
  };

  const handleGroupDialogSubmit = async (payload: CommunityGroupPayload) => {
    if (!selectedPharmacyId) return;
    setGroupDialogSaving(true);
    try {
      if (groupDialog.mode === "create") {
        const created = await createCommunityGroup(selectedPharmacyId, payload);
        setCommunityGroups((prev) =>
          [...prev, created].sort((a, b) => a.name.localeCompare(b.name))
        );
        setSelectedGroupId(created.id);
        openSnackbar("Community group created.");
      } else if (groupDialog.mode === "edit" && groupDialog.target) {
        const updated = await updateCommunityGroup(selectedPharmacyId, groupDialog.target.id, payload);
        setCommunityGroups((prev) =>
          prev
            .map((group) => (group.id === updated.id ? updated : group))
            .sort((a, b) => a.name.localeCompare(b.name))
        );
        openSnackbar("Community group updated.");
      }
      closeGroupDialogHandler();
      loadPosts();
    } catch (error: any) {
      openSnackbar(
        error?.response?.data?.detail ?? "Unable to save community group.",
        "error"
      );
    } finally {
      setGroupDialogSaving(false);
    }
  };

  const handleDeleteGroup = async () => {
    if (!selectedPharmacyId || !groupDialog.target) return;
    setGroupDialogSaving(true);
    try {
      await deleteCommunityGroup(selectedPharmacyId, groupDialog.target.id);
      setCommunityGroups((prev) => prev.filter((group) => group.id !== groupDialog.target!.id));
      setSelectedGroupId((prev) => (prev === groupDialog.target?.id ? null : prev));
      openSnackbar("Community group deleted.");
      closeGroupDialogHandler();
      loadPosts();
    } catch (error: any) {
      openSnackbar(
        error?.response?.data?.detail ?? "Unable to delete community group.",
        "error"
      );
    } finally {
      setGroupDialogSaving(false);
    }
  };

  return (
    <Box sx={{ py: 3, px: { xs: 1.5, md: 3 }, bgcolor: "grey.50", minHeight: "100%" }}>
      <Stack spacing={3} maxWidth="min(960px, 100%)" mx="auto">
        <Paper
          sx={{
            borderRadius: 3,
            p: { xs: 2.5, md: 3 },
            background: "linear-gradient(135deg, #6842ff, #3913b8)",
            color: "white",
            boxShadow: "0 20px 40px rgba(15,23,42,0.25)",
          }}
        >
          <Stack spacing={1.5}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <ForumIcon fontSize="large" />
              <Box>
                <Typography variant="h4" fontWeight={700}>
                  Pharmacy Hub
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.85 }}>
                  Share announcements, celebrate wins, and keep the pharmacy team aligned.
                </Typography>
                {selectedGroupId && (
                  <Typography variant="body2" sx={{ opacity: 0.7, mt: 0.5 }}>
                    Viewing community group: {communityGroups.find((group) => group.id === selectedGroupId)?.name ?? ""}
                  </Typography>
                )}
              </Box>
            </Stack>
            <Stack
              direction={{ xs: "column", md: "row" }}
              spacing={1.5}
              alignItems={{ xs: "stretch", md: "center" }}
            >
              <TextField
                select
                label="Pharmacy"
                size="small"
                value={selectedPharmacyId ?? ""}
                onChange={(event) => setSelectedPharmacyId(Number(event.target.value))}
                sx={{ minWidth: { xs: "100%", md: 260 }, bgcolor: "rgba(255,255,255,0.15)" }}
                InputLabelProps={{ sx: { color: "white" } }}
                SelectProps={{ sx: { color: "white" } }}
              >
                {pharmacyMemberships.map((membership) => (
                  <MenuItem key={membership.id} value={membership.id}>
                    {membership.name} ({membership.role})
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label="Community group"
                size="small"
                value={selectedGroupId ?? ""}
                onChange={(event) =>
                  setSelectedGroupId(event.target.value ? Number(event.target.value) : null)
                }
                sx={{ minWidth: { xs: "100%", md: 240 } }}
                disabled={groupsLoading || !communityGroups.length}
              >
                {groupsLoading && <MenuItem value="">Loading...</MenuItem>}
                {!groupsLoading && !communityGroups.length && <MenuItem value="">No groups yet</MenuItem>}
                {communityGroups.map((group) => (
                  <MenuItem key={group.id} value={group.id}>
                    {group.name} ({group.memberCount})
                  </MenuItem>
                ))}
              </TextField>
              <Stack direction="row" spacing={1}>
                <Button
                  variant="outlined"
                  color="inherit"
                  onClick={openCreateGroupDialog}
                  disabled={!selectedPharmacyId}
                >
                  New community group
                </Button>
                <Button
                  variant="contained"
                  color="secondary"
                  onClick={() => {
                    const group = communityGroups.find((item) => item.id === selectedGroupId);
                    if (group) openEditGroupDialog(group);
                  }}
                  disabled={!selectedPharmacyId || !selectedGroupId}
                >
                  Manage group
                </Button>
              </Stack>
            </Stack>
          </Stack>
        </Paper>

        <Paper variant="outlined" sx={{ borderRadius: 3, p: { xs: 2, md: 3 } }}>
          <Stack direction="row" spacing={2} alignItems="flex-start">
            <Avatar sx={{ width: 48, height: 48 }}>{getInitials(viewerUser)}</Avatar>
            <Box flexGrow={1}>
              <Typography fontWeight={600} mb={1}>
                Share an update with your team
              </Typography>
              <TextField
                placeholder="Announce roster updates, share reminders, or celebrate wins..."
                multiline
                minRows={3}
                fullWidth
                value={composerValue}
                onChange={(event) => setComposerValue(event.target.value)}
              />
              <Stack direction="row" spacing={1.5} justifyContent="space-between" alignItems="center" mt={1.5}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Button
                    size="small"
                    startIcon={<AlternateEmailIcon fontSize="small" />}
                    onClick={() => setComposerValue((prev) => addTagToText(prev, "@everyone"))}
                  >
                    Tag everyone
                  </Button>
                </Stack>
                <Button
                  variant="contained"
                  startIcon={<SendIcon />}
                  onClick={handleCreatePost}
                  disabled={!composerValue.trim() || creatingPost || !selectedPharmacyId}
                >
                  {creatingPost ? "Posting..." : "Post"}
                </Button>
              </Stack>
            </Box>
          </Stack>
        </Paper>

        {loadingPosts ? (
          <Paper sx={{ borderRadius: 3, p: 4, display: "flex", justifyContent: "center" }}>
            <CircularProgress />
          </Paper>
        ) : posts.length === 0 ? (
          <Alert severity="info" sx={{ borderRadius: 3 }}>
            No posts yet. Start the conversation above.
          </Alert>
        ) : (
          posts.map((post) => {
            const comments = commentsByPost[post.id] ?? post.recentComments;
            const commentTree = buildCommentTree(comments);
            const isExpanded = expandedPostIds.has(post.id);
            const commentsBusy = commentsLoading[post.id];
            const commentDraft = commentDrafts[post.id] ?? "";
            const replyTarget = replyTargets[post.id];

            return (
              <Paper key={post.id} variant="outlined" sx={{ borderRadius: 3, p: { xs: 2, md: 3 } }}>
                <Stack direction="row" spacing={2} alignItems="flex-start">
                  <Avatar sx={{ width: 40, height: 40 }}>
                    {getInitials({
                      firstName: post.author.user.firstName,
                      lastName: post.author.user.lastName,
                      email: post.author.user.email,
                    })}
                  </Avatar>
                  <Box flexGrow={1}>
                    <Stack direction="row" spacing={1} justifyContent="space-between" alignItems="center">
                      <Box>
                        <Typography fontWeight={600}>
                          {formatDisplayName({
                            firstName: post.author.user.firstName,
                            lastName: post.author.user.lastName,
                            email: post.author.user.email,
                          })}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {dayjs(post.createdAt).format("MMM D, YYYY h:mm A")}
                        </Typography>
                      </Box>
                      {post.canManage && (
                        <IconButton onClick={(event) => openPostMenu(event, post.id)}>
                          <MoreVertIcon fontSize="small" />
                        </IconButton>
                      )}
                    </Stack>
                    <Typography sx={{ mt: 1.5, whiteSpace: "pre-wrap" }}>{post.body}</Typography>
                    <Stack direction="row" spacing={1} alignItems="center" mt={1.5}>
                      {REACTIONS.map(({ type, label, Icon }) => {
                        const count = post.reactionSummary[type] ?? 0;
                        const selected = post.viewerReaction === type;
                        return (
                          <Button
                            key={type}
                            size="small"
                            startIcon={<Icon fontSize="small" color={selected ? "primary" : "inherit"} />}
                            onClick={() => handleReact(post, type)}
                          >
                            {count > 0 ? `${count}` : label}
                          </Button>
                        );
                      })}
                      <Button
                        size="small"
                        startIcon={<CommentIcon fontSize="small" />}
                        onClick={() => handleToggleExpand(post.id)}
                      >
                        {post.commentCount} comments
                      </Button>
                    </Stack>
                    {isExpanded && (
                      <Box mt={2}>
                        {commentsBusy ? (
                          <Box display="flex" justifyContent="center" py={3}>
                            <CircularProgress size={24} />
                          </Box>
                        ) : (
                          <Stack spacing={2}>
                            {commentTree.map((node) => (
                              <Box key={node.id}>
                                <Stack direction="row" spacing={1.5} alignItems="flex-start">
                                  <Avatar sx={{ width: 32, height: 32 }}>
                                    {getInitials({
                                      firstName: node.author.user.firstName,
                                      lastName: node.author.user.lastName,
                                      email: node.author.user.email,
                                    })}
                                  </Avatar>
                                  <Box flexGrow={1}>
                                    <Stack direction="row" spacing={1} alignItems="center">
                                      <Typography fontWeight={600}>
                                        {formatDisplayName({
                                          firstName: node.author.user.firstName,
                                          lastName: node.author.user.lastName,
                                          email: node.author.user.email,
                                        })}
                                      </Typography>
                                      <Typography variant="caption" color="text.secondary">
                                        {dayjs(node.createdAt).format("MMM D, YYYY h:mm A")}
                                      </Typography>
                                    </Stack>
                                    {editingCommentId === node.id ? (
                                      <Box mt={1}>
                                        <TextField
                                          value={commentEditDrafts[node.id] ?? node.body}
                                          onChange={(event) =>
                                            setCommentEditDrafts((prev) => ({
                                              ...prev,
                                              [node.id]: event.target.value,
                                            }))
                                          }
                                          fullWidth
                                          multiline
                                          minRows={2}
                                        />
                                        <Stack direction="row" spacing={1} mt={1}>
                                          <Button
                                            variant="contained"
                                            size="small"
                                            onClick={() => saveCommentEdit(post.id, node.id)}
                                            disabled={commentSavingId === node.id}
                                          >
                                            {commentSavingId === node.id ? "Saving..." : "Save"}
                                          </Button>
                                          <Button
                                            size="small"
                                            onClick={() => cancelEditingComment(node.id)}
                                            disabled={commentSavingId === node.id}
                                          >
                                            Cancel
                                          </Button>
                                        </Stack>
                                      </Box>
                                    ) : (
                                      <Typography sx={{ mt: 1 }} color={node.isDeleted ? "text.secondary" : undefined}>
                                        {node.body}
                                      </Typography>
                                    )}
                                    <Stack direction="row" spacing={1} mt={1}>
                                      <Button
                                        size="small"
                                        startIcon={<ReplyIcon fontSize="small" />}
                                        onClick={() =>
                                          setReplyTargets((prev) => ({
                                            ...prev,
                                            [post.id]: node.isDeleted ? null : node,
                                          }))
                                        }
                                        disabled={node.isDeleted}
                                      >
                                        Reply
                                      </Button>
                                      {node.canEdit && !node.isDeleted && editingCommentId !== node.id && (
                                        <Button
                                          size="small"
                                          startIcon={<EditOutlinedIcon fontSize="small" />}
                                          onClick={() => startEditingComment(post.id, node)}
                                        >
                                          Edit
                                        </Button>
                                      )}
                                      {node.canEdit && (
                                        <Button
                                          size="small"
                                          color="error"
                                          startIcon={<DeleteOutlineIcon fontSize="small" />}
                                          onClick={() => handleDeleteComment(post.id, node.id)}
                                        >
                                          Delete
                                        </Button>
                                      )}
                                    </Stack>
                                    {node.replies.map((reply) => (
                                      <Box key={reply.id} ml={4} mt={1.5}>
                                        <Stack direction="row" spacing={1.5} alignItems="flex-start">
                                          <Avatar sx={{ width: 28, height: 28 }}>
                                            {getInitials({
                                              firstName: reply.author.user.firstName,
                                              lastName: reply.author.user.lastName,
                                              email: reply.author.user.email,
                                            })}
                                          </Avatar>
                                          <Box flexGrow={1}>
                                            <Stack direction="row" spacing={1} alignItems="center">
                                              <Typography fontWeight={600}>
                                                {formatDisplayName({
                                                  firstName: reply.author.user.firstName,
                                                  lastName: reply.author.user.lastName,
                                                  email: reply.author.user.email,
                                                })}
                                              </Typography>
                                              <Typography variant="caption" color="text.secondary">
                                                {dayjs(reply.createdAt).format("MMM D, YYYY h:mm A")}
                                              </Typography>
                                            </Stack>
                                            <Typography sx={{ mt: 0.75 }} color={reply.isDeleted ? "text.secondary" : undefined}>
                                              {reply.body}
                                            </Typography>
                                          </Box>
                                        </Stack>
                                      </Box>
                                    ))}
                                  </Box>
                                </Stack>
                              </Box>
                            ))}
                            <Box>
                              {replyTarget && (
                                <Typography variant="caption" color="text.secondary" mb={0.5} display="block">
                                  Replying to {formatDisplayName({
                                    firstName: replyTarget.author.user.firstName,
                                    lastName: replyTarget.author.user.lastName,
                                    email: replyTarget.author.user.email,
                                  })}
                                </Typography>
                              )}
                              <TextField
                                multiline
                                minRows={2}
                                fullWidth
                                placeholder="Write a comment..."
                                value={commentDraft}
                                onChange={(event) => handleCommentChange(post.id, event.target.value)}
                              />
                              <Stack direction="row" spacing={1} mt={1} justifyContent="flex-end">
                                <Button
                                  variant="contained"
                                  size="small"
                                  onClick={() => handleSubmitComment(post.id)}
                                  disabled={!commentDraft.trim() || commentsBusy}
                                >
                                  Comment
                                </Button>
                              </Stack>
                            </Box>
                          </Stack>
                        )}
                      </Box>
                    )}
                  </Box>
                </Stack>
              </Paper>
            );
          })
        )}
      </Stack>

      <Menu anchorEl={postMenuAnchor} open={Boolean(postMenuAnchor)} onClose={closePostMenu}>
        {postMenuPostId !== null && (
          <>
            <MenuItem
              onClick={() => {
                const post = posts.find((item) => item.id === postMenuPostId);
                if (post) handleToggleCommentsAllowed(post, !post.allowComments);
              }}
              disabled={postMenuBusy}
            >
              {(() => {
                const post = posts.find((item) => item.id === postMenuPostId);
                if (!post) return "Toggle comments";
                return post.allowComments ? "Disable comments" : "Enable comments";
              })()}
            </MenuItem>
            <MenuItem
              onClick={() => {
                const post = posts.find((item) => item.id === postMenuPostId);
                if (post) handleTogglePin(post, !post.isPinned);
              }}
              disabled={postMenuBusy}
            >
              {(() => {
                const post = posts.find((item) => item.id === postMenuPostId);
                if (!post) return "Toggle pin";
                return post.isPinned ? "Unpin post" : "Pin to top";
              })()}
            </MenuItem>
            <MenuItem onClick={() => handleDeletePost(postMenuPostId)} disabled={postMenuBusy}>
              Delete post
            </MenuItem>
          </>
        )}
      </Menu>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert
          severity={snackbar.severity}
          onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
          sx={{ width: "100%" }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>

      <CommunityGroupDialog
        open={groupDialog.open}
        mode={groupDialog.mode}
        target={groupDialog.target}
        members={availableMembers}
        loading={groupDialogSaving}
        onClose={closeGroupDialogHandler}
        onSubmit={handleGroupDialogSubmit}
        onDelete={groupDialog.mode === "edit" ? handleDeleteGroup : undefined}
      />
    </Box>
  );
};

export default PharmacyHubPage;
