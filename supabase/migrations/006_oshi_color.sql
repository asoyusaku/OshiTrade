-- ============================================================
-- メンバーカラー追加
-- ============================================================
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS color TEXT;

-- ============================================================
-- プロフィールに推しメンバー追加
-- ============================================================
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS oshi_member_id INT REFERENCES public.members(id);

-- ============================================================
-- 櫻坂46 メンバーカラー
-- ============================================================
-- 1期生
UPDATE public.members SET color = '#FF69B4' WHERE name = '上村莉菜';
UPDATE public.members SET color = '#4169E1' WHERE name = '小林由依';
-- 2期生
UPDATE public.members SET color = '#4CAF50' WHERE name = '松田里奈';
UPDATE public.members SET color = '#81D4FA' WHERE name = '田村保乃';
UPDATE public.members SET color = '#B39DDB' WHERE name = '藤吉夏鈴';
UPDATE public.members SET color = '#E53935' WHERE name = '森田ひかる';
UPDATE public.members SET color = '#FFEB3B' WHERE name = '守屋麗奈';
UPDATE public.members SET color = '#7B1FA2' WHERE name = '大園玲';
UPDATE public.members SET color = '#81D4FA' WHERE name = '大沼晶保';
UPDATE public.members SET color = '#9C27B0' WHERE name = '遠藤光莉';
UPDATE public.members SET color = '#FF9800' WHERE name = '増本綺良';
UPDATE public.members SET color = '#E91E63' WHERE name = '武元唯衣';
UPDATE public.members SET color = '#43A047' WHERE name = '山﨑天';
-- 3期生
UPDATE public.members SET color = '#F48FB1' WHERE name = '石森璃花';
UPDATE public.members SET color = '#E91E63' WHERE name = '小田倉麗奈';
UPDATE public.members SET color = '#81D4FA' WHERE name = '小島凪紗';
UPDATE public.members SET color = '#F48FB1' WHERE name = '中嶋優月';
UPDATE public.members SET color = '#A5D6A7' WHERE name = '幸阪茉里乃';
UPDATE public.members SET color = '#9C27B0' WHERE name = '谷口愛季';
UPDATE public.members SET color = '#9C27B0' WHERE name = '村井優';
UPDATE public.members SET color = '#7B1FA2' WHERE name = '村山美羽';
UPDATE public.members SET color = '#E53935' WHERE name = '山下瞳月';
UPDATE public.members SET color = '#1E88E5' WHERE name = '的野美青';
-- 4期生
UPDATE public.members SET color = '#81D4FA' WHERE name = '向井純葉';
UPDATE public.members SET color = '#B0BEC5' WHERE name = '山川宇衣';
UPDATE public.members SET color = '#FF9800' WHERE name = '稲熊ひな';
UPDATE public.members SET color = '#B0BEC5' WHERE name = '松本和子';
UPDATE public.members SET color = '#00BFA5' WHERE name = '浅井恋乃未';
UPDATE public.members SET color = '#FFB3D9' WHERE name = '佐藤愛桜';
UPDATE public.members SET color = '#7B1FA2' WHERE name = '中川智尋';
UPDATE public.members SET color = '#81D4FA' WHERE name = '山田桃実';

-- ============================================================
-- =LOVE メンバーカラー
-- ============================================================
UPDATE public.members SET color = '#FFEB3B' WHERE name = '山本杏奈';
UPDATE public.members SET color = '#9CCC65' WHERE name = '諸橋沙夏';
UPDATE public.members SET color = '#CE93D8' WHERE name = '大谷映美里';
UPDATE public.members SET color = '#81D4FA' WHERE name = '音嶋莉沙';
UPDATE public.members SET color = '#B0BEC5' WHERE name = '佐々木舞香';
UPDATE public.members SET color = '#FF9800' WHERE name = '大場花菜';
UPDATE public.members SET color = '#9C27B0' WHERE name = '野口衣織';
UPDATE public.members SET color = '#E53935' WHERE name = '髙松瞳';
UPDATE public.members SET color = '#FFEB3B' WHERE name = '瀧脇笙古';
UPDATE public.members SET color = '#F8BBD0' WHERE name = '齋藤樹愛羅';
