import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  let pointId = searchParams.get('pointId') || searchParams.get('area') || '48156';

  // 札幌の旧ID指定自動補正
  if (pointId === '14166' || pointId === '14163') pointId = '14163';
  // 長野の旧ID指定自動補正 (48141は白馬なので長野本庁48156へ補正)
  if (pointId === '48141') pointId = '48156';

  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yyyymm = `${yyyy}${mm}`;

  // 公式マニュアル記載の地点別データファイルURL
  const urlsToTry = [
    // 1. 実況値データ (15分〜毎時更新の最新観測値)
    `https://www.wbgt.env.go.jp/est15WG/dl/wbgt_${pointId}_${yyyymm}.csv`,
    // 2. 予測値データ (予報)
    `https://www.wbgt.env.go.jp/prev15WG/dl/yohou_${pointId}.csv`,
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

      // Shift_JISデコード
      const arrayBuffer = await res.arrayBuffer();
      const decoder = new TextDecoder('shift-jis');
      const csvText = decoder.decode(arrayBuffer);

      const lines = csvText.trim().split(/\r?\n/).filter(line => line.trim() !== '');
      if (lines.length < 2) continue;

      let extractedWbgt: number | null = null;

      // --- CSV解析ロジック ---
      // データの最終行（一番新しい日時データ）から有効なWBGT数値を取得
      for (let i = lines.length - 1; i >= 1; i--) {
        const line = lines[i];
        const cols = line.split(',').map(c => c.trim());

        // 行の末尾列（最新時刻）から先頭に向かって検索
        for (let j = cols.length - 1; j >= 0; j--) {
          const val = parseFloat(cols[j]);
          // WBGTの有効数値範囲（0〜50℃、10倍値の500未満、欠測値-999等の除外）
          if (!isNaN(val) && val > 0 && val < 500) {
            extractedWbgt = val > 50 ? val / 10 : val;
            break;
          }
        }
        if (extractedWbgt !== null) break;
      }

      if (extractedWbgt !== null) {
        // 小数第1位に四捨五入（環境省サイト表示と統一）
        const roundedWbgt = Math.round(extractedWbgt * 10) / 10;
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
      error: `地点(${pointId})の暑さ指数を取得できませんでした`,
      detail: lastErrorDetail,
    },
    { status: lastStatus }
  );
}
