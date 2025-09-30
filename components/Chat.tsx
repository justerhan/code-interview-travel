'use client';
import { useState, useRef } from 'react';
import type { MouseEvent } from 'react';
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
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [preview, setPreview] = useState<{ visible: boolean; url: string; x: number; y: number }>({ visible: false, url: '', x: 0, y: 0 });

  function isImageLikely(href: string): boolean {
    const lower = href.toLowerCase();
    return /(\.png|\.jpg|\.jpeg|\.webp|\.gif)(\?|$)/.test(lower) || lower.includes('picsum.photos');
  }

  function handleMouseMove(e: MouseEvent<HTMLDivElement>) {
    const target = e.target as HTMLElement | null;
    if (!target) return;
    const a = target.closest('a') as HTMLAnchorElement | null;
    if (a && a.href && isImageLikely(a.href)) {
      const pad = 12;
      let x = e.clientX + pad;
      let y = e.clientY + pad;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const maxW = 340;
      const maxH = 220;
      if (x + maxW + 24 > vw) x = Math.max(8, vw - maxW - 24);
      if (y + maxH + 24 > vh) y = Math.max(8, vh - maxH - 24);
      setPreview({ visible: true, url: a.href, x, y });
    } else if (preview.visible) {
      setPreview((p) => ({ ...p, visible: false }));
    }
  }

  return (
    <div className="border rounded-2xl p-4 bg-vapor-card border-vapor-purple/30 shadow-sm" ref={containerRef} onMouseMove={handleMouseMove} onMouseLeave={() => setPreview((p) => ({ ...p, visible: false }))}>
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
          disabled={loading}
        >
          Send
        </button>
      </form>
      {/* Hover image preview */}
      {preview.visible && (
        <div
          className="img-hover-preview"
          style={{
            position: 'fixed',
            left: preview.x,
            top: preview.y,
            zIndex: 50,
            pointerEvents: 'none',
            background: 'rgba(10,11,26,0.9)',
            border: '1px solid rgba(185,103,255,0.35)',
            borderRadius: 12,
            boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
            padding: 6,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview.url}
            alt="Preview"
            style={{ maxWidth: 340, maxHeight: 220, display: 'block', borderRadius: 8 }}
          />
        </div>
      )}
    </div>
  );
}