-- マッチング関数を修正: 相手がイベント参加中かチェックする
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
  -- 相手がイベントに参加中であることを確認
  JOIN public.event_participants ep
    ON ep.user_id = their_want.user_id
    AND ep.event_id = p_event_id
  WHERE my_have.user_id = p_user_id
    AND my_have.event_id = p_event_id
    AND my_have.is_available = TRUE
    AND their_want.user_id <> p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
