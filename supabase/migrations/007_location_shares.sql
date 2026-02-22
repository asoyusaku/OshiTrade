-- 位置共有テーブル
CREATE TABLE IF NOT EXISTS public.location_shares (
  id SERIAL PRIMARY KEY,
  chat_room_id INT NOT NULL REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(chat_room_id, user_id)
);

CREATE INDEX idx_location_shares_room ON public.location_shares(chat_room_id);

ALTER TABLE public.location_shares ENABLE ROW LEVEL SECURITY;

-- チャット参加者のみ閲覧可能
CREATE POLICY "Chat participants can view location shares"
  ON public.location_shares FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_rooms cr
      WHERE cr.id = chat_room_id
        AND (cr.user_a = auth.uid() OR cr.user_b = auth.uid())
    )
  );

-- 自分の位置のみ挿入可能
CREATE POLICY "Users can insert own location"
  ON public.location_shares FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.chat_rooms cr
      WHERE cr.id = chat_room_id
        AND (cr.user_a = auth.uid() OR cr.user_b = auth.uid())
    )
  );

-- 自分の位置のみ更新可能
CREATE POLICY "Users can update own location"
  ON public.location_shares FOR UPDATE
  USING (user_id = auth.uid());

-- Realtimeを有効化
ALTER PUBLICATION supabase_realtime ADD TABLE public.location_shares;
