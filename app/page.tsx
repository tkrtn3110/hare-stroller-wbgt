// app/page.tsx の該当部分抜粋

const DEFAULT_LOCATIONS: Location[] = [
  { id: '48156', name: '長野市' }, // ← 48141から48156へ修正
  { id: '14163', name: '札幌' },
];

export default function Home() {
  // ... 省略 ...

  // 初回保存地点読み込み & 古いID（長野48141 / 札幌14166）の自動クレンジング
  useEffect(() => {
    const saved = localStorage.getItem('hare_locations');
    if (saved) {
      try {
        let parsed: Location[] = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // 古いIDの自動補正
          parsed = parsed.map((loc) => {
            if (loc.id === '48141' || loc.name.includes('長野')) {
              return { id: '48156', name: '長野市' };
            }
            if (loc.id === '14166' || loc.name.includes('札幌')) {
              return { id: '14163', name: '札幌' };
            }
            return loc;
          });
          setLocations(parsed);
          setSelectedLocation(parsed[0]);
          localStorage.setItem('hare_locations', JSON.stringify(parsed));
        }
      } catch (e) {
        console.error('Failed to parse saved locations', e);
      }
    } else {
      // 保存がない場合は正しい長野(48156)をセット
      setSelectedLocation(DEFAULT_LOCATIONS[0]);
    }
  }, []);

  // ... 以下同じ ...
