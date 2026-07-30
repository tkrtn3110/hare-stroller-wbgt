import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  // クエリパラメータから pointId または area を取得（デフォルト: 48141 長野）
  const pointId = searchParams.get('pointId') || searchParams.get('area') || '48141';

  try {
    // 環境省の実測・予測CSVデータURL構造
    // 形式: https://www.wbgt.env.go.jp/prev15v/dl/csv/wbgt_<地点5桁コード>_<YYYYMM>.csv
    // または全地点データなどの配信エンドポイント
    
    // 現在年月（YYYYMM）を取得
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const yyyymm = `${year}${month}`;

    // 環境省の標準的な月別地点CSVデータURL
    const url = `https://www.wbgt.env.go.jp/prev15v/dl/csv/wbgt_${pointId}_${yyyymm}.csv`;

    const res = await fetch(url, {
      next: { revalidate: 600 }, // 10分キャッシュ
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      },
    });

    if (!res.ok) {
      // フォールバック: 月別ファイルが存在しない場合等の予備URL
      const fallbackUrl = `https://www.wbgt.env.go.jp/prev15v/dl/csv/wbgt_${pointId}.csv`;
      const fallbackRes = await fetch(fallbackUrl, {
        next: { revalidate: 600 },
        headers: { 'User-Agent': 'Mozilla/5.0' },
      });

      if (!fallbackRes.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      
      return await parseAndReturnCsv(fallbackRes);
    }

    return await parseAndReturnCsv(res);

  } catch (error) {
    console.error('WBGT fetch error:', error);
    return NextResponse.json(
      { error: '環境省サーバーからデータを取得できませんでした' },
      { status: 500 }
    );
  }
}

// CSVパース共通処理
async function parseAndReturnCsv(res: Response) {
  const arrayBuffer = await res.arrayBuffer();
  const decoder = new TextDecoder('shift-jis');
  const csvText = decoder.decode(arrayBuffer);

  const lines = csvText.trim().split('\n').filter(line => line.trim() !== '');
  
  // CSVの末尾付近（最新の日時データ）を取り出す
  // 通常、環境省CSVはヘッダー以降に「日付,時間,WBGT値...」が並びます
  const lastLine = lines[lines.length - 1];
  const columns = lastLine.split(',');

  // WBGT値が含まれるカラム（末尾数値または指定列）を取得
  // 例: 数値が10倍値（285 → 28.5℃）で格納されている場合の考慮
  let rawValue = parseFloat(columns[columns.length - 1] || columns[2]);
  if (isNaN(rawValue)) {
    rawValue = parseFloat(columns[columns.length - 2]);
  }

  const wbgt = rawValue > 100 ? rawValue / 10 : rawValue;

  return NextResponse.json({ wbgt, success: true });
}