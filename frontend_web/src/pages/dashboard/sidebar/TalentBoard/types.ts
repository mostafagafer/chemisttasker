export type EngagementType = 'FULL_TIME' | 'PART_TIME' | 'CASUAL' | 'VOLUNTEERING' | 'PLACEMENT';

export type TalentFilterConfig = {
  search: string;
  roles: string[];
  states: string[];
  engagementTypes: EngagementType[];
};
