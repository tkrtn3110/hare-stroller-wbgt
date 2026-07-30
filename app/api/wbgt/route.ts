// app/api/wbgt/route.ts
import { NextResponse } from 'next/server';

export type HourlyWbgtData = {
  time: string; // 例: "09:00"
  wbgt: number;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const pointId = searchParams.get('pointId') || '48141'; // 長野市

  const csvUrl = `https://www.wbgt.env.go.jp/prev15v/data/forecast/wbgt_${pointId}.csv`;

  try {
    const response = await fetch(csvUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      next: { revalidate: 3600 },
    });

    if (!response.ok) throw new Error('Failed to fetch from ENV');

    const csvText = await response.text();
    const lines = csvText.trim().split('\n');

    const hourlyList: HourlyWbgtData[] = [];
    let latestWbgt = 25.0;

    // CSVのデータをパース
    for (let i = 1; i < lines.length; i++) {
      const row = lines[i].split(',').map((item) => item.trim());
      if (row.length >= 3) {
        const timeStr = row[1] || ''; // 例: "09:00" または "9"
        let val = parseFloat(row[2]);

        if (!isNaN(val)) {
          if (val > 100) val = val / 10;
          latestWbgt = val; // 直近の値を保持

          // 時間の表記を "09:00" 形式に整形
          const formattedTime = timeStr.includes(':') 
            ? timeStr 
            : `${timeStr.padStart(2, '0')}:00`;

          hourlyList.push({
            time: formattedTime,
            wbgt: val,
          });
        }
      }
    }

    // 直近6〜8コマ分（本日の主要な時間帯）を抽出
    const forecastList = hourlyList.slice(-8);

    return NextResponse.json({
      success: true,
      pointId,
      wbgt: latestWbgt,
      forecast: forecastList,
    });
  } catch (error) {
    // データ取得失敗時のダミー予報データ
    const dummyForecast: HourlyWbgtData[] = [
      { time: '09:00', wbgt: 24.0 },
      { time: '12:00', wbgt: 27.5 },
      { time: '15:00', wbgt: 26.0 },
      { time: '18:00', wbgt: 22.5 },
    ];

    return NextResponse.json({
      success: false,
      wbgt: 26.0,
      forecast: dummyForecast,
    });
  }
}