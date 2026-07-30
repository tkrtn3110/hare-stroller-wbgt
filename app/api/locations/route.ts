// app/api/locations/route.ts
import { NextResponse } from 'next/server';

export type LocationMaster = {
  id: string;
  name: string;
};

// 全国主要地点マスター
const ALL_LOCATIONS: LocationMaster[] = [
  // 北海道
  { id: '14163', name: '札幌' },
  { id: '11001', name: '稚内' },
  { id: '12011', name: '旭川' },
  { id: '13031', name: '網走' },
  { id: '17021', name: '釧路' },
  { id: '18011', name: '帯広' },
  { id: '15011', name: '室蘭' },
  { id: '16011', name: '函館' },

  // 東北
  { id: '21031', name: '青森' },
  { id: '33011', name: '盛岡' },
  { id: '34396', name: '仙台' },
  { id: '32011', name: '秋田' },
  { id: '35011', name: '山形' },
  { id: '36011', name: '福島' },

  // 関東
  { id: '44132', name: '東京' },
  { id: '44071', name: '練馬' },
  { id: '44056', name: '八王子' },
  { id: '46091', name: '横浜' },
  { id: '43056', name: 'さいたま' },
  { id: '45106', name: '千葉' },
  { id: '40011', name: '水戸' },
  { id: '41011', name: '宇都宮' },
  { id: '42011', name: '前橋' },

  // 北陸・甲信越
  { id: '48156', name: '長野' },
  { id: '48206', name: '松本' },
  { id: '48056', name: '飯山' },
  { id: '48171', name: '上田' },
  { id: '48241', name: '諏訪' },
  { id: '48301', name: '伊那' },
  { id: '48361', name: '飯田' },
  { id: '48220', name: '軽井沢' },
  { id: '55111', name: '富山' },
  { id: '55201', name: '高岡' },
  { id: '56111', name: '金沢' },
  { id: '57106', name: '福井' },
  { id: '54231', name: '新潟' },
  { id: '49126', name: '甲府' },

  // 東海・近畿
  { id: '51106', name: '名古屋' },
  { id: '53011', name: '岐阜' },
  { id: '50011', name: '静岡' },
  { id: '52011', name: '津' },
  { id: '62078', name: '大阪' },
  { id: '61286', name: '京都' },
  { id: '63086', name: '神戸' },
  { id: '64011', name: '奈良' },
  { id: '65011', name: '和歌山' },
  { id: '60011', name: '大津' },

  // 中国・四国
  { id: '67011', name: '鳥取' },
  { id: '68011', name: '松江' },
  { id: '66011', name: '岡山' },
  { id: '67011', name: '広島' },
  { id: '81011', name: '山口' },
  { id: '71011', name: '徳島' },
  { id: '72011', name: '高松' },
  { id: '73011', name: '松山' },
  { id: '74011', name: '高知' },

  // 九州・沖縄
  { id: '82056', name: '福岡' },
  { id: '85011', name: '佐賀' },
  { id: '84011', name: '長崎' },
  { id: '86011', name: '熊本' },
  { id: '83011', name: '大分' },
  { id: '87011', name: '宮崎' },
  { id: '88011', name: '鹿児島' },
  { id: '91011', name: '那覇' },
];

export async function GET() {
  return NextResponse.json({
    success: true,
    locations: ALL_LOCATIONS,
  });
}
