-- ============================================================
-- IDOL GROUPS
-- ============================================================
INSERT INTO public.idol_groups (name, name_romaji, sort_order) VALUES
  ('櫻坂46', 'Sakurazaka46', 1),
  ('=LOVE', 'Equal Love', 2);

-- ============================================================
-- GOODS TYPES
-- ============================================================
INSERT INTO public.goods_types (name, name_en, sort_order) VALUES
  ('アクリルスタンド', 'Acrylic Stand', 1),
  ('生写真', 'Raw Photo', 2),
  ('ペンライト', 'Penlight', 3),
  ('クリアファイル', 'Clear File', 4),
  ('缶バッジ', 'Can Badge', 5),
  ('タオル', 'Towel', 6),
  ('Tシャツ', 'T-Shirt', 7),
  ('ポストカード', 'Postcard', 8),
  ('ラバーバンド', 'Rubber Band', 9),
  ('トレーディングカード', 'Trading Card', 10);

-- ============================================================
-- 櫻坂46 MEMBERS
-- ============================================================
INSERT INTO public.members (group_id, name, name_romaji, generation, sort_order) VALUES
  -- 1期生
  (1, '上村莉菜', 'Uemura Rina', 1, 1),
  (1, '小林由依', 'Kobayashi Yui', 1, 2),
  -- 2期生
  (1, '松田里奈', 'Matsuda Rina', 2, 10),
  (1, '田村保乃', 'Tamura Hono', 2, 11),
  (1, '藤吉夏鈴', 'Fujiyoshi Karin', 2, 12),
  (1, '森田ひかる', 'Morita Hikaru', 2, 13),
  (1, '守屋麗奈', 'Moriya Rena', 2, 14),
  (1, '大園玲', 'Ozono Rei', 2, 15),
  (1, '大沼晶保', 'Onuma Akiho', 2, 16),
  (1, '遠藤光莉', 'Endo Hikari', 2, 17),
  (1, '増本綺良', 'Masumoto Kira', 2, 18),
  (1, '武元唯衣', 'Takemoto Yui', 2, 19),
  (1, '山﨑天', 'Yamasaki Ten', 2, 20),
  -- 3期生
  (1, '石森璃花', 'Ishimori Rika', 3, 21),
  (1, '小田倉麗奈', 'Odakura Reina', 3, 22),
  (1, '小島凪紗', 'Kojima Nagisa', 3, 23),
  (1, '中嶋優月', 'Nakashima Yuzuki', 3, 24),
  (1, '幸阪茉里乃', 'Kousaka Marino', 3, 25),
  (1, '谷口愛季', 'Taniguchi Airi', 3, 26),
  (1, '村井優', 'Murai Yu', 3, 27),
  (1, '村山美羽', 'Murayama Miu', 3, 28),
  (1, '山下瞳月', 'Yamashita Shizuki', 3, 29),
  (1, '的野美青', 'Matono Mio', 3, 30),
  -- 4期生
  (1, '向井純葉', 'Mukai Itoha', 4, 31),
  (1, '山川宇衣', 'Yamakawa Ui', 4, 32),
  (1, '稲熊ひな', 'Inaguma Hina', 4, 33),
  (1, '松本和子', 'Matsumoto Wako', 4, 34),
  (1, '浅井恋乃未', 'Asai Konomi', 4, 35),
  (1, '佐藤愛桜', 'Sato Airi', 4, 36),
  (1, '中川智尋', 'Nakagawa Chihiro', 4, 37),
  (1, '山田桃実', 'Yamada Momomi', 4, 38);

-- ============================================================
-- =LOVE MEMBERS
-- ============================================================
INSERT INTO public.members (group_id, name, name_romaji, generation, sort_order) VALUES
  (2, '山本杏奈', 'Yamamoto Anna', 1, 1),
  (2, '諸橋沙夏', 'Morohashi Sana', 1, 2),
  (2, '大谷映美里', 'Otani Emiri', 1, 3),
  (2, '音嶋莉沙', 'Otoshima Risa', 1, 4),
  (2, '佐々木舞香', 'Sasaki Maika', 1, 5),
  (2, '大場花菜', 'Oba Hana', 1, 6),
  (2, '野口衣織', 'Noguchi Iori', 1, 7),
  (2, '髙松瞳', 'Takamatsu Hitomi', 1, 8),
  (2, '瀧脇笙古', 'Takiwaki Shoko', 1, 9),
  (2, '齋藤樹愛羅', 'Saito Kiara', 1, 10);

-- ============================================================
-- SAMPLE EVENTS
-- ============================================================
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
