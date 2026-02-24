// Supabase Edge Function: fetch-goods-variants
// 公式グッズストア(store.plusmember.jp)から商品名をスクレイピングし、
// バリエーション（衣装名など）を goods_variants テーブルに自動登録する。
// イベント当日のグループのみ対象。
//
// デプロイ方法:
//   supabase functions deploy fetch-goods-variants
//
// 手動実行:
//   curl -X POST https://<project-ref>.supabase.co/functions/v1/fetch-goods-variants \
//     -H "Authorization: Bearer <service_role_key>"
//
// 定期実行 (pg_cron):
//   SELECT cron.schedule('fetch-goods-variants-daily', '0 8 * * *',
//     $$SELECT net.http_post(
//       url := 'https://<project-ref>.supabase.co/functions/v1/fetch-goods-variants',
//       headers := '{"Authorization": "Bearer <service_role_key>"}'::jsonb
//     )$$
//   );

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// グループごとのグッズストア設定
const GROUP_STORE_CONFIG: Record<number, { storePath: string; photoCategory: string; maxVariants: number }> = {
  1: { // 櫻坂46
    storePath: 'sakurazaka46',
    photoCategory: '2096', // 【通常配送】生写真カテゴリ
    maxVariants: 6,
  },
  2: { // =LOVE
    storePath: 'equallove',
    photoCategory: '1071', // 全アイテム（生写真含む）
    maxVariants: 6,
  },
};

interface ScrapedVariant {
  group_id: number;
  goods_type_id: number;
  variant_name: string;
}

interface GoodsType {
  id: number;
  name: string;
}

// 商品名から衣装名（バリエーション）を抽出
function extractVariantName(productName: string): string | null {
  // 櫻坂46パターン: 【通常配送】...【衣装名】→ 最後の【】が衣装名
  const bracketMatches = productName.match(/【([^】]+)】/g);
  if (bracketMatches && bracketMatches.length >= 2) {
    const lastBracket = bracketMatches[bracketMatches.length - 1];
    const variantName = lastBracket.slice(1, -1).trim();
    const cleaned = variantName.replace(/^\d{4}年\s*/, '');
    if (cleaned) return cleaned;
  }

  // =LOVEパターン: 生写真セット（衣装名）→ 括弧内が衣装名
  const parenMatch = productName.match(/[（(]([^）)]+衣装[^）)]*)[）)]/);
  if (parenMatch) {
    return parenMatch[1].trim();
  }

  return null;
}


// store.plusmember.jp から商品名一覧を取得
async function fetchProductNames(storePath: string, categoryId: string): Promise<string[]> {
  const productNames: string[] = [];
  const url = `https://store.plusmember.jp/${storePath}/products/list.php?category_id=${categoryId}`;

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; OshiTrade/1.0)',
      },
    });
    const html = await res.text();

    // HTMLからテキストを行単位で抽出し、【通常配送】で始まる商品名のみ取得
    const textContent = html.replace(/<[^>]+>/g, '\n');
    const lines = textContent.split('\n').map((l) => l.trim()).filter(Boolean);
    for (const line of lines) {
      if (line.startsWith('【通常配送】') && !productNames.includes(line)) {
        productNames.push(line);
      }
    }
  } catch (e) {
    console.error(`Error fetching products from ${storePath}:`, e);
  }

  return productNames;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 今日のイベントがあるグループを取得
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const { data: todayEvents } = await supabase
      .from('events')
      .select('group_id')
      .eq('event_date', today)
      .eq('is_active', true);

    const targetGroupIds = [...new Set((todayEvents || []).map((e: { group_id: number }) => e.group_id))];

    if (targetGroupIds.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No events today', inserted: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // グッズ種類マスタを取得
    const { data: goodsTypes } = await supabase
      .from('goods_types')
      .select('id, name');

    if (!goodsTypes || goodsTypes.length === 0) {
      throw new Error('No goods types found');
    }

    let totalInserted = 0;
    let totalSkipped = 0;
    const extractedVariants: { group_id: number; goods_type: string; variant_name: string }[] = [];

    for (const groupId of targetGroupIds) {
      const config = GROUP_STORE_CONFIG[groupId];
      if (!config) {
        console.warn(`No store config for group_id=${groupId}`);
        continue;
      }

      // このグループのスクレイピング由来のバリエーションを削除（手動追加分は残す）
      await supabase
        .from('goods_variants')
        .delete()
        .eq('group_id', groupId)
        .is('created_by', null);

      // 生写真カテゴリから商品名をスクレイピング
      const productNames = await fetchProductNames(config.storePath, config.photoCategory);
      console.log(`Group ${groupId}: found ${productNames.length} products`);

      // 【通常配送】のみ対象、衣装名を抽出、最新N件に制限
      const photoGoodsType = goodsTypes.find((gt) => gt.name === '生写真');
      if (!photoGoodsType) continue;

      const seen = new Set<string>();
      const uniqueVariants: ScrapedVariant[] = [];

      for (const name of productNames) {
        // 【通常配送】で始まるもののみ
        if (!name.startsWith('【通常配送】')) continue;

        const variantName = extractVariantName(name);
        if (!variantName || seen.has(variantName)) continue;

        seen.add(variantName);
        uniqueVariants.push({
          group_id: groupId,
          goods_type_id: photoGoodsType.id,
          variant_name: variantName,
        });

        // 最新N件に制限
        if (uniqueVariants.length >= config.maxVariants) break;
      }

      // DB登録 & レスポンス用にリスト作成
      for (const variant of uniqueVariants) {
        const goodsTypeName = goodsTypes.find((gt) => gt.id === variant.goods_type_id)?.name || '不明';
        extractedVariants.push({
          group_id: variant.group_id,
          goods_type: goodsTypeName,
          variant_name: variant.variant_name,
        });

        const { error } = await supabase
          .from('goods_variants')
          .upsert(
            {
              group_id: variant.group_id,
              goods_type_id: variant.goods_type_id,
              variant_name: variant.variant_name,
              created_by: null,
            },
            { onConflict: 'group_id,goods_type_id,variant_name' }
          );

        if (error) {
          console.error(`Failed to upsert variant: ${variant.variant_name}`, error);
          totalSkipped++;
        } else {
          totalInserted++;
        }
      }
    }

    const result = {
      success: true,
      target_groups: targetGroupIds,
      inserted: totalInserted,
      skipped: totalSkipped,
      variants: extractedVariants,
      timestamp: new Date().toISOString(),
    };

    console.log('fetch-goods-variants result:', result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('fetch-goods-variants error:', error);
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
