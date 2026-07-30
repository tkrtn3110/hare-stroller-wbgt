import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const pointId = searchParams.get('pointId') || searchParams.get('area') || '48156';

  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');

  const yyyymm = `${yyyy}${mm}`;
  const todayStr = `${yyyy}${mm}${dd}`;

  const urlsToTry = [
    `https://www.wbgt.env.go.jp/prev15WG/dl/yohou_${pointId}.csv`,
    `https://www.wbgt.env.go.jp/est15WG/dl/wbgt_${pointId}_${yyyymm}.csv`,
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
        lastErrorDetail = `HTTP ${res.status} from ${url}`;
        continue;
      }

      const arrayBuffer = await res.arrayBuffer();
      const decoder = new TextDecoder('shift-jis');
      const csvText = decoder.decode(arrayBuffer);

      const lines = csvText.trim().split(/\r?\n/).filter(line => line.trim() !== '');

      if (lines.length < 2) continue;

      let matchedWbgt: number | null = null;

      // --- 現在時刻に最も近いデータをピンポイント検索 ---
      // 例: "2026/07/30 18:00" または "2026073018" 等のパターンに対応
      const targetTimePattern = `${yyyy}/${mm}/${dd} ${hh}`;
      const targetDatePattern = `${todayStr}${hh}`;

      // 1. まず現在の「日付＋時間」にマッチする行を探す
      for (let i = lines.length - 1; i >= 1; i--) {
        const line = lines[i];
        if (line.includes(targetTimePattern) || line.includes(targetDatePattern) || line.includes(`${dd}日${hh}時`)) {
          const cols = line.split(',').map(c => c.trim());
          for (let j = cols.length - 1; j >= 0; j--) {
            const val = parseFloat(cols[j]);
            if (!isNaN(val) && val > 0 && val < 500) {
              matchedWbgt = val > 50 ? val / 10 : val;
              break;
            }
          }
          if (matchedWbgt !== null) break;
        }
      }

      // 2. ピンポイント一致がなければ、直近（本日中）の最新有効値を末尾から検索
      if (matchedWbgt === null) {
        for (let i = lines.length - 1; i >= 1; i--) {
          const cols = lines[i].split(',').map(c => c.trim());
          // 日付指定（今日の日付が含まれているか）
          if (lines[i].includes(todayStr) || lines[i].includes(`${yyyy}/${mm}/${dd}`)) {
            for (let j = cols.length - 1; j >= 0; j--) {
              const val = parseFloat(cols[j]);
              if (!isNaN(val) && val > 0 && val < 500) {
                matchedWbgt = val > 50 ? val / 10 : val;
                break;
              }
            }
            if (matchedWbgt !== null) break;
          }
        }
      }

      if (matchedWbgt !== null) {
        // 小数点第1位に丸める（25.6℃など）
        const roundedWbgt = Math.round(matchedWbgt * 10) / 10;
        return NextResponse.json({
          success: true,
          pointId,
          wbgt: roundedWbgt,
          sourceUrl: url,
        });
      }

    } catch (err: any) {
      lastErrorDetail = err.message || 'Fetch error';
    }
  }

  return NextResponse.json(
    {
      success: false,
      error: '最新時間の暑さ指数を取得できませんでした',
      detail: lastErrorDetail,
    },
    { status: lastStatus }
  );
}
