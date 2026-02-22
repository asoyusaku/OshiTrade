-- ============================================================
-- PROFILES (extends Supabase auth.users)
-- ============================================================
CREATE TABLE public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username    TEXT NOT NULL UNIQUE,
  display_name TEXT,
  avatar_url  TEXT,
  push_token  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- IDOL GROUPS
-- ============================================================
CREATE TABLE public.idol_groups (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  name_romaji TEXT NOT NULL,
  sort_order  INT NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE
);

-- ============================================================
-- MEMBERS
-- ============================================================
CREATE TABLE public.members (
  id          SERIAL PRIMARY KEY,
  group_id    INT NOT NULL REFERENCES public.idol_groups(id),
  name        TEXT NOT NULL,
  name_romaji TEXT,
  generation  SMALLINT,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order  INT NOT NULL DEFAULT 0,
  UNIQUE(group_id, name)
);

CREATE INDEX idx_members_group ON public.members(group_id);

-- ============================================================
-- GOODS TYPES
-- ============================================================
CREATE TABLE public.goods_types (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  name_en     TEXT,
  sort_order  INT NOT NULL DEFAULT 0
);

-- ============================================================
-- EVENTS
-- ============================================================
CREATE TABLE public.events (
  id          SERIAL PRIMARY KEY,
  group_id    INT NOT NULL REFERENCES public.idol_groups(id),
  name        TEXT NOT NULL,
  venue       TEXT,
  event_date  DATE NOT NULL,
  starts_at   TIMESTAMPTZ,
  ends_at     TIMESTAMPTZ,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_events_date ON public.events(event_date);
CREATE INDEX idx_events_group ON public.events(group_id);

-- ============================================================
-- EVENT PARTICIPANTS
-- ============================================================
CREATE TABLE public.event_participants (
  id          SERIAL PRIMARY KEY,
  event_id    INT NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(event_id, user_id)
);

CREATE INDEX idx_ep_event ON public.event_participants(event_id);
CREATE INDEX idx_ep_user  ON public.event_participants(user_id);

-- ============================================================
-- HAVE ITEMS
-- ============================================================
CREATE TABLE public.have_items (
  id            SERIAL PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_id      INT NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  member_id     INT NOT NULL REFERENCES public.members(id),
  goods_type_id INT NOT NULL REFERENCES public.goods_types(id),
  quantity      SMALLINT NOT NULL DEFAULT 1 CHECK (quantity > 0),
  note          TEXT,
  is_available  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, event_id, member_id, goods_type_id)
);

CREATE INDEX idx_have_event ON public.have_items(event_id) WHERE is_available = TRUE;
CREATE INDEX idx_have_user  ON public.have_items(user_id);
CREATE INDEX idx_have_match ON public.have_items(event_id, member_id, goods_type_id) WHERE is_available = TRUE;

-- ============================================================
-- WANT ITEMS
-- ============================================================
CREATE TABLE public.want_items (
  id            SERIAL PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_id      INT NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  member_id     INT NOT NULL REFERENCES public.members(id),
  goods_type_id INT NOT NULL REFERENCES public.goods_types(id),
  quantity      SMALLINT NOT NULL DEFAULT 1 CHECK (quantity > 0),
  is_fulfilled  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, event_id, member_id, goods_type_id)
);

CREATE INDEX idx_want_event ON public.want_items(event_id) WHERE is_fulfilled = FALSE;
CREATE INDEX idx_want_user  ON public.want_items(user_id);
CREATE INDEX idx_want_match ON public.want_items(event_id, member_id, goods_type_id) WHERE is_fulfilled = FALSE;

-- ============================================================
-- MATCHES
-- ============================================================
CREATE TYPE match_status AS ENUM ('pending', 'accepted', 'completed', 'cancelled');

CREATE TABLE public.matches (
  id          SERIAL PRIMARY KEY,
  event_id    INT NOT NULL REFERENCES public.events(id),
  user_a      UUID NOT NULL REFERENCES public.profiles(id),
  user_b      UUID NOT NULL REFERENCES public.profiles(id),
  status      match_status NOT NULL DEFAULT 'pending',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT different_users CHECK (user_a <> user_b)
);

CREATE INDEX idx_matches_event ON public.matches(event_id);
CREATE INDEX idx_matches_user_a ON public.matches(user_a);
CREATE INDEX idx_matches_user_b ON public.matches(user_b);

-- ============================================================
-- MATCH ITEMS
-- ============================================================
CREATE TABLE public.match_items (
  id          SERIAL PRIMARY KEY,
  match_id    INT NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  giver_id    UUID NOT NULL REFERENCES public.profiles(id),
  have_item_id INT NOT NULL REFERENCES public.have_items(id),
  want_item_id INT NOT NULL REFERENCES public.want_items(id)
);

CREATE INDEX idx_match_items_match ON public.match_items(match_id);

-- ============================================================
-- CHAT ROOMS
-- ============================================================
CREATE TABLE public.chat_rooms (
  id          SERIAL PRIMARY KEY,
  match_id    INT NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE UNIQUE,
  user_a      UUID NOT NULL REFERENCES public.profiles(id),
  user_b      UUID NOT NULL REFERENCES public.profiles(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_chat_rooms_users ON public.chat_rooms(user_a, user_b);

-- ============================================================
-- MESSAGES
-- ============================================================
CREATE TABLE public.messages (
  id          BIGSERIAL PRIMARY KEY,
  chat_room_id INT NOT NULL REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
  sender_id   UUID NOT NULL REFERENCES public.profiles(id),
  content     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at     TIMESTAMPTZ
);

CREATE INDEX idx_messages_room ON public.messages(chat_room_id, created_at);

-- ============================================================
-- BIDIRECTIONAL MATCHING FUNCTION
-- ============================================================
CREATE OR REPLACE FUNCTION find_bidirectional_matches(
  p_user_id UUID,
  p_event_id INT
)
RETURNS TABLE (
  partner_id      UUID,
  partner_name    TEXT,
  i_give_member   TEXT,
  i_give_goods    TEXT,
  i_get_member    TEXT,
  i_get_goods     TEXT,
  my_have_id      INT,
  my_want_id      INT,
  their_have_id   INT,
  their_want_id   INT
) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT
    other_user.id           AS partner_id,
    other_user.display_name AS partner_name,
    m1.name                 AS i_give_member,
    g1.name                 AS i_give_goods,
    m2.name                 AS i_get_member,
    g2.name                 AS i_get_goods,
    my_have.id              AS my_have_id,
    my_want.id              AS my_want_id,
    their_have.id           AS their_have_id,
    their_want.id           AS their_want_id
  FROM public.have_items my_have
  JOIN public.want_items their_want
    ON my_have.event_id       = their_want.event_id
    AND my_have.member_id     = their_want.member_id
    AND my_have.goods_type_id = their_want.goods_type_id
    AND their_want.is_fulfilled = FALSE
  JOIN public.have_items their_have
    ON their_have.user_id     = their_want.user_id
    AND their_have.event_id   = p_event_id
    AND their_have.is_available = TRUE
  JOIN public.want_items my_want
    ON my_want.user_id        = p_user_id
    AND my_want.event_id      = p_event_id
    AND my_want.is_fulfilled  = FALSE
    AND their_have.member_id  = my_want.member_id
    AND their_have.goods_type_id = my_want.goods_type_id
  JOIN public.profiles other_user ON other_user.id = their_want.user_id
  JOIN public.members m1 ON m1.id = my_have.member_id
  JOIN public.goods_types g1 ON g1.id = my_have.goods_type_id
  JOIN public.members m2 ON m2.id = their_have.member_id
  JOIN public.goods_types g2 ON g2.id = their_have.goods_type_id
  WHERE my_have.user_id = p_user_id
    AND my_have.event_id = p_event_id
    AND my_have.is_available = TRUE
    AND their_want.user_id <> p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- ENABLE REALTIME
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.matches;
-- ============================================================
-- IDOL GROUPS
-- ============================================================
INSERT INTO public.idol_groups (name, name_romaji, sort_order) VALUES
  ('櫻坂46', 'Sakurazaka46', 1),
  ('=LOVE', 'Equal Love', 2);

-- ============================================================
-- GOODS TYPES
-- ============================================================
INSERT INTO public.goods_types (name, name_en, sort_order) VALUES
  ('アクリルスタンド', 'Acrylic Stand', 1),
  ('生写真', 'Raw Photo', 2),
  ('ペンライト', 'Penlight', 3),
  ('クリアファイル', 'Clear File', 4),
  ('缶バッジ', 'Can Badge', 5),
  ('タオル', 'Towel', 6),
  ('Tシャツ', 'T-Shirt', 7),
  ('ポストカード', 'Postcard', 8),
  ('ラバーバンド', 'Rubber Band', 9),
  ('トレーディングカード', 'Trading Card', 10);

-- ============================================================
-- 櫻坂46 MEMBERS
-- ============================================================
INSERT INTO public.members (group_id, name, name_romaji, generation, sort_order) VALUES
  -- 1期生
  (1, '上村莉菜', 'Uemura Rina', 1, 1),
  (1, '小林由依', 'Kobayashi Yui', 1, 2),
  -- 2期生
  (1, '松田里奈', 'Matsuda Rina', 2, 10),
  (1, '田村保乃', 'Tamura Hono', 2, 11),
  (1, '藤吉夏鈴', 'Fujiyoshi Karin', 2, 12),
  (1, '森田ひかる', 'Morita Hikaru', 2, 13),
  (1, '守屋麗奈', 'Moriya Rena', 2, 14),
  (1, '大園玲', 'Ozono Rei', 2, 15),
  (1, '大沼晶保', 'Onuma Akiho', 2, 16),
  (1, '遠藤光莉', 'Endo Hikari', 2, 17),
  (1, '増本綺良', 'Masumoto Kira', 2, 18),
  (1, '武元唯衣', 'Takemoto Yui', 2, 19),
  (1, '山﨑天', 'Yamasaki Ten', 2, 20),
  -- 3期生
  (1, '石森璃花', 'Ishimori Rika', 3, 21),
  (1, '小田倉麗奈', 'Odakura Reina', 3, 22),
  (1, '小島凪紗', 'Kojima Nagisa', 3, 23),
  (1, '中嶋優月', 'Nakashima Yuzuki', 3, 24),
  (1, '幸阪茉里乃', 'Kousaka Marino', 3, 25),
  (1, '谷口愛季', 'Taniguchi Airi', 3, 26),
  (1, '村井優', 'Murai Yu', 3, 27),
  (1, '村山美羽', 'Murayama Miu', 3, 28),
  (1, '山下瞳月', 'Yamashita Shizuki', 3, 29),
  (1, '的野美青', 'Matono Mio', 3, 30),
  -- 4期生
  (1, '向井純葉', 'Mukai Itoha', 4, 31),
  (1, '山川宇衣', 'Yamakawa Ui', 4, 32),
  (1, '稲熊ひな', 'Inaguma Hina', 4, 33),
  (1, '松本和子', 'Matsumoto Wako', 4, 34),
  (1, '浅井恋乃未', 'Asai Konomi', 4, 35),
  (1, '佐藤愛桜', 'Sato Airi', 4, 36),
  (1, '中川智尋', 'Nakagawa Chihiro', 4, 37),
  (1, '山田桃実', 'Yamada Momomi', 4, 38);

-- ============================================================
-- =LOVE MEMBERS
-- ============================================================
INSERT INTO public.members (group_id, name, name_romaji, generation, sort_order) VALUES
  (2, '山本杏奈', 'Yamamoto Anna', 1, 1),
  (2, '諸橋沙夏', 'Morohashi Sana', 1, 2),
  (2, '大谷映美里', 'Otani Emiri', 1, 3),
  (2, '音嶋莉沙', 'Otoshima Risa', 1, 4),
  (2, '佐々木舞香', 'Sasaki Maika', 1, 5),
  (2, '大場花菜', 'Oba Hana', 1, 6),
  (2, '野口衣織', 'Noguchi Iori', 1, 7),
  (2, '髙松瞳', 'Takamatsu Hitomi', 1, 8),
  (2, '瀧脇笙古', 'Takiwaki Shoko', 1, 9),
  (2, '齋藤樹愛羅', 'Saito Kiara', 1, 10);

-- ============================================================
-- SAMPLE EVENTS
-- ============================================================
INSERT INTO public.events (group_id, name, venue, event_date) VALUES
  (1, '櫻坂46 4th ARENA TOUR 2026', '東京ドーム', '2026-03-15'),
  (1, '櫻坂46 4th ARENA TOUR 2026', '大阪城ホール', '2026-03-22'),
  (2, '=LOVE 全国ツアー2026', 'Zepp Tokyo', '2026-04-05'),
  (2, '=LOVE 全国ツアー2026', 'Zepp Osaka Bayside', '2026-04-12');
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
