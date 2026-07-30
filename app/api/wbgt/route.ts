// app/api/wbgt/route.ts
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  // 地点コードを取得（デフォルトは長野市 48141）
  const pointId = searchParams.get('pointId') || '48141';

  // 環境省の地点別CSV URL
  const csvUrl = `https://www.wbgt.env.go.jp/prev15v/data/forecast/wbgt_${pointId}.csv`;

  try {
    const response = await fetch(csvUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      cache: 'no-store', // 確実に最新の地点データを取得
    });

    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status}`);
    }

    const csvText = await response.text();
    const lines = csvText.trim().split('\n');

    const hourlyList: { time: string; wbgt: number }[] = [];
    let latestWbgt = 25.0;

    // CSVの行を解析（ヘッダー行をスキップ）
    for (let i = 1; i < lines.length; i++) {
      const row = lines[i].split(',').map((item) => item.trim());
      if (row.length >= 3) {
        const timeStr = row[1] || '';
        let val = parseFloat(row[2]);

        if (!isNaN(val)) {
          // 10倍表記の変換（例: 265 -> 26.5）
          if (val > 100) val = val / 10;
          latestWbgt = val;

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

    // 最新の8コマ（時間帯）を取得
    const forecastList = hourlyList.length > 0 ? hourlyList.slice(-8) : [];

    return NextResponse.json({
      success: true,
      pointId,
      wbgt: latestWbgt,
      forecast: forecastList,
    });
  } catch (error) {
    console.error(`WBGT Fetch Error for point ${pointId}:`, error);

    // エラー時のフォールバック（地点ごとに数値を変えて見分けやすくする）
    const offset = parseInt(pointId, 10) % 3; // 地点IDに応じたわずかな差分
    const fallbackWbgt = 24.0 + offset;

    return NextResponse.json({
      success: false,
      pointId,
      wbgt: fallbackWbgt,
      forecast: [
        { time: '09:00', wbgt: fallbackWbgt - 1 },
        { time: '12:00', wbgt: fallbackWbgt + 2 },
        { time: '15:00', wbgt: fallbackWbgt + 1 },
        { time: '18:00', wbgt: fallbackWbgt - 2 },
      ],
      error: '環境省データの取得に失敗しました',
    });
  }
}