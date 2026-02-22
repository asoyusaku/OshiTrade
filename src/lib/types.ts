export type IdolGroup = {
  id: number;
  name: string;
  name_romaji: string;
  sort_order: number;
  is_active: boolean;
};

export type Member = {
  id: number;
  group_id: number;
  name: string;
  name_romaji: string | null;
  generation: number | null;
  is_active: boolean;
  sort_order: number;
};

export type GoodsType = {
  id: number;
  name: string;
  name_en: string | null;
  sort_order: number;
};

export type Event = {
  id: number;
  group_id: number;
  name: string;
  venue: string | null;
  event_date: string;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
  created_at: string;
  idol_groups?: IdolGroup;
};

export type Profile = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  push_token: string | null;
  is_admin: boolean;
  created_at: string;
  updated_at: string;
};

export type SuggestionStatus = 'pending' | 'approved' | 'rejected';

export type EventSuggestion = {
  id: number;
  user_id: string;
  group_id: number;
  name: string;
  venue: string | null;
  event_date: string;
  note: string | null;
  status: SuggestionStatus;
  reviewed_by: string | null;
  created_at: string;
  updated_at: string;
  idol_groups?: IdolGroup;
  profiles?: Profile;
};

export type HaveItem = {
  id: number;
  user_id: string;
  event_id: number;
  member_id: number;
  goods_type_id: number;
  quantity: number;
  note: string | null;
  is_available: boolean;
  created_at: string;
  members?: Member;
  goods_types?: GoodsType;
};

export type WantItem = {
  id: number;
  user_id: string;
  event_id: number;
  member_id: number;
  goods_type_id: number;
  quantity: number;
  is_fulfilled: boolean;
  created_at: string;
  members?: Member;
  goods_types?: GoodsType;
};

export type MatchStatus = 'pending' | 'accepted' | 'completed' | 'cancelled';

export type Match = {
  id: number;
  event_id: number;
  user_a: string;
  user_b: string;
  status: MatchStatus;
  created_at: string;
  updated_at: string;
  profiles_a?: Profile;
  profiles_b?: Profile;
  match_items?: MatchItem[];
};

export type MatchItem = {
  id: number;
  match_id: number;
  giver_id: string;
  have_item_id: number;
  want_item_id: number;
  have_items?: HaveItem;
  want_items?: WantItem;
};

export type ChatRoom = {
  id: number;
  match_id: number;
  user_a: string;
  user_b: string;
  created_at: string;
  profiles_a?: Profile;
  profiles_b?: Profile;
  matches?: Match;
  last_message?: Message;
};

export type Message = {
  id: number;
  chat_room_id: number;
  sender_id: string;
  content: string;
  created_at: string;
  read_at: string | null;
};

export type BidirectionalMatch = {
  partner_id: string;
  partner_name: string;
  i_give_member: string;
  i_give_goods: string;
  i_get_member: string;
  i_get_goods: string;
  my_have_id: number;
  my_want_id: number;
  their_have_id: number;
  their_want_id: number;
};
