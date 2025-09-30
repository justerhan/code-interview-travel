'use client';
import { useState } from 'react';
import { markdownToHtml } from '@/lib/format';
import DOMPurify from 'dompurify';

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
    <div className="border rounded-2xl p-4 bg-vapor-card border-vapor-purple/30 shadow-sm">
      <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1" aria-live="polite" role="log">
        {messages.map((m, i) => (
          <div key={i} className={m.role === 'user' ? 'text-right' : 'text-left'}>
            {m.role === 'assistant' ? (
              <div className={'inline-block rounded-2xl px-3 py-2 bg-vapor-card border border-vapor-purple/20 max-w-full text-left'}>
                <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(markdownToHtml(m.content)) }} />
              </div>
            ) : (
              <div
                className={
                  'inline-block rounded-2xl px-3 py-2 whitespace-pre-wrap ' +
                  (m.role === 'user' ? 'bg-vapor-pink text-vapor-bg' : 'bg-vapor-card')
                }
              >
                {m.content}
              </div>
            )}
          </div>
        ))}
        {loading && <div className="text-sm text-vapor-subtext">Thinking…</div>}
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
          className="flex-1 border border-vapor-purple/30 rounded-xl px-3 py-2 bg-[#1a1b36] text-vapor-text placeholder-vapor-subtext focus:outline-none focus:ring-2 focus:ring-vapor-cyan focus:ring-offset-1 focus:ring-offset-vapor-bg"
          placeholder="e.g. Somewhere warm in Europe next month under $2k"
          aria-label="Message"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <button className="px-4 py-2 rounded-xl bg-vapor-cyan hover:bg-vapor-green text-vapor-bg transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-vapor-cyan focus:ring-offset-1 focus:ring-offset-vapor-bg" aria-label="Send message" disabled={loading}>Send</button>
      </form>
    </div>
  );
}