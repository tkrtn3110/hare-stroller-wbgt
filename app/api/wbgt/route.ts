import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  // 長野地方気象台 (48156) をデフォルト指定
  const pointId = searchParams.get('pointId') || searchParams.get('area') || '48156';

  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yyyymm = `${yyyy}${mm}`;

  // 令和8年マニュアル記載のデータ提供用エンドポイント（YYYYMM形式）
  const urlsToTry = [
    `https://www.wbgt.env.go.jp/prev15v/dl/csv/wbgt_${pointId}_${yyyymm}.csv`, // 予測値
    `https://www.wbgt.env.go.jp/est15v/dl/csv/wbgt_${pointId}_${yyyymm}.csv`,  // 実測値
    `https://www.wbgt.env.go.jp/prev15v/dl/csv/wbgt_${pointId}.csv`,          // 最新固定
  ];

  let lastStatus = 500;
  let lastErrorDetail = '';

  for (const url of urlsToTry) {
    try {
      const res = await fetch(url, {
        cache: 'no-store',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        },
      });

      if (!res.ok) {
        lastStatus = res.status;
        lastErrorDetail = `HTTP ${res.status} (${url})`;
        continue;
      }

      // Shift_JIS デコード処理
      const arrayBuffer = await res.arrayBuffer();
      const decoder = new TextDecoder('shift-jis');
      const csvText = decoder.decode(arrayBuffer);

      const lines = csvText.trim().split(/\r?\n/).filter(line => line.trim() !== '');

      if (lines.length < 2) {
        lastErrorDetail = 'CSVデータが空です';
        continue;
      }

      let latestWbgt: number | null = null;

      // CSVの末尾行から最新の有効な数値（欠測値 -999 等を除外）を探索
      for (let i = lines.length - 1; i >= 0; i--) {
        const cols = lines[i].split(',').map(c => c.trim());
        for (let j = cols.length - 1; j >= 0; j--) {
          const val = parseFloat(cols[j]);
          // 正常範囲内のWBGT値（-999などの欠測値を除外）
          if (!isNaN(val) && val > 0 && val < 500) {
            // マニュアル仕様: WBGT値は10倍値（例: 265 → 26.5℃）
            latestWbgt = val > 50 ? val / 10 : val;
            break;
          }
        }
        if (latestWbgt !== null) break;
      }

      if (latestWbgt !== null) {
        return NextResponse.json({
          success: true,
          pointId,
          wbgt: latestWbgt,
          sourceUrl: url,
        });
      } else {
        lastErrorDetail = '有効なWBGT数値が見つかりませんでした';
      }

    } catch (err: any) {
      lastErrorDetail = err.message || '通信エラー';
    }
  }

  // データ取得失敗時はマニュアル仕様のエラー内容をそのままレスポンス返却
  return NextResponse.json(
    {
      success: false,
      error: '環境省サーバーからデータを取得できませんでした',
      detail: lastErrorDetail,
    },
    { status: lastStatus === 404 ? 404 : 502 }
  );
}
