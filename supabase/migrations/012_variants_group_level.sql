-- ============================================================
-- GOODS VARIANTS: イベント単位 → グループ単位に変更
-- ============================================================

-- 1. group_id カラム追加・データ移行
ALTER TABLE public.goods_variants
  ADD COLUMN group_id INT REFERENCES public.idol_groups(id) ON DELETE CASCADE;

UPDATE public.goods_variants gv
  SET group_id = e.group_id
  FROM public.events e
  WHERE e.id = gv.event_id;

-- 既存データがない場合も考慮してデフォルト設定後にNOT NULL化
ALTER TABLE public.goods_variants
  ALTER COLUMN group_id SET NOT NULL;

-- 2. created_by を NULL許可に（スクレイピング時はNULL）
ALTER TABLE public.goods_variants
  ALTER COLUMN created_by DROP NOT NULL;

-- 3. 旧制約・インデックス削除
ALTER TABLE public.goods_variants
  DROP CONSTRAINT IF EXISTS goods_variants_event_id_goods_type_id_variant_name_key;
DROP INDEX IF EXISTS idx_goods_variants_event_goods;

-- 4. event_id カラム削除
ALTER TABLE public.goods_variants
  DROP COLUMN event_id;

-- 5. 新制約・インデックス
ALTER TABLE public.goods_variants
  ADD CONSTRAINT goods_variants_group_goods_variant_key
  UNIQUE(group_id, goods_type_id, variant_name);

CREATE INDEX idx_goods_variants_group_goods
  ON public.goods_variants(group_id, goods_type_id);

-- 6. RLSポリシー更新: INSERT/DELETEを管理者のみに
DROP POLICY IF EXISTS "goods_variants_insert" ON public.goods_variants;

CREATE POLICY "goods_variants_insert" ON public.goods_variants
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "goods_variants_delete" ON public.goods_variants
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );
