-- 既存チャットデータをすべて削除（順番が重要: 子テーブルから先に削除）
DELETE FROM public.location_shares;
DELETE FROM public.messages;
DELETE FROM public.chat_rooms;
