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
  fullName: string;
};

type HourlyData = {
  time: string;
  wbgt: number;
};

const DEFAULT_LOCATIONS: Location[] = [
  { id: '48141', name: '長野' },
  { id: '55111', name: '富山' },
];

export default function Home() {
  const [ageInDays] = useState<number>(80);
  const [transport, setTransport] = useState<Transportation>('stroller');
  
  const [locations, setLocations] = useState<Location[]>(DEFAULT_LOCATIONS);
  const [selectedLocation, setSelectedLocation] = useState<Location>(DEFAULT_LOCATIONS[0]);
  
  // 設定画面と環境省全地点マスター
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [masterLocations, setMasterLocations] = useState<LocationMaster[]>([]);
  const [loadingMaster, setLoadingMaster] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [rawWbgt, setRawWbgt] = useState<number>(25.0);
  const [forecast, setForecast] = useState<HourlyData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // 初回表示：保存された地点を取得
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

  // 設定画面が開いたら環境省の全地点マスターを取得
  useEffect(() => {
    if (isSettingsOpen && masterLocations.length === 0) {
      async function fetchMaster() {
        try {
          setLoadingMaster(true);
          const res = await fetch('/api/locations');
          const data = await res.json();
          if (data.locations) {
            setMasterLocations(data.locations);
          }
        } catch (err) {
          console.error('Failed to load master locations:', err);
        } finally {
          setLoadingMaster(false);
        }
      }
      fetchMaster();
    }
  }, [isSettingsOpen, masterLocations.length]);

  // 地点データの取得
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

  // 環境省マスターからのリアルタイム検索フィルタリング
  const filteredMaster = searchQuery.trim()
    ? masterLocations.filter((loc) => loc.name.includes(searchQuery.trim()))
    : [];

  // マスターから地点を選択して追加
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

            {/* 環境省マスターからのリアルタイム検索 */}
            <div className="border-t border-slate-100 pt-4 mb-4">
              <label className="text-xs font-bold text-slate-700 block mb-1">🔍 環境省の全地点から検索</label>
              {loadingMaster ? (
                <div className="text-xs text-slate-400 py-2">環境省から全国の地点データを取得中...</div>
              ) : (
                <>
                  <input
                    type="text"
                    placeholder="例: 札幌、松本、軽井沢など"
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