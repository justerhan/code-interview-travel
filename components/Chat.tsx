'use client';
import { useState } from 'react';

export function Chat({
  messages,
  onSubmitInput,
  loading,
}: {
  messages: { role: 'user' | 'assistant'; content: string }[];
  onSubmitInput: (text: string) => void;
  loading: boolean;
}) {
  const [input, setInput] = useState('');
  return (
    <div className="border rounded-2xl p-4 bg-white dark:bg-zinc-900 shadow-sm">
      <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
        {messages.map((m, i) => (
          <div key={i} className={m.role === 'user' ? 'text-right' : 'text-left'}>
            <div
              className={
                'inline-block rounded-2xl px-3 py-2 whitespace-pre-wrap ' +
                (m.role === 'user' ? 'bg-blue-600 text-white' : 'bg-zinc-100 dark:bg-zinc-800')
              }
            >
              {m.content}
            </div>
          </div>
        ))}
        {loading && <div className="text-sm text-zinc-500">Thinking…</div>}
      </div>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!input.trim()) return;
          onSubmitInput(input.trim());
          setInput('');
        }}
      >
        <input
          className="flex-1 border rounded-xl px-3 py-2 bg-zinc-50 dark:bg-zinc-800"
          placeholder="e.g. Somewhere warm in Europe next month under $2k"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <button className="px-4 py-2 rounded-xl bg-blue-600 text-white disabled:opacity-50" disabled={loading}>
          Send
        </button>
      </form>
    </div>
  );
}