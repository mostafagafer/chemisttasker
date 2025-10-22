import apiClient from "../utils/apiClient";
import { API_BASE_URL, API_ENDPOINTS } from "../constants/api";
import {
  HubComment,
  HubCommentPayload,
  HubMembership,
  HubPost,
  HubPostPayload,
  HubReactionType,
  CommunityGroup,
  CommunityGroupMember,
  CommunityGroupPayload,
} from "../types/pharmacyHub";

const REACTION_TYPES: HubReactionType[] = [
  "LIKE",
  "CELEBRATE",
  "SUPPORT",
  "INSIGHTFUL",
  "LOVE",
];

type HubScopeOptions = {
  communityGroupId?: number;
};

type UserSummaryApi = {
  id: number;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
};

type AttachmentApi = {
  id: number;
  kind: "IMAGE" | "GIF" | "FILE";
  url: string | null;
  filename: string | null;
  uploaded_at: string;
};

type PostApi = {
  id: number;
  pharmacy: number | null;
  pharmacy_name?: string | null;
  community_group?: number | null;
  community_group_name?: string | null;
  organization: number | null;
  organization_name?: string | null;
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

type MembershipApi = {
  id: number;
  role: string;
  employment_type: string;
  user_details: {
    id: number;
    first_name: string | null;
    last_name: string | null;
    email: string;
  };
};

type CommunityGroupMemberApi = {
  membership_id: number;
  member: MembershipApi;
  is_admin: boolean;
  joined_at: string;
};

type CommunityGroupApi = {
  id: number;
  pharmacy: number;
  name: string;
  description: string | null;
  members: CommunityGroupMemberApi[];
  member_count: number;
  is_admin: boolean;
  created_at: string;
  updated_at: string;
  created_by_user?: UserSummaryApi | null;
};

function mapUserSummary(api: UserSummaryApi | null): HubPost["editedBy"] {
  if (!api) {
    return null;
  }
  return {
    id: api.id,
    firstName: api.first_name,
    lastName: api.last_name,
    email: api.email,
  };
}

function mapMembership(api: MembershipApi): HubMembership {
  return {
    id: api.id,
    role: api.role,
    employmentType: api.employment_type,
    user: {
      id: api.user_details.id,
      firstName: api.user_details.first_name,
      lastName: api.user_details.last_name,
      email: api.user_details.email,
    },
  };
}

function mapCommunityGroupMember(api: CommunityGroupMemberApi): CommunityGroupMember {
  return {
    membershipId: api.membership_id,
    member: mapMembership(api.member),
    isAdmin: api.is_admin,
    joinedAt: api.joined_at,
  };
}

function mapCommunityGroup(api: CommunityGroupApi): CommunityGroup {
  return {
    id: api.id,
    pharmacyId: api.pharmacy,
    name: api.name,
    description: api.description ?? null,
    members: Array.isArray(api.members)
      ? api.members.map(mapCommunityGroupMember)
      : [],
    memberCount: api.member_count ?? (Array.isArray(api.members) ? api.members.length : 0),
    isAdmin: Boolean(api.is_admin),
    createdAt: api.created_at,
    updatedAt: api.updated_at,
    createdBy: mapUserSummary(api.created_by_user ?? null),
  };
}

function ensureAbsoluteUrl(url: string | null): string | null {
  if (!url) {
    return null;
  }
  if (/^https?:\/\//i.test(url)) {
    return url;
  }
  if (url.startsWith("//")) {
    return `https:${url}`;
  }
  const base = (API_BASE_URL || "").replace(/\/$/, "");
  const normalisedPath = url.startsWith("/") ? url : `/${url}`;
  return base ? `${base}${normalisedPath}` : normalisedPath;
}

function mapAttachment(api: AttachmentApi): HubPost["attachments"][number] {
  return {
    id: api.id,
    kind: api.kind,
    url: ensureAbsoluteUrl(api.url),
    filename: api.filename,
    uploadedAt: api.uploaded_at,
  };
}

function mapComment(api: CommentApi): HubComment {
  return {
    id: api.id,
    postId: api.post,
    body: api.body,
    createdAt: api.created_at,
    updatedAt: api.updated_at,
    canEdit: api.can_edit,
    author: mapMembership(api.author),
    parentCommentId: api.parent_comment,
    isEdited: api.is_edited,
    originalBody: api.original_body,
    editedAt: api.edited_at,
    editedBy: mapUserSummary(api.edited_by),
    isDeleted: api.is_deleted,
  };
}

function mapReactionSummary(
  summary: Record<string, number> | null | undefined
): Record<HubReactionType, number> {
  const base = REACTION_TYPES.reduce<Record<HubReactionType, number>>(
    (acc, type) => {
      acc[type] = 0;
      return acc;
    },
    {} as Record<HubReactionType, number>
  );
  if (!summary) {
    return base;
  }
  for (const key of Object.keys(summary)) {
    if (REACTION_TYPES.includes(key as HubReactionType)) {
      base[key as HubReactionType] = summary[key] ?? 0;
    }
  }
  return base;
}

function mapPost(api: PostApi): HubPost {
  return {
    id: api.id,
    pharmacyId: api.pharmacy ?? null,
    pharmacyName: api.pharmacy_name ?? null,
    communityGroupId: api.community_group ?? null,
    communityGroupName: api.community_group_name ?? null,
    organizationId: api.organization ?? null,
    organizationName: api.organization_name ?? null,
    body: api.body,
    visibility: api.visibility,
    allowComments: api.allow_comments,
    createdAt: api.created_at,
    updatedAt: api.updated_at,
    commentCount: api.comment_count,
    reactionSummary: mapReactionSummary(api.reaction_summary),
    viewerReaction: api.viewer_reaction,
    canManage: api.can_manage,
    author: mapMembership(api.author),
    recentComments: Array.isArray(api.recent_comments)
      ? api.recent_comments.map(mapComment)
      : [],
    attachments: Array.isArray(api.attachments)
      ? api.attachments.map(mapAttachment)
      : [],
    isEdited: api.is_edited,
    isPinned: api.is_pinned,
    pinnedAt: api.pinned_at,
    pinnedBy: mapUserSummary(api.pinned_by),
    originalBody: api.original_body,
    editedAt: api.edited_at,
    editedBy: mapUserSummary(api.edited_by),
    viewerIsAdmin: api.viewer_is_admin,
    isDeleted: api.is_deleted,
  };
}

function buildPostRequestData(payload: Partial<HubPostPayload>): {
  data: FormData | Record<string, unknown>;
  isMultipart: boolean;
} {
  const hasFiles = Boolean(payload.attachments && payload.attachments.length);
  const removeIds =
    payload.removeAttachmentIds && payload.removeAttachmentIds.length
      ? payload.removeAttachmentIds
      : undefined;

  if (hasFiles) {
    const formData = new FormData();
    if (payload.body !== undefined) {
      formData.append("body", payload.body);
    }
    if (payload.visibility !== undefined) {
      formData.append("visibility", payload.visibility);
    }
    if (payload.allowComments !== undefined) {
      formData.append("allow_comments", String(payload.allowComments));
    }
    payload.attachments?.forEach((file) => {
      if (file) {
        formData.append("attachments", file);
      }
    });
    if (removeIds) {
      formData.append("remove_attachment_ids", JSON.stringify(removeIds));
    }
    return { data: formData, isMultipart: true };
  }

  const json: Record<string, unknown> = {};
  if (payload.body !== undefined) {
    json.body = payload.body;
  }
  if (payload.visibility !== undefined) {
    json.visibility = payload.visibility;
  }
  if (payload.allowComments !== undefined) {
    json.allow_comments = payload.allowComments;
  }
  if (removeIds) {
    json.remove_attachment_ids = removeIds;
  }
  return { data: json, isMultipart: false };
}

export async function fetchPharmacyHubPosts(
  pharmacyId: number,
  pageOrOptions: number | HubScopeOptions = 1,
  maybeOptions?: HubScopeOptions
): Promise<{ count: number; results: HubPost[] }> {
  const page = typeof pageOrOptions === "number" ? pageOrOptions : 1;
  const options =
    typeof pageOrOptions === "number" ? maybeOptions : pageOrOptions;
  const endpoint = options?.communityGroupId
    ? API_ENDPOINTS.communityGroupPosts(pharmacyId, options.communityGroupId)
    : API_ENDPOINTS.pharmacyHubPosts(pharmacyId);

  const { data } = await apiClient.get(endpoint, {
    params: { page },
  });
  if (Array.isArray(data)) {
    return {
      count: data.length,
      results: (data as PostApi[]).map(mapPost),
    };
  }
  return {
    count: data.count ?? 0,
    results: Array.isArray(data.results) ? data.results.map(mapPost) : [],
  };
}

export async function fetchPharmacyHubPost(
  pharmacyId: number,
  postId: number,
  options?: HubScopeOptions
): Promise<HubPost> {
  const endpoint = options?.communityGroupId
    ? API_ENDPOINTS.communityGroupPostDetail(pharmacyId, options.communityGroupId, postId)
    : API_ENDPOINTS.pharmacyHubPostDetail(pharmacyId, postId);
  const { data } = await apiClient.get(endpoint);
  return mapPost(data as PostApi);
}

export async function createPharmacyHubPost(
  pharmacyId: number,
  payload: HubPostPayload,
  options?: HubScopeOptions
): Promise<HubPost> {
  const { data: requestData, isMultipart } = buildPostRequestData(payload);
  const endpoint = options?.communityGroupId
    ? API_ENDPOINTS.communityGroupPosts(pharmacyId, options.communityGroupId)
    : API_ENDPOINTS.pharmacyHubPosts(pharmacyId);
  const { data } = await apiClient.post<PostApi>(
    endpoint,
    requestData,
    isMultipart ? { headers: { "Content-Type": "multipart/form-data" } } : undefined
  );
  return mapPost(data);
}

export async function updatePharmacyHubPost(
  pharmacyId: number,
  postId: number,
  payload: Partial<HubPostPayload>,
  options?: HubScopeOptions
): Promise<HubPost> {
  const { data: requestData, isMultipart } = buildPostRequestData(payload);
  const endpoint = options?.communityGroupId
    ? API_ENDPOINTS.communityGroupPostDetail(pharmacyId, options.communityGroupId, postId)
    : API_ENDPOINTS.pharmacyHubPostDetail(pharmacyId, postId);
  const { data } = await apiClient.patch<PostApi>(
    endpoint,
    requestData,
    isMultipart ? { headers: { "Content-Type": "multipart/form-data" } } : undefined
  );
  return mapPost(data);
}

export async function deletePharmacyHubPost(
  pharmacyId: number,
  postId: number,
  options?: HubScopeOptions
): Promise<void> {
  const endpoint = options?.communityGroupId
    ? API_ENDPOINTS.communityGroupPostDetail(pharmacyId, options.communityGroupId, postId)
    : API_ENDPOINTS.pharmacyHubPostDetail(pharmacyId, postId);
  await apiClient.delete(endpoint);
}

export async function pinPharmacyHubPost(
  pharmacyId: number,
  postId: number,
  options?: HubScopeOptions
): Promise<HubPost> {
  const endpoint = options?.communityGroupId
    ? API_ENDPOINTS.communityGroupPostPin(pharmacyId, options.communityGroupId, postId)
    : API_ENDPOINTS.pharmacyHubPostPin(pharmacyId, postId);
  const { data } = await apiClient.post<PostApi>(endpoint);
  return mapPost(data);
}

export async function unpinPharmacyHubPost(
  pharmacyId: number,
  postId: number,
  options?: HubScopeOptions
): Promise<HubPost> {
  const endpoint = options?.communityGroupId
    ? API_ENDPOINTS.communityGroupPostUnpin(pharmacyId, options.communityGroupId, postId)
    : API_ENDPOINTS.pharmacyHubPostUnpin(pharmacyId, postId);
  const { data } = await apiClient.post<PostApi>(endpoint);
  return mapPost(data);
}

export async function fetchPharmacyHubComments(
  pharmacyId: number,
  postId: number,
  pageOrOptions: number | HubScopeOptions = 1,
  maybeOptions?: HubScopeOptions
): Promise<HubComment[]> {
  const page = typeof pageOrOptions === "number" ? pageOrOptions : 1;
  const options =
    typeof pageOrOptions === "number" ? maybeOptions : pageOrOptions;
  const endpoint = options?.communityGroupId
    ? API_ENDPOINTS.communityGroupComments(
        pharmacyId,
        options.communityGroupId,
        postId
      )
    : API_ENDPOINTS.pharmacyHubComments(pharmacyId, postId);
  const { data } = await apiClient.get(endpoint, { params: { page } });
  if (Array.isArray(data)) {
    return (data as CommentApi[]).map(mapComment);
  }
  return Array.isArray(data.results)
    ? (data.results as CommentApi[]).map(mapComment)
    : [];
}

export async function createPharmacyHubComment(
  pharmacyId: number,
  postId: number,
  payload: HubCommentPayload,
  options?: HubScopeOptions
): Promise<HubComment> {
  const endpoint = options?.communityGroupId
    ? API_ENDPOINTS.communityGroupComments(
        pharmacyId,
        options.communityGroupId,
        postId
      )
    : API_ENDPOINTS.pharmacyHubComments(pharmacyId, postId);
  const { data } = await apiClient.post<CommentApi>(
    endpoint,
    {
      body: payload.body,
      parent_comment: payload.parentComment ?? null,
    }
  );
  return mapComment(data);
}

export async function updatePharmacyHubComment(
  pharmacyId: number,
  postId: number,
  commentId: number,
  payload: Partial<HubCommentPayload>,
  options?: HubScopeOptions
): Promise<HubComment> {
  const apiPayload: Record<string, unknown> = {};
  if (payload.body !== undefined) {
    apiPayload.body = payload.body;
  }
  if (payload.parentComment !== undefined) {
    apiPayload.parent_comment = payload.parentComment;
  }
  const baseEndpoint = options?.communityGroupId
    ? API_ENDPOINTS.communityGroupComments(
        pharmacyId,
        options.communityGroupId,
        postId
      )
    : API_ENDPOINTS.pharmacyHubComments(pharmacyId, postId);
  const { data } = await apiClient.patch<CommentApi>(
    `${baseEndpoint}${commentId}/`,
    apiPayload
  );
  return mapComment(data);
}

export async function deletePharmacyHubComment(
  pharmacyId: number,
  postId: number,
  commentId: number,
  options?: HubScopeOptions
): Promise<void> {
  const baseEndpoint = options?.communityGroupId
    ? API_ENDPOINTS.communityGroupComments(
        pharmacyId,
        options.communityGroupId,
        postId
      )
    : API_ENDPOINTS.pharmacyHubComments(pharmacyId, postId);
  await apiClient.delete(`${baseEndpoint}${commentId}/`);
}

export async function reactToPharmacyHubPost(
  pharmacyId: number,
  postId: number,
  reaction: HubReactionType,
  options?: HubScopeOptions
): Promise<HubReactionType> {
  const endpoint = options?.communityGroupId
    ? API_ENDPOINTS.communityGroupReaction(
        pharmacyId,
        options.communityGroupId,
        postId
      )
    : API_ENDPOINTS.pharmacyHubReaction(pharmacyId, postId);
  await apiClient.put(endpoint, {
    reaction_type: reaction,
  });
  return reaction;
}

export async function removePharmacyHubReaction(
  pharmacyId: number,
  postId: number,
  options?: HubScopeOptions
): Promise<void> {
  const endpoint = options?.communityGroupId
    ? API_ENDPOINTS.communityGroupReaction(
        pharmacyId,
        options.communityGroupId,
        postId
      )
    : API_ENDPOINTS.pharmacyHubReaction(pharmacyId, postId);
  await apiClient.delete(endpoint);
}

export async function fetchCommunityGroups(
  pharmacyId: number
): Promise<CommunityGroup[]> {
  const { data } = await apiClient.get(
    API_ENDPOINTS.communityGroups(pharmacyId)
  );
  const records = Array.isArray(data)
    ? (data as CommunityGroupApi[])
    : Array.isArray(data.results)
    ? (data.results as CommunityGroupApi[])
    : [];
  return records.map(mapCommunityGroup);
}

export async function createCommunityGroup(
  pharmacyId: number,
  payload: CommunityGroupPayload
): Promise<CommunityGroup> {
  const { data } = await apiClient.post<CommunityGroupApi>(
    API_ENDPOINTS.communityGroups(pharmacyId),
    {
      name: payload.name,
      description: payload.description ?? null,
      member_ids: payload.memberIds,
    }
  );
  return mapCommunityGroup(data);
}

export async function updateCommunityGroup(
  pharmacyId: number,
  groupId: number,
  payload: Partial<CommunityGroupPayload>
): Promise<CommunityGroup> {
  const apiPayload: Record<string, unknown> = {};
  if (payload.name !== undefined) {
    apiPayload.name = payload.name;
  }
  if (payload.description !== undefined) {
    apiPayload.description = payload.description;
  }
  if (payload.memberIds !== undefined) {
    apiPayload.member_ids = payload.memberIds;
  }
  const { data } = await apiClient.patch<CommunityGroupApi>(
    API_ENDPOINTS.communityGroupDetail(pharmacyId, groupId),
    apiPayload
  );
  return mapCommunityGroup(data);
}

export async function deleteCommunityGroup(
  pharmacyId: number,
  groupId: number
): Promise<void> {
  await apiClient.delete(
    API_ENDPOINTS.communityGroupDetail(pharmacyId, groupId)
  );
}

export async function reactToOrganizationHubPost(
  organizationId: number,
  postId: number,
  reaction: HubReactionType
): Promise<HubReactionType> {
  await apiClient.put(API_ENDPOINTS.organizationHubReaction(organizationId, postId), {
    reaction_type: reaction,
  });
  return reaction;
}

export async function removeOrganizationHubReaction(
  organizationId: number,
  postId: number
): Promise<void> {
  await apiClient.delete(API_ENDPOINTS.organizationHubReaction(organizationId, postId));
}

export async function fetchOrganizationHubPosts(
  organizationId: number,
  page: number = 1
): Promise<{ count: number; results: HubPost[] }> {
  const { data } = await apiClient.get(
    API_ENDPOINTS.organizationHubPosts(organizationId),
    { params: { page } }
  );
  if (Array.isArray(data)) {
    return {
      count: data.length,
      results: (data as PostApi[]).map(mapPost),
    };
  }
  return {
    count: data.count ?? 0,
    results: Array.isArray(data.results) ? data.results.map(mapPost) : [],
  };
}

export async function fetchOrganizationHubPost(
  organizationId: number,
  postId: number
): Promise<HubPost> {
  const { data } = await apiClient.get(
    API_ENDPOINTS.organizationHubPostDetail(organizationId, postId)
  );
  return mapPost(data as PostApi);
}

export async function createOrganizationHubPost(
  organizationId: number,
  payload: HubPostPayload
): Promise<HubPost> {
  const { data: requestData, isMultipart } = buildPostRequestData(payload);
  const { data } = await apiClient.post<PostApi>(
    API_ENDPOINTS.organizationHubPosts(organizationId),
    requestData,
    isMultipart ? { headers: { "Content-Type": "multipart/form-data" } } : undefined
  );
  return mapPost(data);
}

export async function updateOrganizationHubPost(
  organizationId: number,
  postId: number,
  payload: Partial<HubPostPayload>
): Promise<HubPost> {
  const { data: requestData, isMultipart } = buildPostRequestData(payload);
  const { data } = await apiClient.patch<PostApi>(
    API_ENDPOINTS.organizationHubPostDetail(organizationId, postId),
    requestData,
    isMultipart ? { headers: { "Content-Type": "multipart/form-data" } } : undefined
  );
  return mapPost(data);
}

export async function deleteOrganizationHubPost(
  organizationId: number,
  postId: number
): Promise<void> {
  await apiClient.delete(
    API_ENDPOINTS.organizationHubPostDetail(organizationId, postId)
  );
}

export async function pinOrganizationHubPost(
  organizationId: number,
  postId: number
): Promise<HubPost> {
  const { data } = await apiClient.post<PostApi>(
    API_ENDPOINTS.organizationHubPostPin(organizationId, postId)
  );
  return mapPost(data);
}

export async function unpinOrganizationHubPost(
  organizationId: number,
  postId: number
): Promise<HubPost> {
  const { data } = await apiClient.post<PostApi>(
    API_ENDPOINTS.organizationHubPostUnpin(organizationId, postId)
  );
  return mapPost(data);
}

export async function fetchOrganizationHubComments(
  organizationId: number,
  postId: number,
  page: number = 1
): Promise<HubComment[]> {
  const { data } = await apiClient.get(
    API_ENDPOINTS.organizationHubComments(organizationId, postId),
    { params: { page } }
  );
  if (Array.isArray(data)) {
    return (data as CommentApi[]).map(mapComment);
  }
  return Array.isArray(data.results)
    ? (data.results as CommentApi[]).map(mapComment)
    : [];
}

export async function createOrganizationHubComment(
  organizationId: number,
  postId: number,
  payload: HubCommentPayload
): Promise<HubComment> {
  const { data } = await apiClient.post<CommentApi>(
    API_ENDPOINTS.organizationHubComments(organizationId, postId),
    {
      body: payload.body,
      parent_comment: payload.parentComment ?? null,
    }
  );
  return mapComment(data);
}

export async function updateOrganizationHubComment(
  organizationId: number,
  postId: number,
  commentId: number,
  payload: Partial<HubCommentPayload>
): Promise<HubComment> {
  const apiPayload: Record<string, unknown> = {};
  if (payload.body !== undefined) {
    apiPayload.body = payload.body;
  }
  if (payload.parentComment !== undefined) {
    apiPayload.parent_comment = payload.parentComment;
  }
  const { data } = await apiClient.patch<CommentApi>(
    `${API_ENDPOINTS.organizationHubComments(organizationId, postId)}${commentId}/`,
    apiPayload
  );
  return mapComment(data);
}

export async function deleteOrganizationHubComment(
  organizationId: number,
  postId: number,
  commentId: number
): Promise<void> {
  await apiClient.delete(
    `${API_ENDPOINTS.organizationHubComments(organizationId, postId)}${commentId}/`
  );
}
