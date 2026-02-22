-- ============================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================

-- Profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles
  FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Idol Groups (read-only for all)
ALTER TABLE public.idol_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Idol groups are viewable by everyone" ON public.idol_groups
  FOR SELECT USING (true);

-- Members (read-only for all)
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members are viewable by everyone" ON public.members
  FOR SELECT USING (true);

-- Goods Types (read-only for all)
ALTER TABLE public.goods_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Goods types are viewable by everyone" ON public.goods_types
  FOR SELECT USING (true);

-- Events (read-only for all)
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Events are viewable by everyone" ON public.events
  FOR SELECT USING (true);

-- Event Participants
ALTER TABLE public.event_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Event participants are viewable by everyone" ON public.event_participants
  FOR SELECT USING (true);
CREATE POLICY "Users can join events" ON public.event_participants
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can leave events" ON public.event_participants
  FOR DELETE USING (auth.uid() = user_id);

-- Have Items
ALTER TABLE public.have_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Have items visible to event participants" ON public.have_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.event_participants ep
      WHERE ep.event_id = have_items.event_id AND ep.user_id = auth.uid()
    )
  );
CREATE POLICY "Users can insert own have items" ON public.have_items
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own have items" ON public.have_items
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own have items" ON public.have_items
  FOR DELETE USING (auth.uid() = user_id);

-- Want Items
ALTER TABLE public.want_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Want items visible to event participants" ON public.want_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.event_participants ep
      WHERE ep.event_id = want_items.event_id AND ep.user_id = auth.uid()
    )
  );
CREATE POLICY "Users can insert own want items" ON public.want_items
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own want items" ON public.want_items
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own want items" ON public.want_items
  FOR DELETE USING (auth.uid() = user_id);

-- Matches
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own matches" ON public.matches
  FOR SELECT USING (auth.uid() = user_a OR auth.uid() = user_b);
CREATE POLICY "Users can create matches" ON public.matches
  FOR INSERT WITH CHECK (auth.uid() = user_a);
CREATE POLICY "Match participants can update" ON public.matches
  FOR UPDATE USING (auth.uid() = user_a OR auth.uid() = user_b);

-- Match Items
ALTER TABLE public.match_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Match items visible to match participants" ON public.match_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = match_items.match_id
      AND (m.user_a = auth.uid() OR m.user_b = auth.uid())
    )
  );
CREATE POLICY "Users can insert match items" ON public.match_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = match_items.match_id
      AND m.user_a = auth.uid()
    )
  );

-- Chat Rooms
ALTER TABLE public.chat_rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Chat participants can view rooms" ON public.chat_rooms
  FOR SELECT USING (auth.uid() = user_a OR auth.uid() = user_b);
CREATE POLICY "Match participants can create chat rooms" ON public.chat_rooms
  FOR INSERT WITH CHECK (auth.uid() = user_a);

-- Messages
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Chat participants can read messages" ON public.messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.chat_rooms cr
      WHERE cr.id = messages.chat_room_id
      AND (cr.user_a = auth.uid() OR cr.user_b = auth.uid())
    )
  );
CREATE POLICY "Chat participants can send messages" ON public.messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (
      SELECT 1 FROM public.chat_rooms cr
      WHERE cr.id = messages.chat_room_id
      AND (cr.user_a = auth.uid() OR cr.user_b = auth.uid())
    )
  );
CREATE POLICY "Recipients can mark messages as read" ON public.messages
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.chat_rooms cr
      WHERE cr.id = messages.chat_room_id
      AND (cr.user_a = auth.uid() OR cr.user_b = auth.uid())
    )
  );
