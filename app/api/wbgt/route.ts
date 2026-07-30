import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  let pointId = searchParams.get('pointId') || '48141';

  // 旧札幌IDなどの相互互換処理
  if (pointId === '14166') pointId = '14163';

  // 全地点まとめデータURL（予報）およびフォールバック（推計）
  const primaryUrl = 'https://www.wbgt.env.go.jp/prev15v/dl/csv/wbgt_all_latest.csv';
  const estimateUrl = 'https://www.wbgt.env.go.jp/est15v/dl/csv/wbgt_all_latest.csv';

  try {
    let res = await fetch(primaryUrl, { cache: 'no-store' });

    if (!res.ok) {
      res = await fetch(estimateUrl, { cache: 'no-store' });
    }

    if (!res.ok) {
      return NextResponse.json(
        { success: false, error: '環境省サーバーからデータを取得できませんでした' },
        { status: 502 }
      );
    }

    // Shift_JIS からテキスト変換（環境省CSVはSJISのケースが多いためDecode）
    const arrayBuffer = await res.arrayBuffer();
    const decoder = new TextDecoder('shift-jis');
    const csvText = decoder.decode(arrayBuffer);

    const lines = csvText.trim().split(/\r?\n/);
    if (lines.length < 2) {
      return NextResponse.json(
        { success: false, error: 'データが空です' },
        { status: 500 }
      );
    }

    // ヘッダー行から時間のリストを取得 (例: [ "地点コード", "地点名", "2026/07/30 00:00", ... ])
    const headers = lines[0].split(',').map((item) => item.trim());

    // 指定された pointId の行を検索
    let targetRow: string[] | null = null;
    for (let i = 1; i < lines.length; i++) {
      const row = lines[i].split(',').map((item) => item.trim());
      if (row[0] === pointId) {
        targetRow = row;
        break;
      }
    }

    // もし一括データで見つからない場合、個別のフォールバックURLを試す
    if (!targetRow) {
      const fallbackUrl = `https://www.wbgt.env.go.jp/prev15v/data/forecast/wbgt_${pointId}.csv`;
      const fallbackRes = await fetch(fallbackUrl, { cache: 'no-store' });
      if (!fallbackRes.ok) {
        return NextResponse.json(
          { success: false, error: `地点データが見つかりません (ID: ${pointId})` },
          { status: 404 }
        );
      }
      
      const text = await fallbackRes.text();
      const fallbackLines = text.trim().split(/\r?\n/);
      const hourlyList: { time: string; wbgt: number }[] = [];
      let latestWbgt: number | null = null;

      for (let i = 1; i < fallbackLines.length; i++) {
        const row = fallbackLines[i].split(',').map((item) => item.trim());
        if (row.length >= 3) {
          let val = parseFloat(row[2]);
          if (!isNaN(val)) {
            if (val > 100) val = val / 10;
            latestWbgt = val;
            const rawTime = row[1] || '';
            const formattedTime = rawTime.includes(':') ? rawTime : `${rawTime.padStart(2, '0')}:00`;
            hourlyList.push({ time: formattedTime, wbgt: val });
          }
        }
      }

      if (latestWbgt === null) {
        return NextResponse.json({ success: false, error: '解析失敗' }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        pointId,
        wbgt: latestWbgt,
        forecast: hourlyList.slice(-8),
      });
    }

    // 一括データからの時間別抽出処理
    const hourlyList: { time: string; wbgt: number }[] = [];
    let latestWbgt: number | null = null;

    for (let col = 2; col < headers.length; col++) {
      const rawVal = targetRow[col];
      if (!rawVal) continue;

      let val = parseFloat(rawVal);
      if (!isNaN(val)) {
        if (val > 100) val = val / 10; // 10倍値対策
        latestWbgt = val;

        // 日時フォーマットの整形 (例: "2026/07/30 15:00" -> "15:00")
        const dateTimeStr = headers[col] || '';
        const timePart = dateTimeStr.includes(' ') ? dateTimeStr.split(' ')[1] : dateTimeStr;

        hourlyList.push({
          time: timePart,
          wbgt: val,
        });
      }
    }

    if (latestWbgt === null) {
      return NextResponse.json(
        { success: false, error: '該当地点の数値データがありません' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      pointId,
      wbgt: latestWbgt,
      forecast: hourlyList.slice(-8), // 直近・未来の8コマ分を返却
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Fetch failed' },
      { status: 500 }
    );
  }
}