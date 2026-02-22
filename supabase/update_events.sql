-- 関連データを依存関係の順に削除
DELETE FROM public.messages;
DELETE FROM public.chat_rooms;
DELETE FROM public.match_items;
DELETE FROM public.matches;
DELETE FROM public.have_items;
DELETE FROM public.want_items;
DELETE FROM public.event_participants;
DELETE FROM public.events;

-- 実際のイベントを投入
INSERT INTO public.events (group_id, name, venue, event_date) VALUES
  -- 櫻坂46 5th YEAR ANNIVERSARY LIVE
  (1, '櫻坂46 5th YEAR ANNIVERSARY LIVE DAY1', 'MUFGスタジアム（国立競技場）', '2026-04-11'),
  (1, '櫻坂46 5th YEAR ANNIVERSARY LIVE DAY2', 'MUFGスタジアム（国立競技場）', '2026-04-12'),
  -- =LOVE 8th ANNIVERSARY PREMIUM TOUR FINAL
  (2, '=LOVE 8th ANNIVERSARY PREMIUM TOUR FINAL DAY1', '横浜スタジアム', '2026-04-18'),
  (2, '=LOVE 8th ANNIVERSARY PREMIUM TOUR FINAL DAY2', '横浜スタジアム', '2026-04-19'),
  -- =LOVE STADIUM LIVE
  (2, '=LOVE STADIUM LIVE DAY1', 'MUFGスタジアム（国立競技場）', '2026-06-20'),
  (2, '=LOVE STADIUM LIVE DAY2', 'MUFGスタジアム（国立競技場）', '2026-06-21');
