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
  const currentHour = now.getHours();

  const yyyymm = `${yyyy}${mm}`;

  let currentWbgt: number | null = null;
  let forecastList: { time: string; wbgt: number }[] = [];

  try {
    // -------------------------------------------------------------
    // 1. 現在の暑さ指数（実況値データ: est15WG）の取得
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
    // 2. これからのWBGT予報（予測値データ: prev15WG）の取得
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

      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map(c => c.trim());
        if (cols.length >= 2) {
          // 日時情報の取得 (例: "2026/07/30 21:00" や "21:00" や "21")
          const timeCol = cols[1] || cols[0] || '';
          let val = parseFloat(cols[cols.length - 1]);

          // WBGT数値のバリデーション
          if (!isNaN(val) && val > 0) {
            if (val >= 50) val = val / 10;
            val = Math.round(val * 10) / 10;

            // 時間のパース（21:00など）
            let hourNum = -1;
            let displayTime = '';

            if (timeCol.includes(':')) {
              const parts = timeCol.split(' ');
              const timePart = parts[parts.length - 1]; // "21:00"
              displayTime = timePart;
              hourNum = parseInt(timePart.split(':')[0], 10);
            } else {
              const parsed = parseInt(timeCol, 10);
              if (!isNaN(parsed) && parsed >= 0 && parsed <= 24) {
                hourNum = parsed;
                displayTime = `${String(parsed).padStart(2, '0')}:00`;
              }
            }

            // 今より未来の時間帯、または明日の時間帯のみ予報にセット
            if (displayTime && hourNum !== -1) {
              forecastList.push({
                time: displayTime,
                wbgt: val,
              });
            }
          }
        }
      }

      // 重複を除外して未来のデータだけに絞り込み
      const seenTimes = new Set();
      forecastList = forecastList.filter(item => {
        if (seenTimes.has(item.time)) return false;
        seenTimes.add(item.time);
        return true;
      });
    }

    // 予報から現在値のバックアップ（実況値取得失敗時）
    if (currentWbgt === null && forecastList.length > 0) {
      currentWbgt = forecastList[0].wbgt;
    }

    if (currentWbgt !== null) {
      const roundedWbgt = Math.round(currentWbgt * 10) / 10;
      return NextResponse.json({
        success: true,
        pointId,
        wbgt: roundedWbgt,
        // これからの時間（21:00, 24:00, 03:00 ...）直近6コマを返却
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
      const seenTimes = new Set();
      forecastList = forecastList.filter(item => {
        if (seenTimes.has(item.time)) return false;
        seenTimes.add(item.time);
        return true;
      });
    }

    // 予報から現在値のバックアップ（実況値取得失敗時）
    if (currentWbgt === null && forecastList.length > 0) {
      currentWbgt = forecastList[0].wbgt;
    }

    if (currentWbgt !== null) {
      const roundedWbgt = Math.round(currentWbgt * 10) / 10;
      return NextResponse.json({
        success: true,
        pointId,
        wbgt: roundedWbgt,
        // これからの時間（21:00, 24:00, 03:00 ...）直近6コマを返却
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
