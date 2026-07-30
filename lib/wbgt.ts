// src/lib/wbgt.ts

export type Transportation = 'stroller' | 'carrier' | 'walk';

export type SafetyAdvice = {
  level: 'safe' | 'caution' | 'warning' | 'danger' | 'forbidden';
  badgeColor: string;
  title: string;
  message: string;
  correctedWbgt: number;
};

// ベビーカー/抱っこ紐の補正値
export function getCorrection(transport: Transportation): number {
  if (transport === 'stroller') return 2.0; // 地面の照り返し+2.0℃
  if (transport === 'carrier') return 1.0;  // 密着熱+1.0℃
  return 0.0;
}

// 判定ロジック（生後日数＋補正WBGT）
export function getAdvice(ageInDays: number, rawWbgt: number, transport: Transportation): SafetyAdvice {
  const correction = getCorrection(transport);
  const wbgt = Math.round((rawWbgt + correction) * 10) / 10;

  if (ageInDays < 30) {
    return {
      level: 'forbidden',
      badgeColor: 'bg-purple-500',
      title: '外出見送り',
      message: '生後1ヶ月未満の時期は、長時間の外出を控え室内で過ごしましょう。',
      correctedWbgt: wbgt,
    };
  }

  if (wbgt < 21) {
    return {
      level: 'safe',
      badgeColor: 'bg-blue-500',
      title: '散歩OK（防寒に注意）',
      message: '快適なお散歩日和です。風にあたって冷えないよう服装で調整しましょう。',
      correctedWbgt: wbgt,
    };
  } else if (wbgt < 25) {
    return {
      level: 'safe',
      badgeColor: 'bg-green-500',
      title: '散歩OK（安心）',
      message: 'お散歩に最適な気候です。こまめな水分補給を心がけて楽しんでください！',
      correctedWbgt: wbgt,
    };
  } else if (wbgt < 28) {
    return {
      level: 'caution',
      badgeColor: 'bg-yellow-500',
      title: '注意（短時間で）',
      message: 'じんわり暑さを感じる環境です。日陰を選び、15分程度で切り上げましょう。',
      correctedWbgt: wbgt,
    };
  } else if (wbgt < 31) {
    return {
      level: 'warning',
      badgeColor: 'bg-orange-500',
      title: '厳重警戒（日中は避ける）',
      message: '日中は危険な暑さです。早朝や16時以降の涼しい時間帯に限定してください。',
      correctedWbgt: wbgt,
    };
  } else {
    return {
      level: 'danger',
      badgeColor: 'bg-red-600',
      title: '危険（原則外出禁止）',
      message: '赤ちゃんにとって大変危険な暑さです。本日の屋外のお散歩は見送りましょう。',
      correctedWbgt: wbgt,
    };
  }
}