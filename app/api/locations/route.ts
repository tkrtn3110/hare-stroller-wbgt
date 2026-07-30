// app/api/locations/route.ts
import { NextResponse } from 'next/server';

export type LocationMaster = {
  id: string;      // 5桁の地点コード
  name: string;    // 地点名（例: 長野）
  pref: string;    // 都道府県名（例: 長野県）
  fullName: string;// 表示用（例: 長野県 長野）
};

export async function GET() {
  // 環境省の全国地点一覧ページ URL
  const masterUrl = 'https://www.wbgt.env.go.jp/wbgt_data.php';

  try {
    const response = await fetch(masterUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      },
      // 24時間キャッシュ（地点マスターは頻繁に変わらないため）
      next: { revalidate: 86400 },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch location master');
    }

    const html = await response.text();
    const locations: LocationMaster[] = [];

    // HTMLから地点コード (5桁) と地点名を抽出する正規表現パターン
    // 例: <a href="...?s=48141">長野</a>
    const regex = /s=(\d{5})">([^<]+)</g;
    let match;

    const seenIds = new Set<string>();

    while ((match = regex.exec(html)) !== null) {
      const id = match[1];
      const name = match[2].trim();

      if (!seenIds.has(id)) {
        seenIds.add(id);
        locations.push({
          id,
          name,
          pref: '', // 検索用にシンプルに保持
          fullName: name,
        });
      }
    }

    return NextResponse.json({
      success: true,
      count: locations.length,
      locations,
    });
  } catch (error) {
    console.error('Failed to parse location master:', error);

    // フォールバック（主要都市データ）
    const fallbackLocations: LocationMaster[] = [
      { id: '48141', name: '長野', pref: '長野県', fullName: '長野県 長野' },
      { id: '48206', name: '松本', pref: '長野県', fullName: '長野県 松本' },
      { id: '14163', name: '札幌', pref: '北海道', fullName: '北海道 札幌' },
      { id: '62078', name: '大阪', pref: '大阪府', fullName: '大阪府 大阪' },
      { id: '44132', name: '東京', pref: '東京都', fullName: '東京都 東京' },
      { id: '55111', name: '富山', pref: '富山県', fullName: '富山県 富山' },
    ];

    return NextResponse.json({
      success: false,
      locations: fallbackLocations,
    });
  }
}