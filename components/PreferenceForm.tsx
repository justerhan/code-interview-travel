'use client';
import { useState } from 'react';
import { type ParsedPreferences } from '@/lib/schemas';

export function PreferenceForm({ parsed, onSubmit }: { parsed: ParsedPreferences | null; onSubmit: (t: string) => void }) {
  const [manual, setManual] = useState({
    region: '',
    budgetUsd: '',
    durationDays: '',
    month: '',
    activities: '',
    weather: '',
  });

  return (
    <div className="border rounded-2xl p-4 bg-vapor-card border-vapor-purple/30 shadow-sm space-y-3">
      <h2 className="text-xl font-semibold bg-gradient-to-r from-vapor-yellow via-vapor-pink to-vapor-purple inline-block text-transparent bg-clip-text">Quick Preferences</h2>
      <div className="text-sm text-vapor-subtext">AI parse result (read‑only):</div>
      <pre className="text-xs bg-[#1a1b36] rounded p-2 overflow-x-auto text-vapor-text border border-vapor-purple/20">
        {parsed ? JSON.stringify(parsed, null, 2) : '—'}
      </pre>
      <div className="text-sm text-vapor-subtext">Or craft a prompt:</div>
      <div className="grid gap-2">
        <input className="border border-vapor-purple/30 rounded-xl px-3 py-2 bg-[#1a1b36] text-vapor-text placeholder-vapor-subtext" placeholder="Region or Type (e.g., Europe, beach)" value={manual.region} onChange={(e) => setManual({ ...manual, region: e.target.value })} />
        <div className="flex gap-2">
          <input className="w-1/2 border border-vapor-purple/30 rounded-xl px-3 py-2 bg-[#1a1b36] text-vapor-text placeholder-vapor-subtext" placeholder="Budget USD (e.g., 2000)" value={manual.budgetUsd} onChange={(e) => setManual({ ...manual, budgetUsd: e.target.value })} />
          <input className="w-1/2 border border-vapor-purple/30 rounded-xl px-3 py-2 bg-[#1a1b36] text-vapor-text placeholder-vapor-subtext" placeholder="Duration days (e.g., 5)" value={manual.durationDays} onChange={(e) => setManual({ ...manual, durationDays: e.target.value })} />
        </div>
        <input className="border border-vapor-purple/30 rounded-xl px-3 py-2 bg-[#1a1b36] text-vapor-text placeholder-vapor-subtext" placeholder="Target month (e.g., May)" value={manual.month} onChange={(e) => setManual({ ...manual, month: e.target.value })} />
        <input className="border border-vapor-purple/30 rounded-xl px-3 py-2 bg-[#1a1b36] text-vapor-text placeholder-vapor-subtext" placeholder="Activities (e.g., hiking, food)" value={manual.activities} onChange={(e) => setManual({ ...manual, activities: e.target.value })} />
        <input className="border border-vapor-purple/30 rounded-xl px-3 py-2 bg-[#1a1b36] text-vapor-text placeholder-vapor-subtext" placeholder="Weather (e.g., warm, dry)" value={manual.weather} onChange={(e) => setManual({ ...manual, weather: e.target.value })} />
      </div>
      <button
        className="w-full px-4 py-2 rounded-xl bg-vapor-cyan hover:bg-vapor-green text-vapor-bg transition-colors"
        onClick={() => {
          const text = `I want ${manual.weather || 'nice weather'} in ${manual.region || 'anywhere'}, budget ${manual.budgetUsd || 'flexible'}, duration ${manual.durationDays || 'flexible'} days, month ${manual.month || 'TBD'}, activities ${manual.activities || 'open'}`;
          onSubmit(text);
        }}
      >
        Ask AI
      </button>
      <div className="text-xs text-vapor-subtext">Tip: try “Find me a beach destination under $2000 for 5 days next month”.</div>
    </div>
  );
}