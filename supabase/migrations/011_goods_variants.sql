-- ============================================================
-- GOODS VARIANTS (イベント別グッズバリエーション)
-- ============================================================

-- 1. goods_variants テーブル作成
CREATE TABLE public.goods_variants (
  id            SERIAL PRIMARY KEY,
  event_id      INT NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  goods_type_id INT NOT NULL REFERENCES public.goods_types(id) ON DELETE CASCADE,
  variant_name  TEXT NOT NULL,
  created_by    UUID NOT NULL REFERENCES public.profiles(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(event_id, goods_type_id, variant_name)
);

CREATE INDEX idx_goods_variants_event_goods ON public.goods_variants(event_id, goods_type_id);

-- 2. have_items に variant_id 追加
ALTER TABLE public.have_items
  ADD COLUMN variant_id INT REFERENCES public.goods_variants(id) ON DELETE SET NULL;

ALTER TABLE public.have_items
  DROP CONSTRAINT have_items_user_id_event_id_member_id_goods_type_id_key;

ALTER TABLE public.have_items
  ADD CONSTRAINT have_items_user_event_member_goods_variant_key
  UNIQUE(user_id, event_id, member_id, goods_type_id, variant_id);

-- 3. want_items に variant_id 追加
ALTER TABLE public.want_items
  ADD COLUMN variant_id INT REFERENCES public.goods_variants(id) ON DELETE SET NULL;

ALTER TABLE public.want_items
  DROP CONSTRAINT want_items_user_id_event_id_member_id_goods_type_id_key;

ALTER TABLE public.want_items
  ADD CONSTRAINT want_items_user_event_member_goods_variant_key
  UNIQUE(user_id, event_id, member_id, goods_type_id, variant_id);

-- 4. find_bidirectional_matches RPC更新 (バリエーション対応)
DROP FUNCTION IF EXISTS find_bidirectional_matches(UUID, INT);
CREATE OR REPLACE FUNCTION find_bidirectional_matches(
  p_user_id UUID,
  p_event_id INT
)
RETURNS TABLE (
  partner_id      UUID,
  partner_name    TEXT,
  i_give_member   TEXT,
  i_give_goods    TEXT,
  i_give_variant  TEXT,
  i_get_member    TEXT,
  i_get_goods     TEXT,
  i_get_variant   TEXT,
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
    v1.variant_name         AS i_give_variant,
    m2.name                 AS i_get_member,
    g2.name                 AS i_get_goods,
    v2.variant_name         AS i_get_variant,
    my_have.id              AS my_have_id,
    my_want.id              AS my_want_id,
    their_have.id           AS their_have_id,
    their_want.id           AS their_want_id
  FROM public.have_items my_have
  JOIN public.want_items their_want
    ON my_have.event_id       = their_want.event_id
    AND my_have.member_id     = their_want.member_id
    AND my_have.goods_type_id = their_want.goods_type_id
    AND (my_have.variant_id = their_want.variant_id
         OR (my_have.variant_id IS NULL AND their_want.variant_id IS NULL))
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
    AND (their_have.variant_id = my_want.variant_id
         OR (their_have.variant_id IS NULL AND my_want.variant_id IS NULL))
  JOIN public.profiles other_user ON other_user.id = their_want.user_id
  JOIN public.members m1 ON m1.id = my_have.member_id
  JOIN public.goods_types g1 ON g1.id = my_have.goods_type_id
  LEFT JOIN public.goods_variants v1 ON v1.id = my_have.variant_id
  JOIN public.members m2 ON m2.id = their_have.member_id
  JOIN public.goods_types g2 ON g2.id = their_have.goods_type_id
  LEFT JOIN public.goods_variants v2 ON v2.id = their_have.variant_id
  WHERE my_have.user_id = p_user_id
    AND my_have.event_id = p_event_id
    AND my_have.is_available = TRUE
    AND their_want.user_id <> p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. RLSポリシー
ALTER TABLE public.goods_variants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "goods_variants_select" ON public.goods_variants
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "goods_variants_insert" ON public.goods_variants
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
