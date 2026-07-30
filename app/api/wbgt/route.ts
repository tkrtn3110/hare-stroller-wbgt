import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const pointId = searchParams.get('pointId') || searchParams.get('area') || '48156';

  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');

  const yyyymm = `${yyyy}${mm}`;
  const todayStr = `${yyyy}${mm}${dd}`;

  // 本家サイトの最新数値（25.6など）が入っている「実況値」を最優先にする
  const urlsToTry = [
    `https://www.wbgt.env.go.jp/est15WG/dl/wbgt_${pointId}_${yyyymm}.csv`,  // 実況値(最優先)
    `https://www.wbgt.env.go.jp/prev15WG/dl/yohou_${pointId}.csv`,         // 予測値(フォールバック)
  ];

  let lastStatus = 500;
  let lastErrorDetail = '';

  for (const url of urlsToTry) {
    try {
      const res = await fetch(url, {
        cache: 'no-store',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        },
      });

      if (!res.ok) {
        lastStatus = res.status;
        lastErrorDetail = `HTTP ${res.status} from ${url}`;
        continue;
      }

      const arrayBuffer = await res.arrayBuffer();
      const decoder = new TextDecoder('shift-jis');
      const csvText = decoder.decode(arrayBuffer);

      const lines = csvText.trim().split(/\r?\n/).filter(line => line.trim() !== '');

      if (lines.length < 2) continue;

      let matchedWbgt: number | null = null;

      // --- 1. 今日の日付が含まれる行を末尾（最新時刻）から探索 ---
      for (let i = lines.length - 1; i >= 1; i--) {
        const line = lines[i];
        
        // 当日のデータ行かチェック（例: "2026/07/30" や "20260730"）
        if (line.includes(todayStr) || line.includes(`${yyyy}/${mm}/${dd}`) || line.includes(`${yyyy}-${mm}-${dd}`)) {
          const cols = line.split(',').map(c => c.trim());
          
          // 列の末尾（最新データ）から有効なWBGT数値を検索
          for (let j = cols.length - 1; j >= 0; j--) {
            const val = parseFloat(cols[j]);
            // 欠測値（-999等）および異常値を除外
            if (!isNaN(val) && val > 0 && val < 500) {
              matchedWbgt = val > 50 ? val / 10 : val;
              break;
            }
          }
          if (matchedWbgt !== null) break;
        }
      }

      // --- 2. もし当日行で見つからなければ全体の最新行（末尾）から検索 ---
      if (matchedWbgt === null) {
        for (let i = lines.length - 1; i >= 1; i--) {
          const cols = lines[i].split(',').map(c => c.trim());
          for (let j = cols.length - 1; j >= 0; j--) {
            const val = parseFloat(cols[j]);
            if (!isNaN(val) && val > 0 && val < 500) {
              matchedWbgt = val > 50 ? val / 10 : val;
              break;
            }
          }
          if (matchedWbgt !== null) break;
        }
      }

      if (matchedWbgt !== null) {
        // 小数第1位に丸める（本家サイト表示に合わせる）
        const roundedWbgt = Math.round(matchedWbgt * 10) / 10;
        return NextResponse.json({
          success: true,
          pointId,
          wbgt: roundedWbgt,
          sourceUrl: url,
        });
      }

    } catch (err: any) {
      lastErrorDetail = err.message || 'Fetch error';
    }
  }

  return NextResponse.json(
    {
      success: false,
      error: '最新時間の暑さ指数を取得できませんでした',
      detail: lastErrorDetail,
    },
    { status: lastStatus }
  );
}
