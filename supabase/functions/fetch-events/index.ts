// Supabase Edge Function: fetch-events
// 公式サイトからイベント情報を自動取得し、eventsテーブルに追加する
//
// デプロイ方法:
//   supabase functions deploy fetch-events
//
// 手動実行:
//   curl -X POST https://<project-ref>.supabase.co/functions/v1/fetch-events \
//     -H "Authorization: Bearer <service_role_key>"
//
// 定期実行 (pg_cron):
//   SELECT cron.schedule('fetch-events-daily', '0 9 * * *',
//     $$SELECT net.http_post(
//       url := 'https://<project-ref>.supabase.co/functions/v1/fetch-events',
//       headers := '{"Authorization": "Bearer <service_role_key>"}'::jsonb
//     )$$
//   );

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ScrapedEvent {
  group_id: number;
  name: string;
  venue: string | null;
  event_date: string; // YYYY-MM-DD
}

// 櫻坂46 公式サイトからスケジュールを取得
async function fetchSakurazakaEvents(): Promise<ScrapedEvent[]> {
  const events: ScrapedEvent[] = [];

  try {
    const res = await fetch('https://sakurazaka46.com/s/s46/media/list?ima=0000&dy=schedule');
    const html = await res.text();

    // スケジュールページからイベント情報を抽出
    // 注意: サイト構造の変更で壊れる可能性あり
    const eventPattern = /<div class="com-schedule-list">[\s\S]*?<\/div>/g;
    const datePattern = /(\d{4})\.(\d{2})\.(\d{2})/;
    const titlePattern = /<p class="[^"]*title[^"]*">([\s\S]*?)<\/p>/;

    let match;
    while ((match = eventPattern.exec(html)) !== null) {
      const block = match[0];
      const dateMatch = block.match(datePattern);
      const titleMatch = block.match(titlePattern);

      if (dateMatch && titleMatch) {
        const eventDate = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`;
        const name = titleMatch[1].replace(/<[^>]+>/g, '').trim();

        // ライブ・コンサート関連のみ対象
        if (name.includes('ライブ') || name.includes('LIVE') || name.includes('コンサート') || name.includes('ツアー')) {
          events.push({
            group_id: 1, // 櫻坂46
            name,
            venue: null,
            event_date: eventDate,
          });
        }
      }
    }
  } catch (e) {
    console.error('Error fetching Sakurazaka46 events:', e);
  }

  return events;
}

// =LOVE 公式サイトからスケジュールを取得
async function fetchEqualLoveEvents(): Promise<ScrapedEvent[]> {
  const events: ScrapedEvent[] = [];

  try {
    const res = await fetch('https://equal-love.jp/schedule/');
    const html = await res.text();

    const eventPattern = /<li class="schedule-list__item">[\s\S]*?<\/li>/g;
    const datePattern = /(\d{4})[\.\-\/](\d{2})[\.\-\/](\d{2})/;
    const titlePattern = /<[^>]*class="[^"]*title[^"]*"[^>]*>([\s\S]*?)<\//;

    let match;
    while ((match = eventPattern.exec(html)) !== null) {
      const block = match[0];
      const dateMatch = block.match(datePattern);
      const titleMatch = block.match(titlePattern);

      if (dateMatch && titleMatch) {
        const eventDate = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`;
        const name = titleMatch[1].replace(/<[^>]+>/g, '').trim();

        if (name.includes('ライブ') || name.includes('LIVE') || name.includes('コンサート') || name.includes('ツアー')) {
          events.push({
            group_id: 2, // =LOVE
            name,
            venue: null,
            event_date: eventDate,
          });
        }
      }
    }
  } catch (e) {
    console.error('Error fetching =LOVE events:', e);
  }

  return events;
}

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // スクレイピング実行
    const [sakurazakaEvents, equalLoveEvents] = await Promise.all([
      fetchSakurazakaEvents(),
      fetchEqualLoveEvents(),
    ]);

    const allEvents = [...sakurazakaEvents, ...equalLoveEvents];
    let insertedCount = 0;
    let skippedCount = 0;

    for (const event of allEvents) {
      // 重複チェック: 同じグループ・名前・日付のイベントが存在するか
      const { data: existing } = await supabase
        .from('events')
        .select('id')
        .eq('group_id', event.group_id)
        .eq('name', event.name)
        .eq('event_date', event.event_date)
        .maybeSingle();

      if (existing) {
        skippedCount++;
        continue;
      }

      // 新規イベントを追加
      const { error } = await supabase.from('events').insert(event);
      if (error) {
        console.error(`Failed to insert event: ${event.name}`, error);
      } else {
        insertedCount++;
      }
    }

    const result = {
      success: true,
      scraped: allEvents.length,
      inserted: insertedCount,
      skipped: skippedCount,
      timestamp: new Date().toISOString(),
    };

    console.log('fetch-events result:', result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('fetch-events error:', error);
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
