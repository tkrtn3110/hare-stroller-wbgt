import { NextRequest, NextResponse } from 'next/server';

// 地域コード（例: 長野＝48141 など、lib/locationsData.ts の設定に合わせる）
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const areaCode = searchParams.get('area') || '48141'; // デフォルト長野

  try {
    // 環境省の最新データ取得用URL
    // ※環境省の形式: https://www.wbgt.env.go.jp/data/csv/wbgt_<地点コード>_<YYYYMMDD>.csv 
    // またはリアルタイム値取得URL
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const url = `https://www.wbgt.env.go.jp/data/csv/wbgt_${areaCode}_${today}.csv`;

    const res = await fetch(url, {
      next: { revalidate: 600 }, // 10分キャッシュ
      headers: {
        'User-Agent': 'Mozilla/5.0',
      },
    });

    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }

    // Shift_JIS でデコード
    const arrayBuffer = await res.arrayBuffer();
    const decoder = new TextDecoder('shift-jis');
    const csvText = decoder.decode(arrayBuffer);

    // CSVのパース処理（最新の値を取り出す）
    const lines = csvText.trim().split('\n');
    const lastLine = lines[lines.length - 1];
    const columns = lastLine.split(',');
    
    // CSV内のWBGT値の列を指定（環境省CSVのフォーマットに従ってパース）
    // 例: WBGT値が整数で入っている場合（10倍された値の場合もあるため要除算）
    const rawWbgtValue = parseFloat(columns[columns.length - 1]); 
    const wbgt = rawWbgtValue > 100 ? rawWbgtValue / 10 : rawWbgtValue;

    return NextResponse.json({ wbgt, success: true });
  } catch (error) {
    console.error('WBGT fetch error:', error);
    return NextResponse.json(
      { error: '環境省サーバーからデータを取得できませんでした' },
      { status: 500 }
    );
  }
}