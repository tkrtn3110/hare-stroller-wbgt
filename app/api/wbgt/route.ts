import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  // デフォルト: 長野地方気象台 (48156)
  const pointId = searchParams.get('pointId') || searchParams.get('area') || '48156';

  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yyyymm = `${yyyy}${mm}`;

  // 環境省データ提供サービス公式マニュアル準拠のURL優先リスト
  const urlsToTry = [
    // (1-A) 地点別 暑さ指数(WBGT)予測値データファイル (最優先)
    `https://www.wbgt.env.go.jp/prev15WG/dl/yohou_${pointId}.csv`,
    
    // (2-A) 地点別 暑さ指数(WBGT)実況値データファイル
    `https://www.wbgt.env.go.jp/est15WG/dl/wbgt_${pointId}_${yyyymm}.csv`,
    
    // (1-C) 全地点 予測値データファイル
    `https://www.wbgt.env.go.jp/prev15WG/dl/yohou_all.csv`,

    // (2-C) 全地点 実況値データファイル
    `https://www.wbgt.env.go.jp/est15WG/dl/wbgt_all_${yyyymm}.csv`,
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

      // Shift_JIS でデコード
      const arrayBuffer = await res.arrayBuffer();
      const decoder = new TextDecoder('shift-jis');
      const csvText = decoder.decode(arrayBuffer);

      const lines = csvText.trim().split(/\r?\n/).filter(line => line.trim() !== '');

      if (lines.length < 2) {
        lastErrorDetail = 'CSVデータが空です';
        continue;
      }

      let parsedWbgt: number | null = null;

      // 全地点ファイル (yohou_all / wbgt_all) の場合
      if (url.includes('_all')) {
        const targetLine = lines.find(line => line.startsWith(pointId) || line.includes(pointId));
        if (targetLine) {
          const cols = targetLine.split(',').map(c => c.trim());
          for (let j = cols.length - 1; j >= 1; j--) {
            const val = parseFloat(cols[j]);
            if (!isNaN(val) && val > 0 && val < 500) {
              parsedWbgt = val > 50 ? val / 10 : val;
              break;
            }
          }
        }
      } else {
        // 地点個別ファイル (yohou_48156.csv 等) の場合
        for (let i = lines.length - 1; i >= 1; i--) {
          const cols = lines[i].split(',').map(c => c.trim());
          for (let j = cols.length - 1; j >= 0; j--) {
            const val = parseFloat(cols[j]);
            // 欠測値（-999等）を除外して正常な数値を取得
            if (!isNaN(val) && val > 0 && val < 500) {
              parsedWbgt = val > 50 ? val / 10 : val;
              break;
            }
          }
          if (parsedWbgt !== null) break;
        }
      }

      if (parsedWbgt !== null) {
        return NextResponse.json({
          success: true,
          pointId,
          wbgt: parsedWbgt,
          sourceUrl: url,
        });
      } else {
        lastErrorDetail = '有効な数値データを取得できませんでした';
      }

    } catch (err: any) {
      lastErrorDetail = err.message || 'Fetch error';
    }
  }

  return NextResponse.json(
    {
      success: false,
      error: '環境省サーバーからデータを取得できませんでした',
      detail: lastErrorDetail,
    },
    { status: lastStatus === 404 ? 404 : 502 }
  );
}
