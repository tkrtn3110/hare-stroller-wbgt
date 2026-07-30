// app/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { Transportation, getAdvice } from '../lib/wbgt';

type Location = {
  id: string;
  name: string;
};

type LocationMaster = {
  id: string;
  name: string;
};

type HourlyData = {
  dateStr?: string;
  time: string;
  wbgt: number;
};

const DEFAULT_LOCATIONS: Location[] = [
  { id: '48156', name: '長野市' },
  { id: '14163', name: '札幌' },
];

export default function Home() {
  const [ageInDays] = useState<number>(80);
  const [transport, setTransport] = useState<Transportation>('stroller');

  const [locations, setLocations] = useState<Location[]>(DEFAULT_LOCATIONS);
  const [selectedLocation, setSelectedLocation] = useState<Location>(DEFAULT_LOCATIONS[0]);

  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [masterLocations, setMasterLocations] = useState<LocationMaster[]>([]);
  const [loadingMaster, setLoadingMaster] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [rawWbgt, setRawWbgt] = useState<number | null>(null);
  const [forecast, setForecast] = useState<HourlyData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('hare_locations');
    if (saved) {
      try {
        let parsed: Location[] = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          parsed = parsed.map((loc) => {
            if (loc.id === '48141' || loc.name.includes('長野')) {
              return { id: '48156', name: '長野市' };
            }
            if (loc.id === '14166' || loc.name.includes('札幌')) {
              return { id: '14163', name: '札幌' };
            }
            return loc;
          });

          const uniqueLocations = parsed.filter(
            (loc, index, self) => index === self.findIndex((t) => t.id === loc.id)
          );

          setLocations(uniqueLocations);
          setSelectedLocation(uniqueLocations[0]);
          localStorage.setItem('hare_locations', JSON.stringify(uniqueLocations));
        }
      } catch (e) {
        console.error('Failed to parse saved locations', e);
      }
    } else {
      setLocations(DEFAULT_LOCATIONS);
      setSelectedLocation(DEFAULT_LOCATIONS[0]);
      localStorage.setItem('hare_locations', JSON.stringify(DEFAULT_LOCATIONS));
    }
  }, []);

  useEffect(() => {
    if (isSettingsOpen && masterLocations.length === 0) {
      async function fetchMaster() {
        try {
          setLoadingMaster(true);
          const res = await fetch('/api/locations');
          const data = await res.json();
          if (data.locations) setMasterLocations(data.locations);
        } catch (err) {
          console.error('Failed to load master locations:', err);
        } finally {
          setLoadingMaster(false);
        }
      }
      fetchMaster();
    }
  }, [isSettingsOpen, masterLocations.length]);

  useEffect(() => {
    async function fetchWbgt() {
      try {
        setLoading(true);
        setErrorMsg(null);

        let pointId = selectedLocation.id;
        if (pointId === '48141') pointId = '48156';
        if (pointId === '14166') pointId = '14163';

        const res = await fetch(`/api/wbgt?pointId=${pointId}`);
        const data = await res.json();

        if (data.success && data.wbgt !== null && data.wbgt !== undefined) {
          setRawWbgt(data.wbgt);
          setForecast(data.forecast || []);
        } else {
          setRawWbgt(null);
          setForecast([]);
          setErrorMsg(data.error || '環境省データの取得に失敗しました');
        }
      } catch (err) {
        console.error('API fetch failed:', err);
        setRawWbgt(null);
        setForecast([]);
        setErrorMsg('通信エラーが発生しました');
      } finally {
        setLoading(false);
      }
    }

    if (selectedLocation?.id) {
      fetchWbgt();
    }
  }, [selectedLocation]);

  const filteredMaster = searchQuery.trim()
    ? masterLocations.filter((loc) => loc.name.includes(searchQuery.trim()))
    : [];

  const handleAddFromMaster = (loc: LocationMaster) => {
    if (locations.some((item) => item.id === loc.id)) {
      alert('すでに登録されている地点です。');
      return;
    }
    const updated = [...locations, { id: loc.id, name: loc.name }];
    setLocations(updated);
    localStorage.setItem('hare_locations', JSON.stringify(updated));
    setSearchQuery('');
  };

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

  const currentAdvice = rawWbgt !== null ? getAdvice(ageInDays, rawWbgt, transport) : null;

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
        ) : errorMsg || !currentAdvice ? (
          <div className="py-8 text-red-400 text-sm font-medium">{errorMsg || 'データが取得できませんでした'}</div>
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

      {/* 3日間の時間帯別 予報リスト */}
      {!loading && !errorMsg && forecast.length > 0 && (
        <section className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
          <h2 className="text-sm font-bold text-slate-700 mb-3 flex items-center justify-between">
            <span>⏱ {selectedLocation.name}の 3日間WBGT予報</span>
            <span className="text-xs font-normal text-slate-400">3時間ごと</span>
          </h2>

          <div className="grid grid-cols-3 text-center text-xs font-bold text-slate-400 mb-2 px-2">
            <span className="text-left">時間</span>
            <span>指数 (WBGT)</span>
            <span className="text-right">状況</span>
          </div>

          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
            {forecast.map((item, idx) => {
              const itemAdvice = getAdvice(ageInDays, item.wbgt, transport);
              // 前のアイテムと日付が変わるタイミング（または1件目）で日付ヘッダーを表示
              const isNewDate = idx === 0 || item.dateStr !== forecast[idx - 1].dateStr;

              return (
                <div key={idx}>
                  {/* 日付区切りヘッダー */}
                  {isNewDate && item.dateStr && (
                    <div className="bg-slate-100 text-slate-700 text-xs font-bold py-1.5 px-3 rounded-lg my-2 flex items-center gap-1">
                      📅 {item.dateStr}
                    </div>
                  )}

                  <div className="grid grid-cols-3 items-center p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-sm">
                    {/* 列1: 時間 */}
                    <span className="font-bold text-slate-600 text-left">{item.time}</span>

                    {/* 列2: 暑さ指数 (補正後) */}
                    <span className="font-black text-slate-800 text-center">
                      {itemAdvice.correctedWbgt}
                    </span>

                    {/* 列3: 状況バッジ */}
                    <div className="text-right">
                      <span className={`inline-block text-xs text-white font-bold px-2.5 py-1 rounded-full ${itemAdvice.badgeColor}`}>
                        {itemAdvice.title.split('（')[0]}
                      </span>
                    </div>
                  </div>
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

            <div className="border-t border-slate-100 pt-4 mb-4">
              <label className="text-xs font-bold text-slate-700 block mb-1">🔍 全国主要地点から検索</label>
              {loadingMaster ? (
                <div className="text-xs text-slate-400 py-2">地点データを取得中...</div>
              ) : (
                <>
                  <input
                    type="text"
                    placeholder="例: 札幌、松本、大阪など"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:border-sky-500 mb-2"
                  />

                  {searchQuery.trim() !== '' && (
                    <div className="border border-slate-200 rounded-xl max-h-40 overflow-y-auto divide-y divide-slate-100 bg-slate-50">
                      {filteredMaster.length > 0 ? (
                        filteredMaster.map((loc) => (
                          <button
                            key={loc.id}
                            onClick={() => handleAddFromMaster(loc)}
                            className="w-full text-left p-2.5 text-xs hover:bg-sky-50 transition flex justify-between items-center text-slate-700 font-medium"
                          >
                            <span>📍 {loc.name}</span>
                            <span className="text-sky-600 font-bold">＋ 追加</span>
                          </button>
                        ))
                      ) : (
                        <div className="p-3 text-xs text-slate-400 text-center">該当する地点が見つかりません</div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
