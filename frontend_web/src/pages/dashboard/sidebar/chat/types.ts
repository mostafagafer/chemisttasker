export type UserLite = {
  id: number;
  first_name?: string;
  last_name?: string;
  email?: string;
  avatar?: string | null;
};

export type LastMessageAPI = {
  id: number;
  body: string;
  created_at: string;
  sender: number; // membership_id
};

export type PharmacyRef = {
  id: number;
  name: string;
};

export type ChatRoom = {
  id: number;
  type: 'GROUP' | 'DM';
  title: string;
  pharmacy: number;
  unread_count?: number;
  updated_at?: string;
  last_message?: LastMessageAPI | null;
  my_last_read_at?: string | null;
  participant_ids: number[];
  my_membership_id?: number | null;
};


export type Reaction = {
  reaction: string;
  user_id: number;
};

export type ChatMessage = {
  id: number;
  conversation: number;
  sender: {
    id: number;                 // membership_id
    user_details: UserLite;
  };
  body: string;
  attachment_url: string | null;
  created_at: string;
  is_deleted?: boolean;
  is_edited?: boolean;
  original_body?: string | null;
  // ✨ FIX: Add the reactions property
  reactions?: Reaction[];
  attachment_filename?: string | null;
};

export type MemberCache = Record<number, Record<number, UserLite>>;