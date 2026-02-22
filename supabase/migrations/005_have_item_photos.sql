-- ============================================================
-- have_items に写真URLカラムを追加
-- ============================================================
ALTER TABLE public.have_items ADD COLUMN IF NOT EXISTS photo_url TEXT;
