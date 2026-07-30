// app/api/wbgt/route.ts
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  let pointId = searchParams.get('pointId') || '48141';

  if (pointId === '14166') pointId = '14163';

  // 環境省の地点別データ取得URL (全地点対応のエンドポイント)
  // 予報CSV: https://www.wbgt.env.go.jp/prev15v/dl/csv/wbgt_all_latest.csv などのフォールバックを含める
  const primaryUrl = `https://www.wbgt.env.go.jp/prev15v/data/forecast/wbgt_${pointId}.csv`;
  const estimateUrl = `https://www.wbgt.env.go.jp/est15v/data/estimate/wbgt_${pointId}.csv`;

  try {
    let res = await fetch(primaryUrl, { cache: 'no-store' });

    // 予報CSVが404の場合は推計値(est15v)CSVを試す
    if (!res.ok) {
      res = await fetch(estimateUrl, { cache: 'no-store' });
    }

    if (!res.ok) {
      return NextResponse.json(
        { success: false, error: `地点データが見つかりません (ID: ${pointId})` },
        { status: 404 }
      );
    }

    const csvText = await res.text();
    const lines = csvText.trim().split(/\r?\n/);

    const hourlyList: { time: string; wbgt: number }[] = [];
    let latestWbgt: number | null = null;

    for (let i = 1; i < lines.length; i++) {
      const row = lines[i].split(',').map((item) => item.trim());
      if (row.length >= 3) {
        const rawTime = row[1] || '';
        let val = parseFloat(row[2]);

        if (!isNaN(val)) {
          if (val > 100) val = val / 10;
          latestWbgt = val;

          const formattedTime = rawTime.includes(':')
            ? rawTime
            : `${rawTime.padStart(2, '0')}:00`;

          hourlyList.push({
            time: formattedTime,
            wbgt: val,
          });
        }
      }
    }

    if (latestWbgt === null) {
      return NextResponse.json(
        { success: false, error: 'データ解析に失敗しました' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      pointId,
      wbgt: latestWbgt,
      forecast: hourlyList.slice(-8),
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Fetch failed' },
      { status: 500 }
    );
  }
}