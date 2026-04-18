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

export const formatHubDate = (value: string) => {
  if (!value) {
    return '';
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  const datePart = HUB_DATE_FORMATTER.format(parsed);
  const timePart = HUB_TIME_FORMATTER.format(parsed).replace('AM', 'am').replace('PM', 'pm');
  return `${datePart} ${timePart}`;
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

export const getHubAuthorName = (
  user?: {
    username?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
  } | null,
  fallback = 'Member',
) => {
  if (!user) {
    return fallback;
  }
  const username = user.username?.trim();
  if (username) {
    return username;
  }
  const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
  if (fullName) {
    return fullName;
  }
  const email = user.email?.trim();
  if (email) {
    return email;
  }
  return fallback;
};

export const formatHubAuthorLabel = (
  user?: {
    username?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
  } | null,
  role?: string | null,
  fallback = 'Member',
) => {
  const name = getHubAuthorName(user, fallback);
  return role?.trim() ? `${name} | ${role.trim()}` : name;
};
