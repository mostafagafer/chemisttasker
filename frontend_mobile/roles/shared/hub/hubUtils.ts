export const reactionEmojis: Record<string, string> = {
  LIKE: '\uD83D\uDC4D',
  LOVE: '\u2764\uFE0F',
  CELEBRATE: '\uD83C\uDF89',
  SUPPORT: '\uD83D\uDE4C',
  INSIGHTFUL: '\uD83D\uDCA1',
};

const HUB_DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

const HUB_TIME_FORMATTER = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

export const formatHubDate = (value?: string | null) => {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  const datePart = HUB_DATE_FORMATTER.format(parsed);
  const timePart = HUB_TIME_FORMATTER.format(parsed).replace('AM', 'am').replace('PM', 'pm');
  return `${datePart} ${timePart}`;
};

export const getHubAuthorName = (user: any, fallback = 'Member') => {
  const username = (user?.username || '').trim();
  if (username) return username;
  const firstName = user?.firstName || user?.first_name || '';
  const lastName = user?.lastName || user?.last_name || '';
  const fullName = `${firstName} ${lastName}`.trim();
  if (fullName) return fullName;
  const email = (user?.email || '').trim();
  if (email) return email;
  return fallback;
};

export const formatMemberLabel = (
  name: string,
  role?: string | null,
  jobTitle?: string | null,
  fallback = 'Member',
) => {
  const displayName = name?.trim() || fallback;
  const parts = [displayName];
  if (role?.trim()) {
    parts.push(role.trim());
  }
  if (jobTitle?.trim()) {
    parts.push(jobTitle.trim());
  }
  return parts.join(' | ');
};
