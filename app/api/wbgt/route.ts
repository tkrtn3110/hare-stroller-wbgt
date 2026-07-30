// app/api/wbgt/route.ts
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  let pointId = searchParams.get('pointId') || '48141';

  if (pointId === '14166') pointId = '14163';

  const csvUrl = `https://www.wbgt.env.go.jp/prev15v/data/forecast/wbgt_${pointId}.csv`;

  try {
    const response = await fetch(csvUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      cache: 'no-store',
    });

    if (!response.ok) throw new Error(`HTTP Status ${response.status}`);

    const csvText = await response.text();
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

    if (latestWbgt === null) throw new Error('No valid WBGT values');

    return NextResponse.json({
      success: true,
      pointId,
      wbgt: latestWbgt,
      forecast: hourlyList.slice(-8),
    });
  } catch (error) {
    console.error(`Fetch error for point ${pointId}:`, error);

    // ダミーデータを排出し、失敗状態だけを返す
    return NextResponse.json({
      success: false,
      pointId,
      wbgt: null,
      forecast: [],
      error: 'データの取得に失敗しました',
    });
  }
}