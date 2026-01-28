type NotificationPayload = Record<string, any>;

type ResolveRouteInput = {
  actionUrl?: string | null;
  payload?: NotificationPayload | null;
  userRole?: string | null;
};

const ROLE_ROUTE_MAP: Record<string, string> = {
  owner: '/owner/shifts',
  pharmacist: '/pharmacist/shifts',
  otherstaff: '/otherstaff/shifts',
  explorer: '/explorer/shifts',
  organization: '/organization/shifts',
};

const ROLE_CALENDAR_ROUTE_MAP: Record<string, string> = {
  owner: '/owner/calendar',
  pharmacist: '/pharmacist/calendar',
  otherstaff: '/otherstaff/calendar',
  explorer: '/explorer/calendar',
  organization: '/organization/calendar',
};

const normalizeRoleSlug = (rawRole?: string | null): string | null => {
  if (!rawRole) return null;
  const upper = String(rawRole).toUpperCase();
  if (upper === 'OWNER') return 'owner';
  if (upper === 'PHARMACIST') return 'pharmacist';
  if (upper === 'OTHER_STAFF') return 'otherstaff';
  if (upper === 'EXPLORER') return 'explorer';
  if (upper.startsWith('ORG_')) return 'organization';
  if (upper === 'ORG_ADMIN') return 'organization';
  return rawRole.toLowerCase();
};

const parseShiftFromActionUrl = (actionUrl?: string | null) => {
  if (!actionUrl) return null;
  let path = actionUrl;
  try {
    if (actionUrl.startsWith('http')) {
      path = new URL(actionUrl).pathname || actionUrl;
    }
  } catch {
    // ignore malformed URLs and treat as raw path
  }

  const match = path.match(/\/dashboard\/([^/]+)\/shifts\/(?:active\/)?(\d+)/);
  if (!match) return null;
  const roleSlug = match[1];
  const shiftId = Number(match[2]);
  if (!Number.isFinite(shiftId)) return null;
  return { roleSlug, shiftId };
};

const parseShiftIdFromPayload = (payload?: NotificationPayload | null) => {
  if (!payload) return null;
  const raw =
    payload.shift_id ??
    payload.shiftId ??
    payload.shift ??
    payload.shiftID ??
    null;
  const parsed = typeof raw === 'string' ? Number(raw) : raw;
  if (!Number.isFinite(parsed)) return null;
  return Number(parsed);
};

const parseConversationIdFromPayload = (payload?: NotificationPayload | null) => {
  if (!payload) return null;
  const raw =
    payload.conversation_id ??
    payload.conversationId ??
    payload.roomId ??
    payload.room_id ??
    payload.chat_room_id ??
    null;
  const parsed = typeof raw === 'string' ? Number(raw) : raw;
  if (!Number.isFinite(parsed)) return null;
  return Number(parsed);
};

const parseConversationIdFromActionUrl = (actionUrl?: string | null) => {
  if (!actionUrl) return null;
  try {
    const url = new URL(actionUrl, 'http://localhost');
    const raw = url.searchParams.get('conversationId') || url.searchParams.get('conversation_id');
    const parsed = raw ? Number(raw) : null;
    if (!Number.isFinite(parsed)) return null;
    return Number(parsed);
  } catch {
    return null;
  }
};

const parseCalendarFromActionUrl = (actionUrl?: string | null) => {
  if (!actionUrl) return null;
  try {
    const url = new URL(actionUrl, 'http://localhost');
    if (!url.pathname.includes('/dashboard/calendar')) return null;
    return {
      pharmacyId: url.searchParams.get('pharmacy_id') || url.searchParams.get('pharmacyId') || null,
      date: url.searchParams.get('date') || null,
      noteId: url.searchParams.get('note_id') || url.searchParams.get('noteId') || null,
    };
  } catch {
    return null;
  }
};

const parseCalendarFromPayload = (payload?: NotificationPayload | null) => {
  if (!payload) return null;
  const noteRaw = payload.note_id ?? payload.noteId ?? payload.work_note_id ?? payload.workNoteId ?? null;
  const pharmacyRaw = payload.pharmacy_id ?? payload.pharmacyId ?? null;
  const dateRaw = payload.date ?? null;
  return {
    pharmacyId: pharmacyRaw ? String(pharmacyRaw) : null,
    date: dateRaw ? String(dateRaw) : null,
    noteId: noteRaw ? String(noteRaw) : null,
  };
};

export const resolveChatNotificationRoomId = ({
  actionUrl,
  payload,
}: ResolveRouteInput): number | null => {
  return parseConversationIdFromPayload(payload) ?? parseConversationIdFromActionUrl(actionUrl);
};

export const resolveShiftNotificationRoute = ({
  actionUrl,
  payload,
  userRole,
}: ResolveRouteInput): string | null => {
  const actionMatch = parseShiftFromActionUrl(actionUrl);
  const shiftId = actionMatch?.shiftId ?? parseShiftIdFromPayload(payload);
  if (!shiftId) return null;

  const roleSlug =
    actionMatch?.roleSlug ??
    normalizeRoleSlug(userRole) ??
    null;

  const baseRoute = roleSlug ? ROLE_ROUTE_MAP[roleSlug] : null;
  if (!baseRoute) return null;
  return `${baseRoute}/${shiftId}`;
};

export const resolveCalendarNotificationRoute = ({
  actionUrl,
  payload,
  userRole,
}: ResolveRouteInput): string | null => {
  const actionParams = parseCalendarFromActionUrl(actionUrl);
  const payloadParams = parseCalendarFromPayload(payload);
  const merged = {
    pharmacyId: actionParams?.pharmacyId ?? payloadParams?.pharmacyId ?? null,
    date: actionParams?.date ?? payloadParams?.date ?? null,
    noteId: actionParams?.noteId ?? payloadParams?.noteId ?? null,
  };

  if (!merged.pharmacyId && !merged.date && !merged.noteId) return null;

  const roleSlug = normalizeRoleSlug(userRole);
  const baseRoute = roleSlug ? ROLE_CALENDAR_ROUTE_MAP[roleSlug] : null;
  if (!baseRoute) return null;

  const params = new URLSearchParams();
  if (merged.pharmacyId) params.set('pharmacy_id', String(merged.pharmacyId));
  if (merged.date) params.set('date', String(merged.date));
  if (merged.noteId) params.set('note_id', String(merged.noteId));

  const query = params.toString();
  return query ? `${baseRoute}?${query}` : baseRoute;
};
