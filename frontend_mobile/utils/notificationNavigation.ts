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
