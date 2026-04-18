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
