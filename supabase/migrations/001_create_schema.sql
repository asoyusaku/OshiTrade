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
