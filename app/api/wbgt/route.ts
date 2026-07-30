// app/api/wbgt/route.ts
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  // 地点コード（指定がなければ長野市: 48141）
  const pointId = searchParams.get('pointId') || '48141';

  // 環境省のWBGT予測CSVのURL
  const csvUrl = `https://www.wbgt.env.go.jp/prev15v/data/forecast/wbgt_${pointId}.csv`;

  try {
    const response = await fetch(csvUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
      },
      // 1時間ごとに最新データをキャッシュ・再取得
      next: { revalidate: 3600 },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch from ENV');
    }

    const csvText = await response.text();
    const lines = csvText.trim().split('\n');

    // 直近（現在時間帯）の数値を取り出す簡易パース処理
    let latestWbgt = 25.0; // フォールバック値

    // CSVの末尾付近から有効なデータ行を探索
    for (let i = lines.length - 1; i >= 0; i--) {
      const row = lines[i].split(',').map((item) => item.trim());
      if (row.length >= 3) {
        let val = parseFloat(row[2]);
        if (!isNaN(val)) {
          // CSV内の値が10倍表記（例: 265 = 26.5℃）の場合の変換
          if (val > 100) val = val / 10;
          latestWbgt = val;
          break;
        }
      }
    }

    return NextResponse.json({
      success: true,
      pointId,
      wbgt: latestWbgt,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    // データ取得失敗時は安全のためデフォルト値を返す
    return NextResponse.json({
      success: false,
      pointId,
      wbgt: 26.0,
      error: '環境省データの取得に失敗したため、推定値を表示しています。',
    });
  }
}