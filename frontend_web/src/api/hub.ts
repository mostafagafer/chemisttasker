import apiClient from "../utils/apiClient";
import { API_ENDPOINTS } from "../constants/api";
import {
  HubAttachment,
  HubComment,
  HubCommentPayload,
  HubContext,
  HubGroup,
  HubGroupMember,
  HubGroupMemberOption,
  HubGroupPayload,
  HubMembership,
  HubOrganization,
  HubPharmacy,
  HubPost,
  HubPostPayload,
  HubPoll,
  HubPollPayload,
  HubProfilePayload,
  HubReactionType,
  HubScopeSelection,
  HubUserSummary,
  HubTaggedMember,
} from "../types/hub";

type UserSummaryApi = {
  id: number;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
};

type MembershipApi = {
  id: number;
  role: string;
  employment_type: string;
  job_title?: string | null;
  user_details: {
    id: number;
    first_name: string | null;
    last_name: string | null;
    email: string;
  };
};

type AttachmentApi = {
  id: number;
  kind: "IMAGE" | "GIF" | "FILE";
  url: string | null;
  filename: string | null;
  uploaded_at: string;
};

type CommentApi = {
  id: number;
  post: number;
  body: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  can_edit: boolean;
  parent_comment: number | null;
  author: MembershipApi;
  is_edited: boolean;
  original_body: string;
  edited_at: string | null;
  edited_by: UserSummaryApi | null;
  is_deleted: boolean;
};

type PostApi = {
  id: number;
  pharmacy: number | null;
  pharmacy_name: string | null;
  community_group: number | null;
  community_group_name: string | null;
  organization: number | null;
  organization_name: string | null;
  scope_type: "pharmacy" | "group" | "organization";
  scope_target_id: number | null;
  body: string;
  visibility: "NORMAL" | "ANNOUNCEMENT";
  allow_comments: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  comment_count: number;
  reaction_summary: Record<string, number>;
  viewer_reaction: HubReactionType | null;
  can_manage: boolean;
  author: MembershipApi;
  recent_comments: CommentApi[];
  attachments: AttachmentApi[];
  is_edited: boolean;
  is_pinned: boolean;
  pinned_at: string | null;
  pinned_by: UserSummaryApi | null;
  original_body: string;
  edited_at: string | null;
  edited_by: UserSummaryApi | null;
  viewer_is_admin: boolean;
  is_deleted: boolean;
  tagged_members: TaggedMemberApi[];
};

type TaggedMemberApi = {
  membership_id: number;
  full_name: string;
  email: string | null;
  role: string | null;
  job_title?: string | null;
};

type PollOptionApi = {
  id: number;
  label: string;
  vote_count: number;
  percentage: number;
  position: number;
};

type PollApi = {
  id: number;
  question: string;
  pharmacy: number | null;
  organization: number | null;
  community_group: number | null;
  scope_type: "pharmacy" | "group" | "organization" | null;
  scope_target_id: number | null;
  created_at: string;
  updated_at: string;
  closes_at: string | null;
  is_closed: boolean;
  options: PollOptionApi[];
  total_votes: number;
  has_voted: boolean;
  selected_option_id: number | null;
  can_vote: boolean;
};

type GroupMemberApi = {
  membership_id: number;
  member: MembershipApi;
  is_admin: boolean;
  joined_at: string;
  pharmacy_id?: number | null;
  pharmacy_name?: string | null;
  job_title?: string | null;
};

type GroupApi = {
  id: number;
  pharmacy: number;
  pharmacy_name: string;
  organization_id: number | null;
  name: string;
  description: string | null;
  member_count: number;
  is_admin: boolean;
  is_member: boolean;
  is_creator?: boolean;
  members?: GroupMemberApi[];
};

type PharmacyContextApi = {
  id: number;
  name: string;
  about: string | null;
  cover_image: string | null;
  cover_image_url: string | null;
  organization_id: number | null;
  organization_name: string | null;
  can_manage_profile: boolean;
  can_create_group: boolean;
  can_create_post: boolean;
};

type OrganizationContextApi = {
  id: number;
  name: string;
  about: string | null;
  cover_image: string | null;
  cover_image_url: string | null;
  can_manage_profile: boolean;
};

type HubContextApi = {
  pharmacies: PharmacyContextApi[];
  organizations: OrganizationContextApi[];
  community_groups: GroupApi[];
  organization_groups: GroupApi[];
  default_pharmacy_id: number | null;
  default_organization_id: number | null;
};

const mapUser = (api: UserSummaryApi | null): HubUserSummary | null => {
  if (!api) return null;
  return {
    id: api.id,
    firstName: api.first_name,
    lastName: api.last_name,
    email: api.email,
  };
};

const mapMembership = (api: MembershipApi | null | undefined): HubMembership => ({
  id: api?.id ?? 0,
  role: api?.role ?? "MEMBER",
  employmentType: api?.employment_type ?? "",
  jobTitle: api?.job_title ?? null,
  user: {
    id: api?.user_details?.id ?? 0,
    firstName: api?.user_details?.first_name ?? null,
    lastName: api?.user_details?.last_name ?? null,
    email: api?.user_details?.email ?? "",
  },
});

const mapAttachment = (api: AttachmentApi): HubAttachment => ({
  id: api.id,
  kind: api.kind,
  url: api.url,
  filename: api.filename,
  uploadedAt: api.uploaded_at,
});

const mapComment = (api: CommentApi): HubComment => ({
  id: api.id,
  postId: api.post,
  body: api.body,
  createdAt: api.created_at,
  updatedAt: api.updated_at,
  deletedAt: api.deleted_at,
  canEdit: api.can_edit,
  author: mapMembership(api.author),
  parentCommentId: api.parent_comment,
  isEdited: api.is_edited,
  originalBody: api.original_body,
  editedAt: api.edited_at,
  editedBy: mapUser(api.edited_by),
  isDeleted: api.is_deleted,
});

const mapPost = (api: PostApi): HubPost => ({
  id: api.id,
  pharmacyId: api.pharmacy,
  pharmacyName: api.pharmacy_name ?? null,
  communityGroupId: api.community_group,
  communityGroupName: api.community_group_name ?? null,
  organizationId: api.organization,
  organizationName: api.organization_name ?? null,
  scopeType: api.scope_type,
  scopeTargetId: api.scope_target_id ?? null,
  body: api.body,
  visibility: api.visibility,
  allowComments: api.allow_comments,
  createdAt: api.created_at,
  updatedAt: api.updated_at,
  deletedAt: api.deleted_at,
  commentCount: api.comment_count,
  reactionSummary: api.reaction_summary ?? {},
  viewerReaction: api.viewer_reaction ?? null,
  canManage: api.can_manage,
  author: mapMembership(api.author),
  recentComments: (api.recent_comments ?? []).map(mapComment),
  attachments: (api.attachments ?? []).map(mapAttachment),
  isEdited: api.is_edited,
  isPinned: api.is_pinned,
  pinnedAt: api.pinned_at,
  pinnedBy: mapUser(api.pinned_by),
  originalBody: api.original_body,
  editedAt: api.edited_at,
  editedBy: mapUser(api.edited_by),
  viewerIsAdmin: api.viewer_is_admin,
  isDeleted: api.is_deleted,
  taggedMembers: (api.tagged_members ?? []).map(mapTaggedMember),
});

const mapTaggedMember = (api: TaggedMemberApi): HubTaggedMember => ({
  membershipId: api.membership_id,
  fullName: api.full_name,
  email: api.email,
  role: api.role,
  jobTitle: api.job_title ?? null,
});

const mapPollOption = (api: PollOptionApi): HubPollOption => ({
  id: api.id,
  label: api.label,
  voteCount: api.vote_count,
  percentage: api.percentage,
  position: api.position,
});

const mapPoll = (api: PollApi): HubPoll => ({
  id: api.id,
  question: api.question,
  createdAt: api.created_at,
  updatedAt: api.updated_at,
  closesAt: api.closes_at,
  isClosed: api.is_closed,
  scopeType: (api.scope_type as HubScopeSelection["type"]) ?? "pharmacy",
  scopeTargetId: api.scope_target_id,
  options: (api.options ?? []).map(mapPollOption),
  totalVotes: api.total_votes,
  hasVoted: api.has_voted,
  selectedOptionId: api.selected_option_id,
  canVote: api.can_vote,
});

const mapPharmacy = (api: PharmacyContextApi): HubPharmacy => ({
  id: api.id,
  name: api.name,
  about: api.about,
  coverImage: api.cover_image,
  coverImageUrl: api.cover_image_url,
  organizationId: api.organization_id,
  organizationName: api.organization_name,
  canManageProfile: api.can_manage_profile,
  canCreateGroup: api.can_create_group,
  canCreatePost: api.can_create_post,
});

const mapOrganization = (api: OrganizationContextApi): HubOrganization => ({
  id: api.id,
  name: api.name,
  about: api.about,
  coverImage: api.cover_image,
  coverImageUrl: api.cover_image_url,
  canManageProfile: api.can_manage_profile,
});

const mapGroupMember = (api: GroupMemberApi): HubGroupMember => {
  const userDetails = api.member?.user_details;
  const first = userDetails?.first_name ?? "";
  const last = userDetails?.last_name ?? "";
  const fullName = [first, last].join(" ").trim() || userDetails?.email || "Member";
  const jobTitle = api.member?.job_title ?? api.job_title ?? null;
  return {
    membershipId: api.membership_id,
    userId: userDetails?.id ?? null,
    fullName,
    email: userDetails?.email ?? null,
    role: api.member?.role ?? null,
    employmentType: api.member?.employment_type ?? null,
    pharmacyId: api.pharmacy_id ?? null,
    pharmacyName: api.pharmacy_name ?? null,
    jobTitle,
    isAdmin: api.is_admin,
    joinedAt: api.joined_at,
  };
};

const mapGroup = (api: GroupApi): HubGroup => ({
  id: api.id,
  pharmacyId: api.pharmacy,
  pharmacyName: api.pharmacy_name,
  organizationId: api.organization_id,
  name: api.name,
  description: api.description,
  memberCount: api.member_count,
  isAdmin: api.is_admin,
  isMember: api.is_member,
  isCreator: api.is_creator ?? false,
  members: api.members ? api.members.map(mapGroupMember) : undefined,
});

const mapContext = (api: HubContextApi): HubContext => ({
  pharmacies: (api.pharmacies ?? []).map(mapPharmacy),
  organizations: (api.organizations ?? []).map(mapOrganization),
  communityGroups: (api.community_groups ?? []).map(mapGroup),
  organizationGroups: (api.organization_groups ?? []).map(mapGroup),
  defaultPharmacyId: api.default_pharmacy_id,
  defaultOrganizationId: api.default_organization_id,
});

const asList = <T>(data: unknown): T[] => {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === "object" && Array.isArray((data as any).results)) {
    return (data as any).results;
  }
  return [];
};

const buildScopeParams = (scope: HubScopeSelection) => {
  const params: Record<string, unknown> = { scope: scope.type };
  if (scope.type === "pharmacy") {
    params.pharmacy_id = scope.id;
  } else if (scope.type === "organization") {
    params.organization_id = scope.id;
  } else if (scope.type === "group") {
    params.group_id = scope.id;
  }
  return params;
};

const buildPostFormData = (
  payload: Partial<HubPostPayload>,
  scope?: HubScopeSelection,
) => {
  const hasFiles = payload.attachments && payload.attachments.length > 0;
  if (!hasFiles) {
    const plain: Record<string, unknown> = {};
    if (payload.body !== undefined) plain.body = payload.body;
    if (payload.visibility) plain.visibility = payload.visibility;
    if (payload.allowComments !== undefined) {
      plain.allow_comments = payload.allowComments;
    }
    if (payload.removeAttachmentIds?.length) {
      plain.remove_attachment_ids = payload.removeAttachmentIds;
    }
    if (payload.taggedMemberIds) {
      plain.tagged_member_ids = payload.taggedMemberIds;
    }
    if (scope) {
      Object.assign(plain, buildScopeParams(scope));
    }
    return { data: plain, isMultipart: false };
  }
  const formData = new FormData();
  if (payload.body !== undefined) formData.append("body", payload.body);
  if (payload.visibility) formData.append("visibility", payload.visibility);
  if (payload.allowComments !== undefined) {
    formData.append("allow_comments", String(payload.allowComments));
  }
  payload.attachments?.forEach((file) => {
    formData.append("attachments", file);
  });
  payload.removeAttachmentIds?.forEach((id) => {
    formData.append("remove_attachment_ids", String(id));
  });
  payload.taggedMemberIds?.forEach((id) => {
    formData.append("tagged_member_ids", String(id));
  });
  if (scope) {
    const scopeParams = buildScopeParams(scope);
    Object.entries(scopeParams).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        formData.append(key, String(value));
      }
    });
  }
  return { data: formData, isMultipart: true };
};

export async function fetchHubContext(): Promise<HubContext> {
  const { data } = await apiClient.get<HubContextApi>(API_ENDPOINTS.hubContext);
  return mapContext(data);
}

export async function fetchHubPosts(
  scope: HubScopeSelection,
  cursor?: string | null,
): Promise<{ posts: HubPost[]; next: string | null }> {
  let response;
  if (cursor) {
    response = await apiClient.get(cursor);
  } else {
    const params = buildScopeParams(scope);
    response = await apiClient.get(API_ENDPOINTS.hubPosts, { params });
  }
  const data = response.data;
  const posts = asList<PostApi>(data).map(mapPost);
  const next =
    data && typeof data === "object" ? ((data as any).next as string | null) ?? null : null;
  return { posts, next };
}

export async function fetchHubPost(postId: number): Promise<HubPost> {
  const { data } = await apiClient.get<PostApi>(
    API_ENDPOINTS.hubPostDetail(postId),
  );
  return mapPost(data);
}

export async function fetchHubPolls(scope: HubScopeSelection): Promise<HubPoll[]> {
  const params = buildScopeParams(scope);
  const { data } = await apiClient.get(API_ENDPOINTS.hubPolls, { params });
  return asList<PollApi>(data).map(mapPoll);
}

export async function createHubPoll(
  scope: HubScopeSelection,
  payload: HubPollPayload,
): Promise<HubPoll> {
  const body: Record<string, unknown> = {
    question: payload.question,
    option_labels: payload.options,
    ...buildScopeParams(scope),
  };
  const { data } = await apiClient.post<PollApi>(API_ENDPOINTS.hubPolls, body);
  return mapPoll(data);
}

export async function voteHubPoll(
  pollId: number,
  optionId: number,
): Promise<HubPoll> {
  const { data } = await apiClient.post<PollApi>(
    API_ENDPOINTS.hubPollVote(pollId),
    { option_id: optionId },
  );
  return mapPoll(data);
}

export async function createHubPost(
  scope: HubScopeSelection,
  payload: HubPostPayload,
): Promise<HubPost> {
  const { data, isMultipart } = buildPostFormData(payload, scope);
  const response = await apiClient.post<PostApi>(
    API_ENDPOINTS.hubPosts,
    data,
    isMultipart
      ? { headers: { "Content-Type": "multipart/form-data" } }
      : undefined,
  );
  return mapPost(response.data);
}

export async function updateHubPost(
  postId: number,
  payload: Partial<HubPostPayload>,
): Promise<HubPost> {
  const { data, isMultipart } = buildPostFormData(payload);
  const response = await apiClient.patch<PostApi>(
    API_ENDPOINTS.hubPostDetail(postId),
    data,
    isMultipart
      ? { headers: { "Content-Type": "multipart/form-data" } }
      : undefined,
  );
  return mapPost(response.data);
}

export async function deleteHubPost(postId: number): Promise<void> {
  await apiClient.delete(API_ENDPOINTS.hubPostDetail(postId));
}

export async function pinHubPost(postId: number): Promise<HubPost> {
  const { data } = await apiClient.post<PostApi>(
    API_ENDPOINTS.hubPostPin(postId),
  );
  return mapPost(data);
}

export async function unpinHubPost(postId: number): Promise<HubPost> {
  const { data } = await apiClient.post<PostApi>(
    API_ENDPOINTS.hubPostUnpin(postId),
  );
  return mapPost(data);
}

export async function fetchHubComments(postId: number): Promise<HubComment[]> {
  const { data } = await apiClient.get(
    API_ENDPOINTS.hubPostComments(postId),
  );
  return asList<CommentApi>(data).map(mapComment);
}

export async function createHubComment(
  postId: number,
  payload: HubCommentPayload,
): Promise<HubComment> {
  const { data } = await apiClient.post<CommentApi>(
    API_ENDPOINTS.hubPostComments(postId),
    {
      body: payload.body,
      parent_comment: payload.parentComment ?? null,
    },
  );
  return mapComment(data);
}

export async function updateHubComment(
  postId: number,
  commentId: number,
  payload: Partial<HubCommentPayload>,
): Promise<HubComment> {
  const body: Record<string, unknown> = {};
  if (payload.body !== undefined) {
    body.body = payload.body;
  }
  if (payload.parentComment !== undefined) {
    body.parent_comment = payload.parentComment;
  }
  const { data } = await apiClient.patch<CommentApi>(
    `${API_ENDPOINTS.hubPostComments(postId)}${commentId}/`,
    body,
  );
  return mapComment(data);
}

export async function deleteHubComment(
  postId: number,
  commentId: number,
): Promise<void> {
  await apiClient.delete(
    `${API_ENDPOINTS.hubPostComments(postId)}${commentId}/`,
  );
}

export async function reactToHubPost(
  postId: number,
  reaction: HubReactionType,
): Promise<HubPost> {
  const { data } = await apiClient.post<PostApi>(
    API_ENDPOINTS.hubPostReactions(postId),
    { reaction_type: reaction },
  );
  return mapPost(data);
}

export async function removeHubReaction(postId: number): Promise<void> {
  await apiClient.delete(API_ENDPOINTS.hubPostReactions(postId));
}

export async function createHubGroup(
  payload: HubGroupPayload,
): Promise<HubGroup> {
  const body: Record<string, unknown> = {
    pharmacy_id: payload.pharmacyId,
    name: payload.name,
  };
  if (payload.organizationId !== undefined) {
    body.organization_id = payload.organizationId;
  }
  if (payload.description !== undefined) {
    body.description = payload.description;
  }
  if (payload.memberIds?.length) {
    body.member_ids = payload.memberIds;
  }
  const { data } = await apiClient.post<GroupApi>(
    API_ENDPOINTS.hubGroups,
    body,
  );
  return mapGroup(data);
}

export async function fetchHubGroup(
  groupId: number,
  options?: { includeMembers?: boolean },
): Promise<HubGroup> {
  const params = options?.includeMembers ? { include_members: "true" } : undefined;
  const { data } = await apiClient.get<GroupApi>(
    API_ENDPOINTS.hubGroupDetail(groupId),
    params ? { params } : undefined,
  );
  return mapGroup(data);
}

export async function updateHubGroup(
  groupId: number,
  payload: Partial<HubGroupPayload>,
  options?: { includeMembers?: boolean },
): Promise<HubGroup> {
  const body: Record<string, unknown> = {};
  if (payload.name !== undefined) body.name = payload.name;
  if (payload.description !== undefined) body.description = payload.description;
  if (payload.memberIds) body.member_ids = payload.memberIds;
  if (payload.pharmacyId !== undefined) {
    body.pharmacy_id = payload.pharmacyId;
  }
  const params = options?.includeMembers ? { include_members: "true" } : undefined;
  const { data } = await apiClient.patch<GroupApi>(
    API_ENDPOINTS.hubGroupDetail(groupId),
    body,
    params ? { params } : undefined,
  );
  return mapGroup(data);
}

export async function deleteHubGroup(groupId: number): Promise<void> {
  await apiClient.delete(API_ENDPOINTS.hubGroupDetail(groupId));
}

export async function updatePharmacyHubProfile(
  pharmacyId: number,
  payload: HubProfilePayload,
): Promise<HubPharmacy> {
  const formData = new FormData();
  if (payload.about !== undefined) {
    formData.append("about", payload.about ?? "");
  }
  if (payload.coverImage) {
    formData.append("cover_image", payload.coverImage);
  }
  const { data } = await apiClient.patch<PharmacyContextApi>(
    API_ENDPOINTS.hubPharmacyProfile(pharmacyId),
    formData,
    { headers: { "Content-Type": "multipart/form-data" } },
  );
  return mapPharmacy(data);
}

export async function updateOrganizationHubProfile(
  organizationId: number,
  payload: HubProfilePayload,
): Promise<HubOrganization> {
  const formData = new FormData();
  if (payload.about !== undefined) {
    formData.append("about", payload.about ?? "");
  }
  if (payload.coverImage) {
    formData.append("cover_image", payload.coverImage);
  }
  const { data } = await apiClient.patch<OrganizationContextApi>(
    API_ENDPOINTS.hubOrganizationProfile(organizationId),
    formData,
    { headers: { "Content-Type": "multipart/form-data" } },
  );
  return mapOrganization(data);
}

const formatMemberName = (record: any) => {
  const first = record?.user_details?.first_name ?? record?.user?.first_name;
  const last = record?.user_details?.last_name ?? record?.user?.last_name;
  const combined = [first, last].filter(Boolean).join(" ").trim();
  if (combined) return combined;
  return (
    record?.invited_name ??
    record?.user?.name ??
    record?.user_details?.email ??
    record?.email ??
    "Member"
  );
};

const asRole = (value: string | null | undefined) =>
  (value ?? "MEMBER").toUpperCase();

const asUserId = (record: any): number | null => {
  const candidates = [
    record?.user,
    record?.user_id,
    record?.user_details?.id,
    record?.membership?.user,
    record?.membership?.user_id,
  ];
  for (const candidate of candidates) {
    if (candidate === null || candidate === undefined) {
      continue;
    }
    const parsed = Number(candidate);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  return null;
};

type MemberOptionSource = {
  membershipId: number;
  userId?: number | null;
  fullName: string;
  email: string | null;
  role: string | null;
  employmentType: string | null;
  pharmacyId: number | null;
  pharmacyName: string | null;
  jobTitle?: string | null;
};

const mapOptionFromSource = (source: MemberOptionSource): HubGroupMemberOption => ({
  membershipId: source.membershipId,
  userId: source.userId ?? null,
  fullName: source.fullName,
  email: source.email,
  role: asRole(source.role),
  employmentType: source.employmentType ?? null,
  pharmacyId: source.pharmacyId,
  pharmacyName: source.pharmacyName,
  jobTitle: source.jobTitle ?? null,
});

export async function fetchPharmacyGroupMembers(
  pharmacyId: number,
): Promise<HubGroupMemberOption[]> {
  const { data } = await apiClient.get(
    API_ENDPOINTS.membershipList,
    { params: { pharmacy_id: pharmacyId, page_size: 500 } },
  );
  return asList<any>(data)
    .map((member) =>
      mapOptionFromSource({
        membershipId: Number(member.id),
        userId: asUserId(member),
        fullName: formatMemberName(member),
        email:
          member?.user_details?.email ??
          member?.email ??
          member?.contact_email ??
          null,
        role: member?.role ?? null,
        employmentType: member?.employment_type ?? null,
        pharmacyId: member?.pharmacy ?? pharmacyId ?? null,
        pharmacyName:
          member?.pharmacy_detail?.name ??
          member?.pharmacy_name ??
          null,
        jobTitle: member?.job_title ?? null,
      }),
    )
    .sort((a, b) => a.fullName.localeCompare(b.fullName));
}

export async function fetchOrganizationGroupMembers(
  organizationId: number,
): Promise<HubGroupMemberOption[]> {
  const { data } = await apiClient.get(
    API_ENDPOINTS.organizationMemberships,
    { params: { organization_id: organizationId, page_size: 500 } },
  );
  return asList<any>(data)
    .map((member) =>
      mapOptionFromSource({
        membershipId: Number(member.id),
        userId: asUserId(member),
        fullName: formatMemberName(member),
        email:
          member?.user?.email ??
          member?.user_details?.email ??
          member?.email ??
          null,
        role: member?.role ?? null,
        employmentType: member?.employment_type ?? null,
        pharmacyId: member?.pharmacy ?? null,
        pharmacyName:
          member?.pharmacy_detail?.name ??
          member?.pharmacy_name ??
          null,
        jobTitle: member?.job_title ?? null,
      }),
    )
    .sort((a, b) => a.fullName.localeCompare(b.fullName));
}

export async function fetchHubGroupMembers(groupId: number): Promise<HubGroupMemberOption[]> {
  const group = await fetchHubGroup(groupId, { includeMembers: true });
  return (group.members ?? [])
    .map((member) =>
      mapOptionFromSource({
        membershipId: member.membershipId,
        userId: member.userId,
        fullName: member.fullName,
        email: member.email,
        role: member.role,
        employmentType: member.employmentType,
        pharmacyId: member.pharmacyId ?? group.pharmacyId ?? null,
        pharmacyName: member.pharmacyName ?? group.pharmacyName ?? null,
        jobTitle: member.jobTitle ?? null,
      }),
    )
    .sort((a, b) => a.fullName.localeCompare(b.fullName));
}
