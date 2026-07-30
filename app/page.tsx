// app/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { Transportation, getAdvice } from '../lib/wbgt';

type HourlyData = {
  time: string;
  wbgt: number;
};

export default function Home() {
  const [ageInDays] = useState<number>(80);
  const [transport, setTransport] = useState<Transportation>('stroller');
  const [rawWbgt, setRawWbgt] = useState<number>(25.0);
  const [forecast, setForecast] = useState<HourlyData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    async function fetchWbgt() {
      try {
        setLoading(true);
        const res = await fetch('/api/wbgt?pointId=48141');
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
  }, []);

  const currentAdvice = getAdvice(ageInDays, rawWbgt, transport);

  return (
    <main className="min-h-screen bg-slate-50 p-4 max-w-md mx-auto text-slate-800 pb-12">
      {/* ヘッダー情報 */}
      <header className="bg-white p-4 rounded-2xl shadow-sm mb-4 border border-slate-100">
        <h1 className="text-xl font-bold text-slate-900">👶 晴ちゃんのお散歩チェック</h1>
        <div className="mt-2 text-sm text-slate-500 flex justify-between items-center">
          <span>生後 {ageInDays} 日目（月齢 {Math.floor(ageInDays / 30)}ヶ月）</span>
          <span className="text-xs bg-slate-100 px-2 py-1 rounded font-medium">長野市</span>
        </div>
      </header>

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
          <div className="py-8 text-slate-400 text-sm">環境省から最新データを読み込み中...</div>
        ) : (
          <>
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
            ⏱ 本日の時間帯別 WBGT予報
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
    </main>
  );
}