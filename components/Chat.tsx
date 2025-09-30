'use client';
import { useState } from 'react';
import { markdownToHtml } from '@/lib/format';
import DOMPurify from 'dompurify';

export function Chat({
  messages,
  onSubmitInput,
  loading,
  streamingEnabled,
  onToggleStreaming,
  onStop,
}: {
  messages: { role: 'user' | 'assistant'; content: string }[];
  onSubmitInput: (text: string) => void;
  loading: boolean;
  streamingEnabled?: boolean;
  onToggleStreaming?: (v: boolean) => void;
  onStop?: () => void;
}) {
  const [input, setInput] = useState('');

  return (
    <div className="border rounded-2xl p-4 bg-vapor-card border-vapor-purple/30 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm text-vapor-subtext">Assistant</div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-vapor-subtext select-none">
            <input
              type="checkbox"
              className="accent-vapor-cyan"
              checked={!!streamingEnabled}
              onChange={(e) => onToggleStreaming?.(e.target.checked)}
            />
            Streaming
          </label>
          <button
            className="px-2 py-1 rounded-md bg-vapor-pink text-vapor-bg disabled:opacity-40"
            onClick={() => onStop?.()}
            disabled={!loading}
            title="Stop streaming"
            aria-label="Stop streaming"
          >
            Stop
          </button>
        </div>
      </div>
      <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1" aria-live="polite" role="log">
        {messages.map((m, i) => {
          const isUser = m.role === 'user';
          return (
            <div
              key={i}
              className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'}`}
              aria-label={isUser ? 'User message' : 'Assistant message'}
            >
              {/* Avatar/Badge */}
              {!isUser && (
                <div className="mr-2 mt-1 hidden sm:flex items-start">
                  <div className="h-7 w-7 rounded-full bg-vapor-cyan/20 border border-vapor-cyan/30 text-vapor-cyan flex items-center justify-center text-[10px] font-semibold select-none">
                    AI
                  </div>
                </div>
              )}
              <div
                className={
                  'max-w-[min(800px,90%)] rounded-2xl px-4 py-3 shadow-sm ' +
                  (isUser
                    ? 'bg-vapor-pink text-vapor-bg neon-glow-pink'
                    : 'bg-[#1a1b36] text-vapor-text border border-vapor-purple/25')
                }
              >
                {isUser ? (
                  <div className="whitespace-pre-wrap leading-relaxed">{m.content}</div>
                ) : (
                  <div className="chat-content leading-relaxed" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(markdownToHtml(m.content)) }} />
                )}
              </div>
              {/* User badge for large screens (symmetry) */}
              {isUser && (
                <div className="ml-2 mt-1 hidden sm:flex items-start">
                  <div className="h-7 w-7 rounded-full bg-vapor-pink/20 border border-vapor-pink/30 text-vapor-pink flex items-center justify-center text-[10px] font-semibold select-none">
                    You
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {loading && (
          <div className="text-sm text-vapor-subtext pl-9">Thinking…</div>
        )}
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
        <button
          className="px-4 py-2 rounded-xl bg-vapor-cyan hover:bg-vapor-green text-vapor-bg transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-vapor-cyan focus:ring-offset-1 focus:ring-offset-vapor-bg"
          aria-label="Send message"
          disabled={loading}
        >
          Send
        </button>
      </form>
    </div>
  );
}