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
    // 2. 予測値（prev15WG）の解析（ヘッダー時間とデータ値を横持ちマッピング）
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

      if (lines.length >= 2) {
        // 0行目: 日時ヘッダー列 (例: '', '', '2026073021', '2026073024', ...)
        const headerCols = lines[0].split(',').map(c => c.trim());
        // 1行目: 数値データ列 (例: '48156', '2026/07/30 19:25', '240', '230', ...)
        const dataCols = lines[1].split(',').map(c => c.trim());

        // 3列目(インデックス2)から順に対応付けて抽出
        for (let idx = 2; idx < headerCols.length && idx < dataCols.length; idx++) {
          const rawTime = headerCols[idx];
          const rawVal = parseFloat(dataCols[idx]);

          if (rawTime && !isNaN(rawVal) && rawVal > 0) {
            // 例: "2026073021" -> 末尾2桁を取り出して "21:00"
            const hourStr = rawTime.length >= 10 ? rawTime.slice(8, 10) : rawTime;
            const displayTime = `${hourStr.padStart(2, '0')}:00`;

            const wbgtVal = rawVal >= 50 ? rawVal / 10 : rawVal;

            forecastList.push({
              time: displayTime,
              wbgt: Math.round(wbgtVal * 10) / 10,
            });
          }
        }
      }
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
        // 直近6コマ (21:00, 24:00, 03:00, 06:00, 09:00, 12:00) を返却
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
