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
  jobTitle: string | null;
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
  deletedAt: string | null;
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
  scopeType: "pharmacy" | "group" | "organization";
  scopeTargetId: number | null;
  body: string;
  visibility: "NORMAL" | "ANNOUNCEMENT";
  allowComments: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  commentCount: number;
  reactionSummary: Record<string, number>;
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
  taggedMembers: HubTaggedMember[];
};

export type HubPollOption = {
  id: number;
  label: string;
  voteCount: number;
  percentage: number;
  position: number;
};

export type HubPoll = {
  id: number;
  question: string;
  createdAt: string;
  updatedAt: string;
  closesAt: string | null;
  isClosed: boolean;
  scopeType: HubScopeType;
  scopeTargetId: number | null;
  options: HubPollOption[];
  totalVotes: number;
  hasVoted: boolean;
  selectedOptionId: number | null;
  canVote: boolean;
};

export type HubPollPayload = {
  question: string;
  options: string[];
};

export type HubPostPayload = {
  body: string;
  visibility?: HubPost["visibility"];
  allowComments?: boolean;
  attachments?: File[];
  removeAttachmentIds?: number[];
  taggedMemberIds?: number[];
};

export type HubCommentPayload = {
  body: string;
  parentComment?: number | null;
};

export type HubPharmacy = {
  id: number;
  name: string;
  about: string | null;
  coverImageUrl: string | null;
  coverImage?: string | null;
  organizationId: number | null;
  organizationName: string | null;
  canManageProfile: boolean;
  canCreateGroup: boolean;
  canCreatePost: boolean;
};

export type HubOrganization = {
  id: number;
  name: string;
  about: string | null;
  coverImageUrl: string | null;
  coverImage?: string | null;
  canManageProfile: boolean;
};

export type HubGroup = {
  id: number;
  pharmacyId: number;
  pharmacyName: string;
  organizationId: number | null;
  name: string;
  description: string | null;
  memberCount: number;
  isAdmin: boolean;
  isMember: boolean;
  isCreator: boolean;
  members?: HubGroupMember[];
};

export type HubContext = {
  pharmacies: HubPharmacy[];
  organizations: HubOrganization[];
  communityGroups: HubGroup[];
  organizationGroups: HubGroup[];
  defaultPharmacyId: number | null;
  defaultOrganizationId: number | null;
};

export type HubScopeType = "pharmacy" | "group" | "organization";

export type HubScopeSelection = {
  type: HubScopeType;
  id: number;
};

export type HubGroupPayload = {
  pharmacyId: number;
  name: string;
  organizationId?: number | null; // Added for organization-scoped groups
  description?: string | null;
  memberIds?: number[];
};

export type HubProfilePayload = {
  about?: string | null;
  coverImage?: File | null;
};

export type HubTaggedMember = {
  membershipId: number;
  fullName: string;
  email: string | null;
  role: string | null;
  jobTitle: string | null;
};

export type HubGroupMember = {
  membershipId: number;
  userId: number | null;
  fullName: string;
  email: string | null;
  role: string | null;
  employmentType: string | null;
  pharmacyId: number | null;
  pharmacyName: string | null;
  jobTitle: string | null;
  isAdmin: boolean;
  joinedAt: string;
};

export type HubGroupMemberOption = {
  membershipId: number;
  userId: number | null;
  fullName: string;
  email: string | null;
  role: string;
  employmentType: string | null;
  pharmacyId: number | null;
  pharmacyName: string | null;
  jobTitle: string | null;
};
