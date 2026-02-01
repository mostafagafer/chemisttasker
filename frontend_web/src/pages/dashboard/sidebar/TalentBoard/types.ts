export type EngagementType = 'FULL_TIME' | 'PART_TIME' | 'CASUAL' | 'VOLUNTEERING' | 'PLACEMENT';

export type TalentFilterConfig = {
  search: string;
  roles: string[];
  states: string[];
  engagementTypes: EngagementType[];
};

export type CandidateAttachment = { id: number; kind: string; file: string; caption?: string | null };

export type Candidate = {
  id: number;
  refId: string;
  role: string;
  headline: string;
  body: string;
  city: string;
  state: string;
  coverageRadius: string;
  workTypes: string[];
  willingToTravel: boolean;
  pitch: string;
  skills: string[];
  software: string[];
  experience: number | null;
  availabilityText: string;
  availabilityMode: string | null;
  showCalendar: boolean;
  availableDates: string[];
  isInternshipSeeker: boolean;
  ratingAverage: number;
  ratingCount: number;
  likeCount: number;
  isLikedByMe: boolean;
  attachments: CandidateAttachment[];
  authorUserId: number | null;
  explorerUserId: number | null;
  openToTravel?: boolean | null;
  coverageRadiusKm?: number | null;
  availabilityDays?: Array<string | number> | null;
  availabilityNotice?: string | null;
  availabilitySummary?: string | null;
};
