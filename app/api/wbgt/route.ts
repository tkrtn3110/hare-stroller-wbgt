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

  let currentWbgt: number | null = null;
  let forecastList: { time: string; wbgt: number }[] = [];

  try {
    // -------------------------------------------------------------
    // 1. 現在の暑さ指数（実況値: est15WG）の取得
    // -------------------------------------------------------------
    const estUrl = `https://www.wbgt.env.go.jp/est15WG/dl/wbgt_${pointId}_${yyyymm}.csv`;
    const estRes = await fetch(estUrl, {
      cache: 'no-store',
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });

    if (estRes.ok) {
      const arrayBuffer = await estRes.arrayBuffer();
      const csvText = new TextDecoder('shift-jis').decode(arrayBuffer);
      const lines = csvText.trim().split(/\r?\n/).filter(line => line.trim() !== '');

      for (let i = lines.length - 1; i >= 1; i--) {
        const cols = lines[i].split(',').map(c => c.trim());
        for (let j = cols.length - 1; j >= Math.min(3, cols.length - 1); j--) {
          const val = parseFloat(cols[j]);
          if (!isNaN(val) && val >= 50 && val <= 400) {
            currentWbgt = val / 10;
            break;
          }
          if (!isNaN(val) && val > 5.0 && val < 40.0) {
            currentWbgt = val;
            break;
          }
        }
        if (currentWbgt !== null) break;
      }
    }

    // -------------------------------------------------------------
    // 2. 3時間ごとの暑さ指数予報（予測値: prev15WG）の解析
    // -------------------------------------------------------------
    const prevUrl = `https://www.wbgt.env.go.jp/prev15WG/dl/yohou_${pointId}.csv`;
    const prevRes = await fetch(prevUrl, {
      cache: 'no-store',
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });

    if (prevRes.ok) {
      const arrayBuffer = await prevRes.arrayBuffer();
      const csvText = new TextDecoder('shift-jis').decode(arrayBuffer);
      const lines = csvText.trim().split(/\r?\n/).filter(line => line.trim() !== '');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const cols = line.split(',').map(c => c.trim());

        // 日時と数値が含まれている行を検索
        for (let j = 0; j < cols.length; j++) {
          const colStr = cols[j];

          // "21:00" や "2026/07/30 21:00" のような正時（00分）予報行をターゲットにする
          // (※19:25などの分が付いた更新タイムスタンプ行を除外)
          if (colStr.includes(':00') || colStr.endsWith('時') || (colStr.length <= 2 && !isNaN(parseInt(colStr)))) {
            // その行の末尾側からWBGT数値を抽出
            for (let k = cols.length - 1; k > j; k--) {
              let val = parseFloat(cols[k]);
              if (!isNaN(val) && val > 0 && val < 500) {
                if (val >= 50) val = val / 10;
                val = Math.round(val * 10) / 10;

                // 時間表示の整形 ("21:00")
                let displayTime = '';
                if (colStr.includes(':')) {
                  const parts = colStr.split(' ');
                  displayTime = parts[parts.length - 1]; // "21:00"
                } else {
                  const h = parseInt(colStr, 10);
                  if (!isNaN(h) && h >= 0 && h <= 24) {
                    displayTime = `${String(h).padStart(2, '0')}:00`;
                  }
                }

                if (displayTime && displayTime.endsWith(':00')) {
                  forecastList.push({
                    time: displayTime,
                    wbgt: val,
                  });
                }
                break;
              }
            }
            break;
          }
        }
      }

      // 重複する時間帯を除外（順序を維持）
      const seen = new Set<string>();
      forecastList = forecastList.filter(item => {
        if (seen.has(item.time)) return false;
        seen.add(item.time);
        return true;
      });
    }

    // バックアップ補完
    if (currentWbgt === null && forecastList.length > 0) {
      currentWbgt = forecastList[0].wbgt;
    }

    if (currentWbgt !== null) {
      const roundedWbgt = Math.round(currentWbgt * 10) / 10;
      return NextResponse.json({
        success: true,
        pointId,
        wbgt: roundedWbgt,
        // 未来の予報6コマ（21:00, 24:00, 03:00, 06:00...）を返却
        forecast: forecastList.slice(0, 6),
      });
    }

    return NextResponse.json(
      { success: false, error: '暑さ指数データを解析できませんでした' },
      { status: 404 }
    );

  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Fetch error' },
      { status: 500 }
    );
  }
}
