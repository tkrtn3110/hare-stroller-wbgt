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
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');

  const yyyymm = `${yyyy}${mm}`;
  const todayStr = `${yyyy}${mm}${dd}`;

  let currentWbgt: number | null = null;
  let forecastList: { time: string; wbgt: number }[] = [];

  try {
    // 1. 実況値データ (現在の数値用)
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

    // 2. 予測値データ (これからの時間帯予報リスト用)
    const prevUrl = `https://www.wbgt.env.go.jp/prev15WG/dl/yohou_${pointId}.csv`;
    const prevRes = await fetch(prevUrl, {
      cache: 'no-store',
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });

    if (prevRes.ok) {
      const arrayBuffer = await prevRes.arrayBuffer();
      const csvText = new TextDecoder('shift-jis').decode(arrayBuffer);
      const lines = csvText.trim().split(/\r?\n/).filter(line => line.trim() !== '');

      // 予測ファイルから未来の時間帯データを取り出す
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map(c => c.trim());
        if (cols.length >= 3) {
          // 日時カラム（例: "2026/07/31 09:00" や "09:00" や "9"）
          const rawTimeStr = cols[1] || cols[0] || '';
          let val = parseFloat(cols[cols.length - 1] || cols[2]);

          if (!isNaN(val) && val > 0) {
            if (val >= 50) val = val / 10;
            val = Math.round(val * 10) / 10;

            // 時刻表記の整形 (例: "12:00" や "15:00")
            let formattedTime = rawTimeStr;
            if (rawTimeStr.includes(' ')) {
              formattedTime = rawTimeStr.split(' ')[1];
            } else if (!rawTimeStr.includes(':') && !isNaN(parseInt(rawTimeStr))) {
              formattedTime = `${rawTimeStr.padStart(2, '0')}:00`;
            }

            forecastList.push({
              time: formattedTime,
              wbgt: val,
            });
          }
        }
      }

      // 予報ファイルから現在数値のバックアップ補充（実況値が取れなかった場合）
      if (currentWbgt === null && forecastList.length > 0) {
        currentWbgt = forecastList[0].wbgt;
      }
    }

    if (currentWbgt !== null) {
      const roundedWbgt = Math.round(currentWbgt * 10) / 10;
      return NextResponse.json({
        success: true,
        pointId,
        wbgt: roundedWbgt,
        // 直近〜未来の8コマ（24時間分）を返す
        forecast: forecastList.slice(0, 8),
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
