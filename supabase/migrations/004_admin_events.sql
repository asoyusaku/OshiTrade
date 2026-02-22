-- ============================================================
-- 管理者ロール追加
-- ============================================================
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE;

-- ============================================================
-- イベントの管理者CRUDポリシー
-- ============================================================
CREATE POLICY "Admins can insert events" ON public.events
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );

CREATE POLICY "Admins can update events" ON public.events
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );

CREATE POLICY "Admins can delete events" ON public.events
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );

-- ============================================================
-- イベント提案テーブル
-- ============================================================
CREATE TYPE suggestion_status AS ENUM ('pending', 'approved', 'rejected');

CREATE TABLE public.event_suggestions (
  id          SERIAL PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  group_id    INT NOT NULL REFERENCES public.idol_groups(id),
  name        TEXT NOT NULL,
  venue       TEXT,
  event_date  DATE NOT NULL,
  note        TEXT,
  status      suggestion_status NOT NULL DEFAULT 'pending',
  reviewed_by UUID REFERENCES public.profiles(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_suggestions_status ON public.event_suggestions(status);
CREATE INDEX idx_suggestions_user ON public.event_suggestions(user_id);

-- RLS
ALTER TABLE public.event_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own suggestions" ON public.event_suggestions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all suggestions" ON public.event_suggestions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );

CREATE POLICY "Users can create suggestions" ON public.event_suggestions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can update suggestions" ON public.event_suggestions
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );
