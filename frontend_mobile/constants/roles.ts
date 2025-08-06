// /constants/roles.ts

export const ORG_ROLES = ['ORG_ADMIN', 'REGION_ADMIN', 'SHIFT_MANAGER'] as const;
export type OrgRole = typeof ORG_ROLES[number];
