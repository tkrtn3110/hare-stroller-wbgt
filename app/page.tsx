// app/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { Transportation, getAdvice } from '../lib/wbgt';

type Location = {
  id: string;
  name: string;
};

type HourlyData = {
  time: string;
  wbgt: number;
};

// 環境省 WBGT 主要地点データベース (辞書データ)
const LOCATION_DATABASE: Location[] = [
  // 長野県
  { id: '48141', name: '長野市' },
  { id: '48206', name: '松本市' },
  { id: '48056', name: '飯山市' },
  { id: '48171', name: '上田市' },
  { id: '48241', name: '諏訪市' },
  { id: '48301', name: '伊那市' },
  { id: '48361', name: '飯田市' },
  { id: '48220', name: '軽井沢町' },
  // 北陸・隣県
  { id: '55111', name: '富山市' },
  { id: '55201', name: '高岡市' },
  { id: '56111', name: '金沢市' },
  { id: '57106', name: '福井市' },
  { id: '54231', name: '新潟市' },
  { id: '49126', name: '甲府市' },
  // 東南木・主要都市
  { id: '44132', name: '東京都（千代田区）' },
  { id: '44071', name: '東京都（練馬区）' },
  { id: '44056', name: '東京都（八王子市）' },
  { id: '46091', name: '横浜市' },
  { id: '43056', name: 'さいたま市' },
  { id: '45106', name: '千葉市' },
  { id: '51106', name: '名古屋市' },
  { id: '62078', name: '大阪市' },
  { id: '63086', name: '神戸市' },
  { id: '61286', name: '京都市' },
  { id: '82056', name: '福岡市' },
  { id: '14166', name: '札幌市' },
  { id: '34396', name: '仙台市' },
];

const DEFAULT_LOCATIONS: Location[] = [
  { id: '48141', name: '長野市' },
  { id: '55111', name: '富山市' },
];

export default function Home() {
  const [ageInDays] = useState<number>(80);
  const [transport, setTransport] = useState<Transportation>('stroller');
  
  const [locations, setLocations] = useState<Location[]>(DEFAULT_LOCATIONS);
  const [selectedLocation, setSelectedLocation] = useState<Location>(DEFAULT_LOCATIONS[0]);
  
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [customName, setCustomName] = useState<string>('');
  const [customId, setCustomId] = useState<string>('');

  const [rawWbgt, setRawWbgt] = useState<number>(25.0);
  const [forecast, setForecast] = useState<HourlyData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // 初回読み込み
  useEffect(() => {
    const saved = localStorage.getItem('hare_locations');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setLocations(parsed);
          setSelectedLocation(parsed[0]);
        }
      } catch (e) {
        console.error('Failed to parse saved locations', e);
      }
    }
  }, []);

  // データ取得
  useEffect(() => {
    async function fetchWbgt() {
      try {
        setLoading(true);
        const res = await fetch(`/api/wbgt?pointId=${selectedLocation.id}`);
        const data = await res.json();
        if (data.wbgt) setRawWbgt(data.wbgt);
        if (data.forecast) setForecast(data.forecast);
      } catch (err) {
        console.error('Failed to load WBGT:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchWbgt();
  }, [selectedLocation]);

  // 地点候補の検索フィルタリング
  const filteredDatabase = searchQuery.trim()
    ? LOCATION_DATABASE.filter((loc) => loc.name.includes(searchQuery.trim()))
    : [];

  // データベース候補から追加する処理
  const handleSelectFromDatabase = (loc: Location) => {
    if (locations.some((item) => item.id === loc.id)) {
      alert('すでに登録されている地点です。');
      return;
    }
    const updated = [...locations, loc];
    setLocations(updated);
    localStorage.setItem('hare_locations', JSON.stringify(updated));
    setSearchQuery('');
  };

  // 手入力で追加する処理
  const handleAddCustomLocation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName.trim() || !customId.trim()) return;

    const updated = [...locations, { id: customId.trim(), name: customName.trim() }];
    setLocations(updated);
    localStorage.setItem('hare_locations', JSON.stringify(updated));
    setCustomName('');
    setCustomId('');
  };

  // 削除処理
  const handleDeleteLocation = (id: string) => {
    if (locations.length <= 1) {
      alert('最低1つの地点は残してください。');
      return;
    }
    const updated = locations.filter((loc) => loc.id !== id);
    setLocations(updated);
    localStorage.setItem('hare_locations', JSON.stringify(updated));
    if (selectedLocation.id === id) setSelectedLocation(updated[0]);
  };

  const currentAdvice = getAdvice(ageInDays, rawWbgt, transport);

  return (
    <main className="min-h-screen bg-slate-50 p-4 max-w-md mx-auto text-slate-800 pb-12 relative">
      {/* ヘッダー */}
      <header className="bg-white p-4 rounded-2xl shadow-sm mb-3 border border-slate-100 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-slate-900">👶 晴ちゃんのお散歩チェック</h1>
          <div className="text-xs text-slate-500 mt-1">
            生後 {ageInDays} 日目（月齢 {Math.floor(ageInDays / 30)}ヶ月）
          </div>
        </div>
        <button
          onClick={() => setIsSettingsOpen(true)}
          className="p-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl transition text-slate-600 text-lg"
          title="地点設定"
        >
          ⚙️
        </button>
      </header>

      {/* 地点切り替えタブ */}
      <section className="flex gap-2 mb-4 overflow-x-auto pb-1">
        {locations.map((loc) => (
          <button
            key={loc.id}
            onClick={() => setSelectedLocation(loc)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
              selectedLocation.id === loc.id
                ? 'bg-slate-800 text-white shadow-sm'
                : 'bg-white text-slate-600 border border-slate-200'
            }`}
          >
            📍 {loc.name}
          </button>
        ))}
      </section>

      {/* 移動手段切り替え */}
      <section className="bg-white p-4 rounded-2xl shadow-sm mb-4 border border-slate-100">
        <label className="text-xs font-bold text-slate-400 block mb-2">移動手段の選択</label>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setTransport('stroller')}
            className={`p-3 rounded-xl border text-sm font-bold flex items-center justify-center gap-2 transition ${
              transport === 'stroller'
                ? 'border-sky-500 bg-sky-50 text-sky-700'
                : 'border-slate-200 bg-white text-slate-600'
            }`}
          >
            🛒 ベビーカー
          </button>
          <button
            onClick={() => setTransport('carrier')}
            className={`p-3 rounded-xl border text-sm font-bold flex items-center justify-center gap-2 transition ${
              transport === 'carrier'
                ? 'border-sky-500 bg-sky-50 text-sky-700'
                : 'border-slate-200 bg-white text-slate-600'
            }`}
          >
            👶 抱っこ紐
          </button>
        </div>
      </section>

      {/* メイン判定カード */}
      <section className="bg-white p-6 rounded-2xl shadow-sm mb-4 border border-slate-100 text-center">
        {loading ? (
          <div className="py-8 text-slate-400 text-sm">【{selectedLocation.name}】のデータを読み込み中...</div>
        ) : (
          <>
            <div className="text-xs font-bold text-slate-400 mb-2">📍 {selectedLocation.name} の現在状況</div>
            <span className={`inline-block text-white text-xs font-bold px-3 py-1 rounded-full mb-3 ${currentAdvice.badgeColor}`}>
              {currentAdvice.title}
            </span>
            
            <div className="my-2">
              <span className="text-5xl font-black text-slate-800">{currentAdvice.correctedWbgt}</span>
              <span className="text-sm font-bold text-slate-400 ml-2">(WBGT)</span>
            </div>

            <p className="text-xs text-slate-400 mb-4">
              環境省データ {rawWbgt} ＋ {transport === 'stroller' ? 'ベビーカー補正 (+2.0)' : '抱っこ紐補正 (+1.0)'}
            </p>

            <div className="bg-slate-50 p-4 rounded-xl text-left border border-slate-100">
              <p className="text-sm leading-relaxed font-medium text-slate-700">
                {currentAdvice.message}
              </p>
            </div>
          </>
        )}
      </section>

      {/* 時間帯別 予報リスト */}
      {!loading && forecast.length > 0 && (
        <section className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
          <h2 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
            ⏱ {selectedLocation.name}の WBGT予報
          </h2>
          <div className="space-y-2">
            {forecast.map((item, idx) => {
              const itemAdvice = getAdvice(ageInDays, item.wbgt, transport);
              return (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-sm"
                >
                  <span className="font-bold text-slate-600 w-16">{item.time}</span>
                  <div className="flex items-center gap-1 font-extrabold text-slate-800">
                    <span>{itemAdvice.correctedWbgt}</span>
                  </div>
                  <span className={`text-xs text-white font-bold px-2.5 py-1 rounded-full ${itemAdvice.badgeColor}`}>
                    {itemAdvice.title.split('（')[0]}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 設定モーダル */}
      {isSettingsOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-xl border border-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-slate-800 text-lg">⚙️ 登録地点の設定</h3>
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="text-slate-400 font-bold p-1 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            {/* 登録中地点 */}
            <div className="mb-5">
              <label className="text-xs font-bold text-slate-400 block mb-2">登録中の地点</label>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {locations.map((loc) => (
                  <div key={loc.id} className="flex justify-between items-center bg-slate-50 p-2.5 rounded-xl text-xs">
                    <span className="font-bold text-slate-700">{loc.name}</span>
                    <button
                      onClick={() => handleDeleteLocation(loc.id)}
                      className="text-red-500 hover:text-red-700 font-bold px-2 py-1"
                    >
                      削除
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* 地点名で検索して追加 */}
            <div className="border-t border-slate-100 pt-4 mb-4">
              <label className="text-xs font-bold text-slate-700 block mb-1">🔍 地点名で検索して追加</label>
              <input
                type="text"
                placeholder="例: 松本、横浜、千代田など"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:border-sky-500 mb-2"
              />

              {/* 検索候補リスト */}
              {searchQuery.trim() !== '' && (
                <div className="border border-slate-200 rounded-xl max-h-36 overflow-y-auto divide-y divide-slate-100 bg-slate-50">
                  {filteredDatabase.length > 0 ? (
                    filteredDatabase.map((loc) => (
                      <button
                        key={loc.id}
                        onClick={() => handleSelectFromDatabase(loc)}
                        className="w-full text-left p-2.5 text-xs hover:bg-sky-50 transition flex justify-between items-center text-slate-700 font-medium"
                      >
                        <span>📍 {loc.name}</span>
                        <span className="text-sky-600 font-bold">＋ 追加</span>
                      </button>
                    ))
                  ) : (
                    <div className="p-3 text-xs text-slate-400 text-center">該当する主要都市が見つかりません</div>
                  )}
                </div>
              )}
            </div>

            {/* 地点コードを直接手入力する場合（折りたたみ風） */}
            <details className="border-t border-slate-100 pt-3 text-xs text-slate-400">
              <summary className="cursor-pointer font-bold mb-2">直接コード5桁を入力する場合</summary>
              <form onSubmit={handleAddCustomLocation} className="space-y-2">
                <input
                  type="text"
                  placeholder="地点名"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  className="w-full text-xs p-2 border border-slate-200 rounded-lg"
                />
                <input
                  type="text"
                  placeholder="コード5桁 (例: 48206)"
                  value={customId}
                  onChange={(e) => setCustomId(e.target.value)}
                  className="w-full text-xs p-2 border border-slate-200 rounded-lg"
                />
                <button
                  type="submit"
                  className="w-full bg-slate-700 text-white font-bold p-2 rounded-lg"
                >
                  コードで追加
                </button>
              </form>
            </details>
          </div>
        </div>
      )}
    </main>
  );
}