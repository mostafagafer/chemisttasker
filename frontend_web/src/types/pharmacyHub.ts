export type HubReactionType =
  | "LIKE"
  | "CELEBRATE"
  | "SUPPORT"
  | "INSIGHTFUL"
  | "LOVE";

export type HubUserSummary = {
  id: number;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
};

export type HubAttachment = {
  id: number;
  kind: "IMAGE" | "GIF" | "FILE";
  url: string | null;
  filename: string | null;
  uploadedAt: string;
};

export type HubMembership = {
  id: number;
  role: string;
  employmentType: string;
  user: {
    id: number;
    firstName: string | null;
    lastName: string | null;
    email: string;
  };
};

export type HubComment = {
  id: number;
  postId: number;
  body: string;
  createdAt: string;
  updatedAt: string;
  canEdit: boolean;
  author: HubMembership;
  parentCommentId: number | null;
  isEdited: boolean;
  originalBody: string;
  editedAt: string | null;
  editedBy: HubUserSummary | null;
  isDeleted: boolean;
};

export type HubPost = {
  id: number;
  pharmacyId: number | null;
  pharmacyName: string | null;
  communityGroupId: number | null;
  communityGroupName: string | null;
  organizationId: number | null;
  organizationName: string | null;
  body: string;
  visibility: "NORMAL" | "ANNOUNCEMENT";
  allowComments: boolean;
  createdAt: string;
  updatedAt: string;
  commentCount: number;
  reactionSummary: Record<HubReactionType, number>;
  viewerReaction: HubReactionType | null;
  canManage: boolean;
  author: HubMembership;
  recentComments: HubComment[];
  attachments: HubAttachment[];
  isEdited: boolean;
  isPinned: boolean;
  pinnedAt: string | null;
  pinnedBy: HubUserSummary | null;
  originalBody: string;
  editedAt: string | null;
  editedBy: HubUserSummary | null;
  viewerIsAdmin: boolean;
  isDeleted: boolean;
};

export type HubPostPayload = {
  body: string;
  visibility?: HubPost["visibility"];
  allowComments?: boolean;
  attachments?: File[];
  removeAttachmentIds?: number[];
};

export type HubCommentPayload = {
  body: string;
  parentComment?: number | null;
};

export type CommunityGroupMember = {
  membershipId: number;
  member: HubMembership;
  isAdmin: boolean;
  joinedAt: string;
};

export type CommunityGroup = {
  id: number;
  pharmacyId: number;
  name: string;
  description: string | null;
  members: CommunityGroupMember[];
  memberCount: number;
  isAdmin: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: HubUserSummary | null;
};

export type CommunityGroupPayload = {
  name: string;
  description?: string | null;
  memberIds: number[];
};
