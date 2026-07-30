import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  let pointId = searchParams.get('pointId') || searchParams.get('area') || '48156';

  // 地点ID補正
  if (pointId === '14166') pointId = '14163'; // 札幌
  if (pointId === '48141') pointId = '48156'; // 長野

  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yyyymm = `${yyyy}${mm}`;

  // 公式マニュアル記載の個別地点データファイルURL
  const urlsToTry = [
    `https://www.wbgt.env.go.jp/est15WG/dl/wbgt_${pointId}_${yyyymm}.csv`, // 実況値
    `https://www.wbgt.env.go.jp/prev15WG/dl/yohou_${pointId}.csv`,        // 予測値
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

      let extractedWbgt: number | null = null;

      // --- 厳密なWBGT数値の抽出ロジック ---
      // 実況値CSVは「年,月,日,時,...」と並ぶため、日付・時刻（例: 24）を誤判定しないよう制御
      for (let i = lines.length - 1; i >= 1; i--) {
        const cols = lines[i].split(',').map(c => c.trim());
        
        // 1行にデータが複数ある場合、日付・時間カラム（先頭1〜4列）を回避してデータ列を調べる
        // 通常、環境省CSVのWBGT数値（10倍値: 191など）は最後の列（または後半列）に入っています
        for (let j = cols.length - 1; j >= Math.min(3, cols.length - 1); j--) {
          const val = parseFloat(cols[j]);

          // WBGT数値の判定ルール:
          // 1. 10倍値表記の場合 (191 -> 19.1)
          if (!isNaN(val) && val >= 50 && val <= 400) {
            extractedWbgt = val / 10;
            break;
          }
          // 2. 小数表記の場合 (19.1)
          if (!isNaN(val) && val > 5.0 && val < 40.0) {
            extractedWbgt = val;
            break;
          }
        }

        if (extractedWbgt !== null) break;
      }

      if (extractedWbgt !== null) {
        // 小数第1位に丸める（札幌本家19.1 -> 19.1℃）
        const roundedWbgt = Math.round(extractedWbgt * 10) / 10;
        return NextResponse.json({
          success: true,
          pointId,
          wbgt: roundedWbgt,
          sourceUrl: url,
        });
      } else {
        lastErrorDetail = 'WBGT数値カラムが見つかりませんでした';
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


