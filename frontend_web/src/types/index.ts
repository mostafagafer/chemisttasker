export interface OrgMembership {
    organization_id: number;
    organization_name: string;
    role: string;
    region: string;
  }
  
  export interface AuthUser {
    id: number;
    username: string;
    email: string;
    role: string;
    memberships?: OrgMembership[];
  }
  