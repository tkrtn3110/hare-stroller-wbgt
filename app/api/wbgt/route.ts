// app/api/wbgt/route.ts
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  let pointId = searchParams.get('pointId') || '48141';

  // IDの安全補正
  if (pointId === '14166') pointId = '14163';

  // 環境省 WBGT 予測CSV
  const csvUrl = `https://www.wbgt.env.go.jp/prev15v/data/forecast/wbgt_${pointId}.csv`;

  try {
    const res = await fetch(csvUrl, {
      cache: 'no-store',
      headers: {
        'Accept': 'text/csv,text/plain,*/*',
      },
    });

    if (!res.ok) {
      return NextResponse.json(
        { success: false, error: `ENV HTTP Error: ${res.status}` },
        { status: 500 }
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
        { success: false, error: 'No valid WBGT values found in CSV' },
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