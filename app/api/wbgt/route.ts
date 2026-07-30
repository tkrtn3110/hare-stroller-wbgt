import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  let pointId = searchParams.get('pointId') || searchParams.get('area') || '48156';

  if (pointId === '14166') pointId = '14163'; // 札幌
  if (pointId === '48141') pointId = '48156'; // 長野

  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yyyymm = `${yyyy}${mm}`;

  let currentWbgt: number | null = null;
  let forecastList: { dateStr: string; time: string; wbgt: number }[] = [];

  try {
    // 1. 実況値データ (現在の数値)
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

    // 2. 予測値データ (3日間の全コマ)
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
        const headerCols = lines[0].split(',').map(c => c.trim());
        const dataCols = lines[1].split(',').map(c => c.trim());

        const dayNames = ['日', '月', '火', '水', '木', '金', '土'];

        for (let idx = 2; idx < headerCols.length && idx < dataCols.length; idx++) {
          const rawTime = headerCols[idx]; // 例: "2026073103"
          const rawVal = parseFloat(dataCols[idx]);

          if (rawTime && !isNaN(rawVal) && rawVal > 0) {
            let dateStr = '';
            let displayTime = '';

            if (rawTime.length >= 10) {
              const year = parseInt(rawTime.slice(0, 4), 10);
              const month = parseInt(rawTime.slice(4, 6), 10);
              const day = parseInt(rawTime.slice(6, 8), 10);
              const hourStr = rawTime.slice(8, 10);

              const d = new Date(year, month - 1, day);
              const dayName = dayNames[d.getDay()];

              dateStr = `${month}月${day}日(${dayName})`;
              displayTime = `${hourStr.padStart(2, '0')}:00`;
            } else {
              displayTime = `${rawTime.padStart(2, '0')}:00`;
            }

            const wbgtVal = rawVal >= 50 ? rawVal / 10 : rawVal;

            forecastList.push({
              dateStr,
              time: displayTime,
              wbgt: Math.round(wbgtVal * 10) / 10,
            });
          }
        }
      }
    }

    if (currentWbgt === null && forecastList.length > 0) {
      currentWbgt = forecastList[0].wbgt;
    }

    if (currentWbgt !== null) {
      const roundedWbgt = Math.round(currentWbgt * 10) / 10;
      return NextResponse.json({
        success: true,
        pointId,
        wbgt: roundedWbgt,
        forecast: forecastList, // 3日分（全件）を返す
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
