// app/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { Transportation, getAdvice } from '../lib/wbgt';

export default function Home() {
  const [ageInDays] = useState<number>(80); // 晴ちゃんの生後日数
  const [transport, setTransport] = useState<Transportation>('stroller');
  
  // WBGT数値の状態管理（初期値は取得完了まで仮で25.0）
  const [rawWbgt, setRawWbgt] = useState<number>(25.0);
  const [loading, setLoading] = useState<boolean>(true);
  const [pointName] = useState<string>('長野市');

  // 画面が開いた時に環境省APIからデータを取得
  useEffect(() => {
    async function fetchWbgt() {
      try {
        setLoading(true);
        // 長野市の地点コード 48141
        const res = await fetch('/api/wbgt?pointId=48141');
        const data = await res.json();
        if (data.wbgt) {
          setRawWbgt(data.wbgt);
        }
      } catch (err) {
        console.error('Failed to load WBGT:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchWbgt();
  }, []);

  const advice = getAdvice(ageInDays, rawWbgt, transport);

  return (
    <main className="min-h-screen bg-slate-50 p-4 max-w-md mx-auto text-slate-800">
      {/* ヘッダー情報 */}
      <header className="bg-white p-4 rounded-2xl shadow-sm mb-4 border border-slate-100">
        <h1 className="text-xl font-bold text-slate-900">👶 晴ちゃんのお散歩チェック</h1>
        <div className="mt-2 text-sm text-slate-500 flex justify-between items-center">
          <span>生後 {ageInDays} 日目（月齢 {Math.floor(ageInDays / 30)}ヶ月）</span>
          <span className="text-xs bg-slate-100 px-2 py-1 rounded">{pointName}</span>
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

      {/* 判定カード */}
      <section className="bg-white p-6 rounded-2xl shadow-sm mb-4 border border-slate-100 text-center">
        {loading ? (
          <div className="py-8 text-slate-400 text-sm">環境省から最新データを読み込み中...</div>
        ) : (
          <>
            <span className={`inline-block text-white text-xs font-bold px-3 py-1 rounded-full mb-3 ${advice.badgeColor}`}>
              {advice.title}
            </span>
            
            <div className="my-2">
              <span className="text-5xl font-black text-slate-800">{advice.correctedWbgt}</span>
              <span className="text-lg font-bold text-slate-500 ml-1">℃ (WBGT)</span>
            </div>

            <p className="text-xs text-slate-400 mb-4">
              環境省データ {rawWbgt}℃ ＋ {transport === 'stroller' ? 'ベビーカー補正 (+2.0℃)' : '抱っこ紐補正 (+1.0℃)'}
            </p>

            <div className="bg-slate-50 p-4 rounded-xl text-left border border-slate-100">
              <p className="text-sm leading-relaxed font-medium text-slate-700">
                {advice.message}
              </p>
            </div>
          </>
        )}
      </section>
    </main>
  );
}