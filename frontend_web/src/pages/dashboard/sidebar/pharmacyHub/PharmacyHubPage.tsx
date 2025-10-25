import { ChangeEvent, useCallback, useEffect, useMemo, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  IconButton,
  Menu,
  MenuItem,
  Paper,
  Select,
  ListItemIcon,
  ListItemText,
  Snackbar,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import AlternateEmailIcon from "@mui/icons-material/AlternateEmail";
import AttachFileOutlinedIcon from "@mui/icons-material/AttachFileOutlined";
import CommentIcon from "@mui/icons-material/Comment";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import ForumIcon from "@mui/icons-material/Forum";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import InsertDriveFileOutlinedIcon from "@mui/icons-material/InsertDriveFileOutlined";
import ReplyIcon from "@mui/icons-material/Reply";
import SendIcon from "@mui/icons-material/Send";
import ThumbUpAltOutlinedIcon from "@mui/icons-material/ThumbUpAltOutlined";
import CelebrationIcon from "@mui/icons-material/Celebration";
import HandshakeOutlinedIcon from "@mui/icons-material/HandshakeOutlined";
import LightbulbOutlinedIcon from "@mui/icons-material/LightbulbOutlined";
import FavoriteBorderIcon from "@mui/icons-material/FavoriteBorder";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import PushPinOutlinedIcon from "@mui/icons-material/PushPinOutlined";
import SpeakerNotesOffOutlinedIcon from "@mui/icons-material/SpeakerNotesOffOutlined";
import SpeakerNotesOutlinedIcon from "@mui/icons-material/SpeakerNotesOutlined"; 
import dayjs from "dayjs"; 
import { useAuth, PharmacyMembership as AuthPharmacyMembership } from "../../../../contexts/AuthContext";
import apiClient from "../../../../utils/apiClient";
import { API_ENDPOINTS } from "../../../../constants/api";
import {
  createPharmacyHubComment,
  createPharmacyHubPost,
  deletePharmacyHubComment,
  deletePharmacyHubPost,
  fetchPharmacyHubComments,
  fetchPharmacyHubPosts,
  reactToPharmacyHubPost,
  removePharmacyHubReaction,
  pinPharmacyHubPost,
  unpinPharmacyHubPost,
  updatePharmacyHubComment,
  updatePharmacyHubPost,
} from "../../../../api/pharmacyHub"; 
import { 
  HubComment, 
  HubPost, 
  HubReactionType, 
} from "../../../../types/pharmacyHub";
 
type CommentDraftMap = Record<number, string>;
type CommentListMap = Record<number, HubComment[]>;
type CommentLoadingMap = Record<number, boolean>;
type ReplyTargetMap = Record<number, HubComment | null>;
type CommentEditDraftMap = Record<number, string>;

type AttachmentDraft = {
  id: string;
  file: File;
  preview: string;
};

type PostEditorState = {
  postId: number;
  value: string;
  removeAttachmentIds: number[];
  newAttachments: AttachmentDraft[];
  saving: boolean;
};
type PharmacyMember = {
  id: number;
  name: string;
  role: string;
};
const HUB_POLL_INTERVAL_MS = 45000; 
const REACTIONS: { type: HubReactionType; label: string; Icon: typeof ThumbUpAltOutlinedIcon }[] = [
  { type: "LIKE", label: "Like", Icon: ThumbUpAltOutlinedIcon },
{ type: "CELEBRATE", label: "Celebrate", Icon: CelebrationIcon },

  { type: "SUPPORT", label: "Support", Icon: HandshakeOutlinedIcon },

  { type: "INSIGHTFUL", label: "Insightful", Icon: LightbulbOutlinedIcon },

  { type: "LOVE", label: "Love", Icon: FavoriteBorderIcon },

];

type TagContext = 
 
  | { type: "composer" }
 
  | { type: "comment"; postId: number };

type CommentNode = HubComment & { replies: CommentNode[] };

type SimpleUser = {

  firstName: string | null;

  lastName: string | null;

  email: string | null;

};

function formatDisplayName(member?: SimpleUser) {
  if (!member) return "Unknown member";

  const parts = [member.firstName, member.lastName].filter(Boolean);
 

  if (parts.length) {

    return parts.join(" ");

  }

  return member.email ?? "Unnamed member"; 

}
 
function getInitials(member?: SimpleUser) {

  if (!member) return "";

  const letters = [member.firstName?.[0], member.lastName?.[0]].filter(Boolean).join("");

  if (letters) {

    return letters.toUpperCase();

  }

  return (member.email ?? "?").slice(0, 2).toUpperCase();

} 

function addTagToText(value: string, tag: string) {
 
  const trimmed = value.trimEnd();

  const separator = trimmed.length === 0 ? "" : " ";

  return `${trimmed}${separator}${tag} `;

}

function buildCommentTree(comments: HubComment[]): CommentNode[] {
  const map = new Map<number, CommentNode>();
  const roots: CommentNode[] = [];

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
}

function generateDraftId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function sortHubPosts(posts: HubPost[]): HubPost[] {
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
}

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

const PharmacyHubPage = () => {  
  const { user } = useAuth();
 
  const viewerUser = useMemo(() => toSimpleUserFromAuth(user), [user]);

  const pharmacyMemberships = useMemo(() => {

    if (!user?.memberships) return [];

    return (user.memberships.filter((m): m is AuthPharmacyMembership =>

      (m as AuthPharmacyMembership)?.pharmacy_id !== undefined

    ) ?? []).map((m) => ({

      id: m.pharmacy_id,

      name: m.pharmacy_name ?? "Pharmacy",

      role: m.role,

    }));

  }, [user]);

  // Added to fix undefined variables used in JSX 
  const headline = "";
  const subheading = "";
 
  const [selectedPharmacyId, setSelectedPharmacyId] = useState<number | null>(
    pharmacyMemberships.length ? pharmacyMemberships[0].id : null
  );
  const [posts, setPosts] = useState<HubPost[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [composerValue, setComposerValue] = useState("");
  const [composerAttachments, setComposerAttachments] = useState<AttachmentDraft[]>([]);
  const [submittingPost, setSubmittingPost] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: "success" | "error" }>({
    open: false,
    message: "",
    severity: "success",
  });
  const [expandedPostIds, setExpandedPostIds] = useState<Set<number>>(new Set());
  const [commentDrafts, setCommentDrafts] = useState<CommentDraftMap>({});
  const [commentEditDrafts, setCommentEditDrafts] = useState<CommentEditDraftMap>({});
  const [editingCommentId, setEditingCommentId] = useState<number | null>(null);
  const [commentSavingId, setCommentSavingId] = useState<number | null>(null);
  const [replyTargets, setReplyTargets] = useState<ReplyTargetMap>({});
  const [commentsByPost, setCommentsByPost] = useState<CommentListMap>({});
  const [commentsLoading, setCommentsLoading] = useState<CommentLoadingMap>({});
  const [members, setMembers] = useState<PharmacyMember[]>([]);
  const [tagAnchorEl, setTagAnchorEl] = useState<null | HTMLElement>(null);
  const [tagContext, setTagContext] = useState<TagContext | null>(null);
  const [postEditor, setPostEditor] = useState<PostEditorState | null>(null);
  const [postMenuAnchor, setPostMenuAnchor] = useState<HTMLElement | null>(null);
  const [postMenuPostId, setPostMenuPostId] = useState<number | null>(null);
  const [postMenuLoading, setPostMenuLoading] = useState(false);
  const activeMenuPost = useMemo(
    () => posts.find((post) => post.id === postMenuPostId) ?? null,
    [posts, postMenuPostId]
  );

  const updatePosts = useCallback(
    (updater: (prev: HubPost[]) => HubPost[]) => {
      setPosts((prev) => sortHubPosts(updater(prev)));
    },
    []
  );

  const applyPostUpdate = useCallback(
    (updatedPost: HubPost, options: { replaceComments?: boolean } = {}) => {
      updatePosts((prev) => {
        const exists = prev.some((post) => post.id === updatedPost.id);
        if (exists) {
          return prev.map((post) => (post.id === updatedPost.id ? updatedPost : post));
        }
        return [updatedPost, ...prev];
      });
      setCommentsByPost((prev) => {
        if (!options.replaceComments && prev[updatedPost.id]) {
          return prev;
        }
        return { ...prev, [updatedPost.id]: updatedPost.recentComments };
      });
    },
    [updatePosts]
  );
useEffect(() => {
 
    if (pharmacyMemberships.length && !selectedPharmacyId) {

      setSelectedPharmacyId(pharmacyMemberships[0].id); 

    }

  }, [pharmacyMemberships, selectedPharmacyId]);

  useEffect(() => {

    if (!selectedPharmacyId) {  
      setPosts([]);
 
      return;

    }

    let active = true;

    setLoadingPosts(true);
    fetchPharmacyHubPosts(selectedPharmacyId)
      .then((payload) => {
        if (!active) return;
        setPosts(sortHubPosts(payload.results));
        setCommentsByPost(() => {
          const next: CommentListMap = {};
          payload.results.forEach((post) => {
            next[post.id] = post.recentComments; 
          });
          return next;
 
        });

      })

      .catch(() => {

        if (!active) return;

        setPosts([]);

        setSnackbar({

          open: true,

          message: "Unable to load hub posts. Please try again.",

          severity: "error",

        });

      })

      .finally(() => {

        if (active) setLoadingPosts(false);

      });

    return () => {

      active = false;

    };
  }, [selectedPharmacyId]);
useEffect(() => {

    if (!selectedPharmacyId) {
      setMembers([]);
 return;

    }

    let ignore = false;

    apiClient

      .get(API_ENDPOINTS.membershipList, {

        params: { pharmacy: selectedPharmacyId, is_active: true },

      })

      .then((res) => {

        if (ignore) return; 
        const payload = Array.isArray(res.data?.results) ? res.data.results : Array.isArray(res.data) ? res.data : [];
const mapped: PharmacyMember[] = payload.map((item: any) => {

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

            role: (item.role ?? "MEMBER") as string,

          };

        }); 
        setMembers(mapped);  
      })
 
      .catch(() => {
        if (!ignore) setMembers([]); 
 });

    return () => {

      ignore = true; 
};
  }, [selectedPharmacyId]); 
  useEffect(() => { 
    if (!selectedPharmacyId) {
 
      return undefined;

    }
    const intervalId = window.setInterval(async () => {
      try {
        const payload = await fetchPharmacyHubPosts(selectedPharmacyId);
        setPosts(sortHubPosts(payload.results)); 
        setCommentsByPost((prev) => {

          const next: CommentListMap = {};
 
          payload.results.forEach((post) => {

            const existing = prev[post.id];
            next[post.id] = existing && existing.length > post.recentComments.length ? existing : post.recentComments; 
  });

          return next;

        });

      } catch {

        // ignore polling errors

      }

    }, HUB_POLL_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [selectedPharmacyId]);
  const openTagMenu = (event: ReactMouseEvent<HTMLElement>, context: TagContext) => {

    setTagAnchorEl(event.currentTarget);

    setTagContext(context);

  };

  const closeTagMenu = () => {

    setTagAnchorEl(null);

    setTagContext(null);

  };

  const insertTag = (tagLabel: string) => { 

    if (!tagContext) return;

    if (tagContext.type === "composer") {

      setComposerValue((prev) => addTagToText(prev, tagLabel));

    } else {

      const { postId } = tagContext;

      setCommentDrafts((prev) => ({

        ...prev,

        [postId]: addTagToText(prev[postId] ?? "", tagLabel),

      }));

    }
 };
 
  const handleSelectTag = (member: PharmacyMember | "everyone") => {
    const tag = member === "everyone" ? "@everyone" : `@${member.name}`;
    insertTag(tag);
    closeTagMenu();
  };
  const handleComposerFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const fileList = event.target.files;
    if (!fileList) return;
    const drafts: AttachmentDraft[] = Array.from(fileList).map((file) => ({
      id: generateDraftId(),
      file,
      preview: URL.createObjectURL(file),
    }));
    if (!drafts.length) return;
    setComposerAttachments((prev) => [...prev, ...drafts]);
    event.target.value = "";
  };

  const removeComposerAttachment = (draftId: string) => {
    setComposerAttachments((prev) => {
      const target = prev.find((item) => item.id === draftId);
      if (target) {
        URL.revokeObjectURL(target.preview);
      }
      return prev.filter((item) => item.id !== draftId);
    });
  };

  const clearComposerAttachments = () => {
    setComposerAttachments((prev) => {
      prev.forEach((item) => URL.revokeObjectURL(item.preview));
      return [];
    });
  };

  const openPostEditor = (post: HubPost) => {
    if (post.isDeleted) return;
    setPostEditor({
      postId: post.id,
      value: post.body,
      removeAttachmentIds: [],
      newAttachments: [],
      saving: false,
    });
  };

  const closePostEditor = () => {
    setPostEditor((prev) => {
      prev?.newAttachments.forEach((item) => URL.revokeObjectURL(item.preview));
      return null;
    });
  };

  const updatePostEditorValue = (value: string) => {
    setPostEditor((prev) => (prev ? { ...prev, value } : prev));
  };

  const handlePostEditorFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;
    const drafts: AttachmentDraft[] = Array.from(files).map((file) => ({
      id: generateDraftId(),
      file,
      preview: URL.createObjectURL(file),
    }));
    if (!drafts.length) return;
    setPostEditor((prev) =>
      prev
        ? {
            ...prev,
            newAttachments: [...prev.newAttachments, ...drafts],
          }
        : prev
    );
    event.target.value = "";
  };

  const removePostEditorNewAttachment = (draftId: string) => {
    setPostEditor((prev) => {
      if (!prev) return prev;
      const target = prev.newAttachments.find((item) => item.id === draftId);
      if (target) {
        URL.revokeObjectURL(target.preview);
      }
      return {
        ...prev,
        newAttachments: prev.newAttachments.filter((item) => item.id !== draftId),
      };
    });
  };

  const togglePostEditorAttachmentRemoval = (attachmentId: number) => {
    setPostEditor((prev) => {
      if (!prev) return prev;
      const exists = prev.removeAttachmentIds.includes(attachmentId);
      return {
        ...prev,
        removeAttachmentIds: exists
          ? prev.removeAttachmentIds.filter((id) => id !== attachmentId)
          : [...prev.removeAttachmentIds, attachmentId],
      };
    });
  };

  const submitPostEditor = async () => {
    if (!selectedPharmacyId || !postEditor) return;
    const trimmed = postEditor.value.trim();
    if (!trimmed) {
      setSnackbar({
        open: true,
        message: "Post content cannot be empty.",
        severity: "error",
      });
      return;
    }
    setPostEditor((prev) => (prev ? { ...prev, saving: true } : prev));
    try {
      const updated = await updatePharmacyHubPost(selectedPharmacyId, postEditor.postId, {
        body: trimmed,
        attachments: postEditor.newAttachments.map((item) => item.file),
        removeAttachmentIds: postEditor.removeAttachmentIds,
      });
      applyPostUpdate(updated, { replaceComments: true });
      setSnackbar({ open: true, message: "Post updated.", severity: "success" });
      closePostEditor();
    } catch (error: any) {
      setSnackbar({
        open: true,
        message: error?.response?.data?.detail ?? "Could not update post.",
        severity: "error",
      });
      setPostEditor((prev) => (prev ? { ...prev, saving: false } : prev));
    }
  };

  const startEditingComment = (_postId: number, comment: HubComment) => {
    void _postId;
    if (comment.isDeleted) return;
    setEditingCommentId(comment.id);
    setCommentEditDrafts((prev) => ({
      ...prev,
      [comment.id]: comment.body,
    }));
  };

  const cancelEditingComment = (commentId?: number) => {
    if (commentId !== undefined) {
      setCommentEditDrafts((prev) => {
        const next = { ...prev };
        delete next[commentId];
        return next;
      });
    }
    setEditingCommentId(null);
    setCommentSavingId(null);
  };

  const saveCommentEdit = async (postId: number, commentId: number) => {
    if (!selectedPharmacyId) return;
    const draft = (commentEditDrafts[commentId] ?? "").trim();
    if (!draft) {
      setSnackbar({
        open: true,
        message: "Comment cannot be empty.",
        severity: "error",
      });
      return;
    }
    setCommentSavingId(commentId);
    try {
      const updated = await updatePharmacyHubComment(selectedPharmacyId, postId, commentId, {
        body: draft,
      });
      const existingComments = commentsByPost[postId] ?? [];
      const nextComments = existingComments.map((comment) =>
        comment.id === commentId ? updated : comment
      );
      setCommentsByPost((prev) => ({
        ...prev,
        [postId]: nextComments,
      }));
      const nonDeleted = nextComments.filter((comment) => !comment.isDeleted);
      setPosts((prev) =>
        prev.map((post) =>
          post.id === postId
            ? {
                ...post,
                recentComments: nonDeleted.slice(-2),
              }
            : post
        )
      );
      setSnackbar({ open: true, message: "Comment updated.", severity: "success" });
      cancelEditingComment(commentId);
    } catch (error: any) {
      setSnackbar({
        open: true,
        message: error?.response?.data?.detail ?? "Could not update comment.",
        severity: "error",
      });
      setCommentSavingId(null);
    }
  };
  const handleCreatePost = async () => {
    if (!selectedPharmacyId) {
      return;
    }
    const trimmed = composerValue.trim();
    if (!trimmed) {
      return;
    }
    setSubmittingPost(true);
    try {
      const newPost = await createPharmacyHubPost(selectedPharmacyId, {
        body: trimmed,
        attachments: composerAttachments.map((item) => item.file),
      });
      applyPostUpdate(newPost, { replaceComments: true });
      setComposerValue("");
      clearComposerAttachments();
      setSnackbar({ open: true, message: "Post shared with the team.", severity: "success" });
    } catch (error: any) { 
      setSnackbar({ open: true, message: error?.response?.data?.detail ?? "Could not create post.", severity: "error" });
    } finally {
      setSubmittingPost(false);  
    }
};

  const handleDeletePost = async (postId: number) => {
    if (!selectedPharmacyId) return;
    try {
      await deletePharmacyHubPost(selectedPharmacyId, postId);
      updatePosts((prev) =>
        prev.map((post) =>
          post.id === postId
            ? {
                ...post,
                isDeleted: true,
                body: "This post has been deleted.",
                attachments: [],
                allowComments: false,
              }
            : post
        )
      );
      setSnackbar({ open: true, message: "Post marked as deleted.", severity: "success" });
    } catch {
      setSnackbar({ open: true, message: "Could not delete post.", severity: "error" });
    }
  };

  const handleOpenPostMenu = (event: ReactMouseEvent<HTMLButtonElement>, postId: number) => {
    setPostMenuAnchor(event.currentTarget);
    setPostMenuPostId(postId);
    setPostMenuLoading(false);
  };

  const handleClosePostMenu = () => {
    if (postMenuLoading) return;
    setPostMenuAnchor(null);
    setPostMenuPostId(null);
  };

  const finishPostMenuAction = useCallback(() => {
    setPostMenuAnchor(null);
    setPostMenuPostId(null);
    setPostMenuLoading(false);
  }, []);

  const handleMenuEdit = () => {
    if (!activeMenuPost || activeMenuPost.isDeleted) {
      handleClosePostMenu();
      return;
    }
    setPostMenuAnchor(null);
    setPostMenuPostId(null);
    openPostEditor(activeMenuPost);
  };

  const handleMenuDelete = async () => {
    if (!activeMenuPost) return;
    setPostMenuLoading(true);
    try {
      await handleDeletePost(activeMenuPost.id);
    } finally {
      finishPostMenuAction();
    }
  };

  const handleMenuToggleComments = async (post: HubPost) => {
    if (!selectedPharmacyId) return;
    setPostMenuLoading(true);
    try {
      const updated = await updatePharmacyHubPost(selectedPharmacyId, post.id, {
        allowComments: !post.allowComments,
      });
      applyPostUpdate(updated, { replaceComments: false });
      setSnackbar({
        open: true,
        message: updated.allowComments
          ? "Comments enabled for this post."
          : "Comments disabled for this post.",
        severity: "success",
      });
    } catch (error: any) {
      setSnackbar({
        open: true,
        message: error?.response?.data?.detail ?? "Could not update comment settings.",
        severity: "error",
      });
    } finally {
      finishPostMenuAction();
    }
  };

  const handleMenuPinChange = async (post: HubPost, pin: boolean) => {
    if (!selectedPharmacyId) return;
    setPostMenuLoading(true);
    try {
      const updated = pin
        ? await pinPharmacyHubPost(selectedPharmacyId, post.id)
        : await unpinPharmacyHubPost(selectedPharmacyId, post.id);
      applyPostUpdate(updated, { replaceComments: false });
      setSnackbar({
        open: true,
        message: pin ? "Post pinned to top." : "Post unpinned.",
        severity: "success",
      });
    } catch (error: any) {
      setSnackbar({
        open: true,
        message: error?.response?.data?.detail ?? "Could not update pin state.",
        severity: "error",
      });
    } finally {
      finishPostMenuAction();
    }
  };

  const toggleComments = async (postId: number) => {
    const nextSet = new Set(expandedPostIds);
    if (nextSet.has(postId)) {
      nextSet.delete(postId);
      setExpandedPostIds(nextSet);
      return;
    }

    nextSet.add(postId);
    setExpandedPostIds(nextSet);

    if (!selectedPharmacyId) return;
    setCommentsLoading((prev) => ({ ...prev, [postId]: true }));
    try {
      const comments = await fetchPharmacyHubComments(selectedPharmacyId, postId);
      setCommentsByPost((prev) => ({ ...prev, [postId]: comments }));
    } catch {
      setSnackbar({ open: true, message: "Could not load comments.", severity: "error" });
    } finally {
      setCommentsLoading((prev) => ({ ...prev, [postId]: false }));
    }
  };

  const handleCommentChange = (postId: number, value: string) => {

    setCommentDrafts((prev) => ({ ...prev, [postId]: value }));

  };

  const handleSubmitComment = async (postId: number) => {
    if (!selectedPharmacyId) return;
    const body = (commentDrafts[postId] || "").trim(); 
    if (!body) return;
    const targetPost = posts.find((post) => post.id === postId);
    if (targetPost?.isDeleted) { 
      setSnackbar({ open: true, message: "Cannot comment on a deleted post.", severity: "error" });
      return;
    }
    if (targetPost && !targetPost.allowComments) {
      setSnackbar({ open: true, message: "Comments are disabled for this post.", severity: "error" });
      return;
    }

    setCommentsLoading((prev) => ({ ...prev, [postId]: true }));
    try {
      const replyTarget = replyTargets[postId];
      const comment = await createPharmacyHubComment(selectedPharmacyId, postId, {
        body,
        parentComment: replyTarget ? replyTarget.id : null,
      });
      const existingComments = commentsByPost[postId] ?? [];
      const updatedComments = [...existingComments, comment];
      setCommentsByPost((prev) => {
        return { ...prev, [postId]: updatedComments };
      });
      setCommentDrafts((prev) => ({ ...prev, [postId]: "" }));
      setReplyTargets((prev) => ({ ...prev, [postId]: null }));
      const nonDeleted = updatedComments.filter((item) => !item.isDeleted);
      updatePosts((prev) =>
        prev.map((post) =>
          post.id === postId
            ? {
                ...post,
                commentCount: post.commentCount + 1,
                recentComments: nonDeleted.slice(-2),
              }
            : post
        )
      );
    } catch { 
      setSnackbar({ open: true, message: "Could not add comment.", severity: "error" });
    } finally {
 
      setCommentsLoading((prev) => ({ ...prev, [postId]: false }));

    }

  };

  const handleDeleteComment = async (postId: number, commentId: number) => {
    if (!selectedPharmacyId) return;
    setCommentsLoading((prev) => ({ ...prev, [postId]: true }));
    try {
      await deletePharmacyHubComment(selectedPharmacyId, postId, commentId);
      const existing = commentsByPost[postId] ?? [];
      const updatedComments = existing.map((comment) =>
        comment.id === commentId
          ? {
              ...comment,
              isDeleted: true,
              body: "This comment has been deleted.",
              canEdit: false,
            }
          : comment
      );
      setCommentsByPost((prev) => ({
        ...prev,
        [postId]: updatedComments,
      }));
      const nonDeleted = updatedComments.filter((comment) => !comment.isDeleted);
      updatePosts((prev) =>
        prev.map((post) =>
          post.id === postId
            ? {
                ...post,
                commentCount: Math.max(0, post.commentCount - 1),
                recentComments: nonDeleted.slice(-2),
              }
            : post
        )
      );
      setSnackbar({ open: true, message: "Comment marked as deleted.", severity: "success" });
    } catch {
      setSnackbar({ open: true, message: "Could not delete comment.", severity: "error" });
    } finally {
      setCommentsLoading((prev) => ({ ...prev, [postId]: false }));
    }
  };

  const handleReact = async (postId: number, reaction: HubReactionType) => {
    if (!selectedPharmacyId) return;
    const targetPost = posts.find((post) => post.id === postId);
    if (targetPost?.isDeleted) {
      setSnackbar({ open: true, message: "Cannot react to a deleted post.", severity: "error" });
      return;
    }
    updatePosts((prev) =>
      prev.map((post) => {
        if (post.id !== postId) return post;
        const summary: Record<HubReactionType, number> = { ...post.reactionSummary } as Record<HubReactionType, number>;
        if (post.viewerReaction) {
          summary[post.viewerReaction] = Math.max(0, (summary[post.viewerReaction] ?? 1) - 1);
        }
        if (post.viewerReaction === reaction) {
          return { ...post, viewerReaction: null, reactionSummary: summary };
        }
        summary[reaction] = (summary[reaction] ?? 0) + 1;
        return { ...post, viewerReaction: reaction, reactionSummary: summary };
      })
    );

    try {
      if (targetPost?.viewerReaction === reaction) {
        await removePharmacyHubReaction(selectedPharmacyId, postId);
      } else { 
        await reactToPharmacyHubPost(selectedPharmacyId, postId, reaction);
      }
    } catch { 
      setSnackbar({ open: true, message: "Could not update reaction.", severity: "error" });
      const refreshed = await fetchPharmacyHubPosts(selectedPharmacyId);
      setPosts(sortHubPosts(refreshed.results));
setCommentsByPost((prev) => {

        const next: CommentListMap = {};

        refreshed.results.forEach((post) => {
 
          next[post.id] = prev[post.id] ?? post.recentComments;

        });

        return next;
      });
    }
  };

  const selectedMembership = useMemo(() => {
    if (!selectedPharmacyId) return null;
    return pharmacyMemberships.find((ph) => ph.id === selectedPharmacyId) ?? null;
  }, [pharmacyMemberships, selectedPharmacyId]);
  const editingPost = postEditor ? posts.find((post) => post.id === postEditor.postId) ?? null : null;
  const renderCommentNode = (node: CommentNode, depth = 0, postId: number) => {
    const isEditing = editingCommentId === node.id;
    const draftValue = commentEditDrafts[node.id] ?? node.body;
    const isSaving = commentSavingId === node.id;
    const isPostLoading = commentsLoading[postId] ?? false;
    return (
      <Box key={node.id} pl={depth ? 6 : 0} pt={depth ? 1.5 : 0}>
        <Stack direction="row" spacing={2} alignItems="flex-start">
          <Avatar sx={{ width: 36, height: 36 }}>
            {getInitials({
              firstName: node.author.user.firstName,
              lastName: node.author.user.lastName,
              email: node.author.user.email,
            })}
          </Avatar>
          <Box flexGrow={1}>
            <Paper
              variant="outlined"
              sx={{
                px: 2,
                py: 1.5,
                borderRadius: 2,
                borderColor: depth ? "transparent" : "divider",
                backgroundColor: depth ? "grey.50" : "background.paper",
              }}
            >
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" rowGap={1}>
                <Typography fontWeight={600}>
                  {formatDisplayName({
                    firstName: node.author.user.firstName,
                    lastName: node.author.user.lastName,
                    email: node.author.user.email,
                  })}
                </Typography>
                <Chip size="small" label={node.author.role.replace(/_/g, " ")} />
                <Typography variant="caption" color="text.secondary">
                  {dayjs(node.createdAt).format("MMM D, YYYY h:mm A")}
                </Typography>
                {node.isEdited && !node.isDeleted && (
                  <Tooltip
                    title={node.originalBody ? node.originalBody : "Original content unavailable."}
                  >
                    <Chip size="small" label="Edited" variant="outlined" />
                  </Tooltip>
                )}
                {node.isDeleted && <Chip size="small" label="Deleted" color="error" variant="outlined" />}
              </Stack>
              {isEditing ? (
                <>
                  <TextField
                    value={draftValue}
                    onChange={(event) =>
                      setCommentEditDrafts((prev) => ({
                        ...prev,
                        [node.id]: event.target.value,
                      }))
                    }
                    multiline
                    minRows={2}
                    fullWidth
                    disabled={isSaving}
                    sx={{ mt: 1 }}
                  />
                  <Stack direction="row" spacing={1} mt={1}>
                    <Button
                      variant="contained"
                      size="small"
                      onClick={() => saveCommentEdit(postId, node.id)}
                      disabled={isSaving || !draftValue.trim()}
                    >
                      {isSaving ? "Saving..." : "Save"}
                    </Button>
                    <Button
                      size="small"
                      onClick={() => cancelEditingComment(node.id)}
                      disabled={isSaving}
                    >
                      Cancel
                    </Button>
                  </Stack>
                </>
              ) : (
                <Typography
                  variant="body2"
                  mt={0.75}
                  whiteSpace="pre-line"
                  color={node.isDeleted ? "text.secondary" : "text.primary"}
                  sx={{ fontStyle: node.isDeleted ? "italic" : "normal" }}
                >
                  {node.body}
                </Typography>
              )}
            </Paper>
            <Stack direction="row" spacing={1.5} alignItems="center" mt={0.75}>
              <Button
                size="small"
                startIcon={<ReplyIcon fontSize="small" />}
                onClick={() =>
                  setReplyTargets((prev) => ({
                    ...prev,
                    [postId]: node,
                  }))
                }
                disabled={node.isDeleted || isPostLoading}
              >
                Reply
              </Button>
              {node.canEdit && !node.isDeleted && !isEditing && (
                <Button
                  size="small"
                  startIcon={<EditOutlinedIcon fontSize="small" />}
                  onClick={() => startEditingComment(postId, node)}
                  disabled={isPostLoading}
                >
                  Edit
                </Button>
              )}
              {node.canEdit && (
                <Button
                  size="small"
                  color="error"
                  startIcon={<DeleteOutlineIcon fontSize="small" />}
                  onClick={() => handleDeleteComment(postId, node.id)}
                  disabled={isPostLoading}
                >
                  Delete
                </Button>
              )}
            </Stack>
          </Box>
        </Stack>
        {node.replies.map((child) => renderCommentNode(child, depth + 1, postId))}
      </Box>
    );
  };
return (
 
    <Box

      sx={{

        py: { xs: 3, md: 4 },

        px: { xs: 1, md: 2 },

        bgcolor: "grey.50",

        minHeight: "100%",

      }}

    >

      <Stack spacing={3} maxWidth="min(920px, 100%)" mx="auto">

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

                  {headline} 

                </Typography>

                <Typography variant="body2" sx={{ opacity: 0.85 }}>
                  Share announcements, celebrate wins, and keep your team aligned in one place.

                  {subheading}
 
                </Typography> 
 </Box>
 
            </Stack>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}> 
<Select

                fullWidth

                size="small"

                value={selectedPharmacyId ?? ""}

                onChange={(event) => setSelectedPharmacyId(Number(event.target.value))}

                sx={{

                  bgcolor: "rgba(255,255,255,0.15)",

                  color: "white",
 
                  "& .MuiSelect-icon": { color: "white" },
                  minWidth: { xs: "100%", sm: 280 },
  }}

              >

                {pharmacyMemberships.map((membership) => (

                  <MenuItem key={membership.id} value={membership.id}>

                    {membership.name} ({membership.role})

                  </MenuItem>

                ))}

              </Select>
{selectedMembership && (
 
                <Chip

                  label={`${selectedMembership.role.replace(/_/g, " ")} access`}

                  sx={{ alignSelf: "center", bgcolor: "rgba(255,255,255,0.18)", color: "white" }}

                />

              )}

            </Stack>

          </Stack>

        </Paper> 
        <Paper
          variant="outlined"
          sx={{
            borderRadius: 3,
            p: { xs: 2, md: 3 },
            boxShadow: "0 10px 28px rgba(15,23,42,0.08)",
            borderColor: "divider",
          }}
        >
          <Stack direction="row" spacing={2} alignItems="flex-start">
            <Avatar sx={{ width: 48, height: 48 }}>{getInitials(viewerUser)}</Avatar>
            <Box flexGrow={1}>
              <Typography fontWeight={600} mb={0.5}>
                Share an update with your team
              </Typography>
              <TextField
                placeholder="Announce new roster updates, reminders, or shout-outs..."
                multiline
                minRows={3}
                fullWidth
                value={composerValue}
                onChange={(event) => setComposerValue(event.target.value)}
              />
              {composerAttachments.length > 0 && (
                <Stack direction="row" spacing={1.5} flexWrap="wrap" mt={1}>
                  {composerAttachments.map((attachment) => {
                    const isImage = attachment.file.type.startsWith("image/");
                    if (isImage) {
                      return (
                        <Box
                          key={attachment.id}
                          sx={{
                            position: "relative",
                            width: 136,
                            height: 96,
                            borderRadius: 2,
                            overflow: "hidden",
                            border: "1px solid",
                            borderColor: "divider",
                          }}
                        >
                          <Box
                            component="img"
                            src={attachment.preview}
                            alt={attachment.file.name}
                            sx={{ width: "100%", height: "100%", objectFit: "cover" }}
                          />
                          <IconButton
                            size="small"
                            onClick={() => removeComposerAttachment(attachment.id)}
                            sx={{
                              position: "absolute",
                              top: 4,
                              right: 4,
                              bgcolor: "rgba(0,0,0,0.6)",
                              color: "white",
                              "&:hover": { bgcolor: "rgba(0,0,0,0.8)" },
                            }}
                          >
                            <CloseRoundedIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      );
                    }
                    return (
                      <Chip
                        key={attachment.id}
                        icon={<InsertDriveFileOutlinedIcon fontSize="small" />}
                        label={attachment.file.name}
                        onDelete={() => removeComposerAttachment(attachment.id)}
                        deleteIcon={<CloseRoundedIcon />}
                        sx={{ maxWidth: 220 }}
                      />
                    );
                  })}
                </Stack>
              )}
              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
                mt={1.5}
                flexWrap="wrap"
                rowGap={1}
              >
                <Stack direction="row" spacing={1} alignItems="center">
                  <Tooltip title="Tag someone">
                    <IconButton color="primary" onClick={(event) => openTagMenu(event, { type: "composer" })}>
                      <AlternateEmailIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Button
                    size="small"
                    onClick={() => insertTag("@everyone")}
                    startIcon={<AlternateEmailIcon fontSize="small" />}
                  >
                    Tag everyone
                  </Button>
                  <Button
                    size="small"
                    component="label"
                    startIcon={<AttachFileOutlinedIcon fontSize="small" />}
                  >
                    Add attachments
                    <input
                      type="file"
                      hidden
                      multiple
                      onChange={handleComposerFileChange}
                      accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.csv,.zip,.txt"
                    />
                  </Button>
                </Stack>
                <Button
                  variant="contained"
                  startIcon={<SendIcon />}
                  onClick={handleCreatePost}
                  disabled={submittingPost || !composerValue.trim()}
                >
                  {submittingPost ? "Posting..." : "Post to Hub"}
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
            No updates yet. Start the conversation with your team above. 
          </Alert>

        ) : (
 
          posts.map((post) => {

            const comments = commentsByPost[post.id] ?? post.recentComments;

            const commentTree = buildCommentTree(comments);
            const reactionSummaryEntries = Object.entries(post.reactionSummary).filter(
              ([, count]) => count > 0
            ) as [HubReactionType, number][];
            const isExpanded = expandedPostIds.has(post.id);
            const replyingTo = replyTargets[post.id];
            const commentsDisabled = post.isDeleted || !post.allowComments;
            return (

              <Paper

                key={post.id}

                variant="outlined"

                sx={{

                  borderRadius: 3,

                  p: { xs: 2, md: 3 },

                  boxShadow: "0 14px 35px rgba(15,23,42,0.08)",

                  borderColor: "divider",

                }}

              >

                <Stack direction="row" spacing={2} alignItems="flex-start">

                  <Avatar sx={{ width: 48, height: 48 }}>

                    {getInitials({

                      firstName: post.author.user.firstName,

                      lastName: post.author.user.lastName,

                      email: post.author.user.email,

                    })}

                  </Avatar>

                  <Box flexGrow={1}>
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" rowGap={1}>
                      <Typography fontWeight={700}>
                        {formatDisplayName({
                          firstName: post.author.user.firstName,
                          lastName: post.author.user.lastName,
                          email: post.author.user.email,
                        })}
                      </Typography>
                      <Chip size="small" label={post.author.role.replace(/_/g, " ")} />
                      <Typography variant="caption" color="text.secondary">
                        {dayjs(post.createdAt).format("MMM D, YYYY h:mm A")}
                      </Typography>
                      {post.isEdited && !post.isDeleted && (
                        <Tooltip
                          title={post.originalBody ? post.originalBody : "Original content unavailable."}
                        >
                          <Chip size="small" label="Edited" variant="outlined" />
                        </Tooltip>
                      )}
                      {post.isPinned && (
                        <Chip
                          size="small"
                          color="warning"
                          variant="outlined"
                          icon={<PushPinOutlinedIcon fontSize="small" />}
                          label="Pinned"
                        />
                      )}
                      {post.isDeleted && <Chip size="small" label="Deleted" color="error" variant="outlined" />}
                      <Box sx={{ flexGrow: 1 }} />
                      {(post.canManage || post.viewerIsAdmin) && (
                        <IconButton
                          size="small"
                          onClick={(event) => handleOpenPostMenu(event, post.id)}
                          disabled={postMenuLoading && postMenuPostId === post.id}
                        >
                          <MoreVertIcon fontSize="small" />
                        </IconButton>
                      )}
                    </Stack>
                    <Typography variant="body1" mt={1.5} whiteSpace="pre-line">
                      {post.body}
                    </Typography>
                    {post.attachments.length > 0 && (
                      <Stack direction="row" spacing={1.5} flexWrap="wrap" mt={2}>
                      {post.attachments.map((attachment) => {
                        const key = `${post.id}-${attachment.id}`;
                        const attachmentUrl = attachment.url ?? undefined;
                        if ((attachment.kind === "IMAGE" || attachment.kind === "GIF") && attachmentUrl) {
                          return (
                            <Stack
                              key={key}
                              spacing={0.5}
                              sx={{
                                flexBasis: { xs: "100%", sm: "auto" },
                                maxWidth: "100%",
                              }}
                            >
                              <Tooltip title="Click to open full size">
                                <Box
                                  component="img"
                                  src={attachmentUrl}
                                  alt={attachment.filename ?? "Attachment"}
                                  loading="lazy"
                                  onClick={() => window.open(attachmentUrl, "_blank", "noopener")}
                                  sx={{
                                    width: "100%",
                                    maxWidth: 520,
                                    maxHeight: 520,
                                    borderRadius: 2,
                                    border: "1px solid",
                                    borderColor: "divider",
                                    objectFit: "contain",
                                    cursor: "zoom-in",
                                    backgroundColor: "grey.100",
                                  }}
                                />
                              </Tooltip>
                              {attachment.filename && (
                                <Button
                                  size="small"
                                  variant="text"
                                  onClick={() => window.open(attachmentUrl, "_blank", "noopener")}
                                  sx={{ alignSelf: "flex-start", textTransform: "none" }}
                                >
                                  {attachment.filename}
                                </Button>
                              )}
                            </Stack>
                          );
                        }
                        return (
                          <Button
                            key={key}
                            variant="outlined"
                            startIcon={<InsertDriveFileOutlinedIcon />}
                            component="a"
                            href={attachmentUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            disabled={!attachmentUrl}
                            sx={{ textTransform: "none" }}
                          >
                            {attachment.filename ?? "Download attachment"}
                          </Button>
                        );
                      })}
                    </Stack>
                  )}
                    <Stack direction="row" spacing={2} alignItems="center" mt={2} flexWrap="wrap">
                      {REACTIONS.map((reaction) => {
                        const isActive = post.viewerReaction === reaction.type;
                        return (
                          <Button
                            key={reaction.type}
                            size="small"
                            variant={isActive ? "contained" : "text"}
                            color={isActive ? "primary" : "inherit"}
                            onClick={() => handleReact(post.id, reaction.type)}
                            startIcon={<reaction.Icon fontSize="small" />}
                            disabled={post.isDeleted}
                          >
                            {reaction.label}
                          </Button>
                        );
                      })}
 {reactionSummaryEntries.length > 0 && (

                        <Stack direction="row" spacing={1}>

                          {reactionSummaryEntries.map(([type, count]) => {

                            const reactionConfig = REACTIONS.find((item) => item.type === type);

                            if (!reactionConfig) return null;

                            return (

                              <Chip

                                key={type}

                                size="small"

                                color="primary"

                                variant="outlined"

                                icon={<reactionConfig.Icon fontSize="small" />}

                                label={`${count} ${reactionConfig.label}`}

                              />

                            );

                          })}

                        </Stack>

                      )}

                      <Button 

                        size="small"

                        startIcon={<CommentIcon fontSize="small" />}

                        onClick={() => toggleComments(post.id)}

                      >

                        {post.commentCount} {post.commentCount === 1 ? "Comment" : "Comments"}

                      </Button>

                    </Stack>

                  </Box>

                </Stack> 

                <Collapse in={isExpanded} timeout="auto" unmountOnExit>

                  <Divider sx={{ my: 2.5 }} />

                  {commentsLoading[post.id] ? (

                    <Stack alignItems="center" py={2}>

                      <CircularProgress size={24} />

                    </Stack>

                  ) : commentTree.length === 0 ? (

                    <Typography variant="body2" color="text.secondary">

                      No comments yet. Be the first to respond.

                    </Typography>

                  ) : (

                    <Stack spacing={2.5}>{commentTree.map((node) => renderCommentNode(node, 0, post.id))}</Stack>

                  )}

                  <Box mt={3}>
                    {!commentsDisabled && replyingTo && (
                      <Paper 
                        variant="outlined"
                        sx={{
                          mb: 1, 
                          px: 1.5,
py: 1,

                          borderRadius: 2,

                          borderColor: "primary.light",

                          bgcolor: "primary.50",

                        }}

                      >

                        <Stack direction="row" spacing={1} alignItems="center">

                          <Typography variant="body2" color="primary">

                            Replying to {formatDisplayName({

                              firstName: replyingTo.author.user.firstName,

                              lastName: replyingTo.author.user.lastName,

                              email: replyingTo.author.user.email,

                            })}

                          </Typography>

                          <Button

                            size="small"

                            onClick={() =>

                              setReplyTargets((prev) => ({

                                ...prev,

                                [post.id]: null,

                              }))

                            }

                          >

                            Cancel
                          </Button>
                        </Stack>
                      </Paper>
                    )}
                    {commentsDisabled ? (
                      <Typography variant="body2" color="text.secondary" mt={1}>
                        {post.isDeleted
                          ? "Comments are disabled for deleted posts."
                          : "Comments have been turned off for this post."}
                      </Typography>
                    ) : (
                      <Stack direction="row" spacing={2} alignItems="flex-start">
                        <Avatar sx={{ width: 36, height: 36 }}>{getInitials(viewerUser)}</Avatar>
                        <Box flexGrow={1}>
                          <TextField
                            placeholder="Add a comment..."
                            multiline
                            minRows={1}
                            maxRows={6}
                            fullWidth
                            value={commentDrafts[post.id] ?? ""}
                            onChange={(event) => handleCommentChange(post.id, event.target.value)}
                          />
                          <Stack direction="row" justifyContent="space-between" alignItems="center" mt={1}>
                            <Tooltip title="Tag someone">
                              <IconButton
                                color="primary"
                                onClick={(event) => openTagMenu(event, { type: "comment", postId: post.id })}
                                disabled={commentsLoading[post.id]}
                              >
                                <AlternateEmailIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Button
                              variant="contained"
                              size="small"
                              startIcon={<SendIcon fontSize="small" />}
                              disabled={commentsLoading[post.id] || !(commentDrafts[post.id] ?? "").trim()}
                              onClick={() => handleSubmitComment(post.id)}
                            >
                              Comment
                            </Button>
                          </Stack>
                        </Box>
                      </Stack>
                    )}
                  </Box>
                </Collapse>
              </Paper>
            );
          })
        )}
      </Stack>
      <Dialog
        open={Boolean(postEditor)}
        fullWidth
        maxWidth="sm"
        onClose={(_, _reason) => {
          if (postEditor?.saving) return;
          closePostEditor();
        }}
      >
        <DialogTitle>Edit Hub Post</DialogTitle>
        <DialogContent dividers>
          {postEditor && (
            <Stack spacing={2}>
              <TextField
                label="Post"
                multiline
                minRows={3}
                value={postEditor.value}
                onChange={(event) => updatePostEditorValue(event.target.value)}
                disabled={postEditor.saving}
              />
              <Stack spacing={1}>
                <Typography variant="subtitle2">Existing attachments</Typography>
                {editingPost && editingPost.attachments.length > 0 ? (
                  editingPost.attachments.map((attachment) => {
                    const marked = postEditor.removeAttachmentIds.includes(attachment.id);
                    return (
                      <Stack key={attachment.id} direction="row" spacing={1} alignItems="center">
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={marked}
                              onChange={() => togglePostEditorAttachmentRemoval(attachment.id)}
                              disabled={postEditor.saving}
                            />
                          }
                          label={`${attachment.filename ?? "Attachment"}${
                            marked ? " (will remove)" : ""
                          }`}
                        />
                        {attachment.url && (
                          <Button
                            size="small"
                            component="a"
                            href={attachment.url ?? undefined}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            View
                          </Button>
                        )}
                      </Stack>
                    );
                  })
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    No attachments on this post.
                  </Typography>
                )}
              </Stack>
              <Stack spacing={1}>
                <Button
                  size="small"
                  component="label"
                  startIcon={<AttachFileOutlinedIcon fontSize="small" />}
                  disabled={postEditor.saving}
                  sx={{ alignSelf: "flex-start" }}
                >
                  Add more attachments
                  <input
                    type="file"
                    hidden
                    multiple
                    onChange={handlePostEditorFileChange}
                    accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.csv,.zip,.txt"
                  />
                </Button>
                {postEditor.newAttachments.length > 0 && (
                  <Stack direction="row" spacing={1.5} flexWrap="wrap">
                    {postEditor.newAttachments.map((attachment) => {
                      const isImage = attachment.file.type.startsWith("image/");
                      if (isImage) {
                        return (
                          <Box
                            key={attachment.id}
                            sx={{
                              position: "relative",
                              width: 136,
                              height: 96,
                              borderRadius: 2,
                              overflow: "hidden",
                              border: "1px solid",
                              borderColor: "divider",
                            }}
                          >
                            <Box
                              component="img"
                              src={attachment.preview}
                              alt={attachment.file.name}
                              sx={{ width: "100%", height: "100%", objectFit: "cover" }}
                            />
                            <IconButton
                              size="small"
                              onClick={() => removePostEditorNewAttachment(attachment.id)}
                              sx={{
                                position: "absolute",
                                top: 4,
                                right: 4,
                                bgcolor: "rgba(0,0,0,0.6)",
                                color: "white",
                                "&:hover": { bgcolor: "rgba(0,0,0,0.8)" },
                              }}
                            >
                              <CloseRoundedIcon fontSize="small" />
                            </IconButton>
                          </Box>
                        );
                      }
                      return (
                        <Chip
                          key={attachment.id}
                          icon={<InsertDriveFileOutlinedIcon fontSize="small" />}
                          label={attachment.file.name}
                          onDelete={() => removePostEditorNewAttachment(attachment.id)}
                          deleteIcon={<CloseRoundedIcon />}
                          sx={{ maxWidth: 220 }}
                        />
                      );
                    })}
                  </Stack>
                )}
              </Stack>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={closePostEditor} disabled={postEditor?.saving}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={submitPostEditor}
            disabled={postEditor?.saving || !(postEditor?.value.trim())}
          >
            {postEditor?.saving ? "Saving..." : "Save changes"}
          </Button>
        </DialogActions>
      </Dialog>
      <Menu
        anchorEl={postMenuAnchor}
        open={Boolean(postMenuAnchor)}
        onClose={handleClosePostMenu}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        {activeMenuPost ? (
          <>
            {activeMenuPost.canManage && (
              <MenuItem
                onClick={handleMenuEdit}
                disabled={postMenuLoading || activeMenuPost.isDeleted}
              >
                <ListItemIcon>
                  <EditOutlinedIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText primary="Edit post" />
              </MenuItem>
            )}
            {activeMenuPost.canManage && (
              <MenuItem
                onClick={() => handleMenuToggleComments(activeMenuPost)}
                disabled={postMenuLoading || activeMenuPost.isDeleted}
              >
                <ListItemIcon>
                  {activeMenuPost.allowComments ? (
                    <SpeakerNotesOffOutlinedIcon fontSize="small" />
                  ) : (
                    <SpeakerNotesOutlinedIcon fontSize="small" />
                  )}
                </ListItemIcon>
                <ListItemText
                  primary={
                    activeMenuPost.allowComments ? "Turn off comments" : "Turn on comments"
                  }
                />
              </MenuItem>
            )}
            {activeMenuPost.canManage && (
              <MenuItem
                onClick={handleMenuDelete}
                disabled={postMenuLoading || activeMenuPost.isDeleted}
              >
                <ListItemIcon>
                  <DeleteOutlineIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText primary="Delete post" />
              </MenuItem>
            )}
            {activeMenuPost.viewerIsAdmin && (
              <>
                {(activeMenuPost.canManage || activeMenuPost.viewerIsAdmin) && (
                  <Divider sx={{ my: 0.5 }} />
                )}
                <MenuItem
                  onClick={() => handleMenuPinChange(activeMenuPost, !activeMenuPost.isPinned)}
                  disabled={postMenuLoading || activeMenuPost.isDeleted}
                >
                  <ListItemIcon>
                    <PushPinOutlinedIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText
                    primary={activeMenuPost.isPinned ? "Unpin post" : "Pin to top"}
                  />
                </MenuItem>
              </>
            )}
          </>
        ) : (
          <MenuItem disabled>
            <ListItemText primary="No actions available" />
          </MenuItem>
        )}
      </Menu>
      <Menu anchorEl={tagAnchorEl} open={Boolean(tagAnchorEl)} onClose={closeTagMenu}>
        <MenuItem onClick={() => handleSelectTag("everyone")}>@everyone</MenuItem>
        <Divider sx={{ my: 0.5 }} />
        {members.map((member) => (
          <MenuItem key={member.id} onClick={() => handleSelectTag(member)}>
            @{member.name}
          </MenuItem>
        ))}
      </Menu>
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert
          onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
          severity={snackbar.severity}
          sx={{ width: "100%" }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default PharmacyHubPage; 
