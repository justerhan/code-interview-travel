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

  function escapeHtml(s: string) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function applyInline(md: string) {
    // bold, italics, inline links [text](url)
    let x = md;
    x = x.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    x = x.replace(/\*(.+?)\*/g, '<em>$1</em>');
    x = x.replace(/\[(.+?)\]\((https?:[^\s)]+)\)/g, '<a class="text-vapor-cyan hover:text-vapor-green underline" href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    return x;
  }
  function markdownToHtml(markdown: string) {
    const lines = markdown.split(/\r?\n/);
    const out: string[] = [];
    // Track nested list depth using indentation (2 spaces per level)
    let listDepth = 0;
    // Track current heading level (1-3) to indent following content
    let headingLevel = 0;
    const padClassForRem = (rem: number) => {
      // map rem to closest Tailwind pl- class
      const scale: Array<{rem: number; cls: string}> = [
        { rem: 0, cls: '' },
        { rem: 0.75, cls: 'pl-3' },
        { rem: 1, cls: 'pl-4' },
        { rem: 1.25, cls: 'pl-5' },
        { rem: 1.5, cls: 'pl-6' },
        { rem: 2, cls: 'pl-8' },
        { rem: 2.5, cls: 'pl-10' },
        { rem: 3, cls: 'pl-12' },
        { rem: 3.5, cls: 'pl-14' },
        { rem: 4, cls: 'pl-16' },
        { rem: 5, cls: 'pl-20' },
      ];
      let best = scale[0];
      for (const s of scale) {
        if (Math.abs(s.rem - rem) < Math.abs(best.rem - rem)) best = s;
      }
      return best.cls;
    };
    const closeListsTo = (target: number) => {
      while (listDepth > target) {
        out.push('</ul>');
        listDepth--;
      }
    };
    for (let raw of lines) {
      const line = raw.replace(/\s+$/,'');
      if (!line.trim()) { closeListsTo(0); continue; }
      // headings
      const hx = line.match(/^(#{1,3})\s+(.*)$/);
      if (hx) {
        closeListsTo(0);
        const level = hx[1].length; // 1-3
        const inner = applyInline(escapeHtml(hx[2]));
        out.push(`<h${level}>${inner}</h${level}>`);
        headingLevel = level; // set indentation context for subsequent lines
        continue;
      }
      // list item with indentation
      const m = line.match(/^(\s*)-\s+(.*)$/);
      if (m) {
        const indent = m[1].length;
        const targetDepth = Math.max(1, Math.floor(indent / 2) + 1); // depth starts at 1
        if (targetDepth > listDepth) {
          for (let i = listDepth; i < targetDepth; i++) {
            const basePad = 2 + (i - 1) * 1.5; // further increased padding per list level
            const headingPad = headingLevel > 0 ? headingLevel * 1.0 : 0; // stronger indent under headings
            const padRem = basePad + headingPad;
            const cls = padClassForRem(padRem);
            out.push(`<ul class="list-disc ${cls} text-sm">`);
          }
          listDepth = targetDepth;
        } else if (targetDepth < listDepth) {
          closeListsTo(targetDepth);
        }
        const inner = applyInline(escapeHtml(m[2]));
        out.push(`<li>${inner}</li>`);
        continue;
      }
      // paragraph fallback
      closeListsTo(0);
      const inner = applyInline(escapeHtml(line));
      const pCls = headingLevel > 0 ? padClassForRem(headingLevel * 1.0) : '';
      out.push(`<p class="${pCls}">${inner}</p>`);
    }
    closeListsTo(0);
    return out.join('');
  }

  return (
    <div className="border rounded-2xl p-4 bg-vapor-card border-vapor-purple/30 shadow-sm">
      <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
        {messages.map((m, i) => (
          <div key={i} className={m.role === 'user' ? 'text-right' : 'text-left'}>
            {m.role === 'assistant' ? (
              <div className={'inline-block rounded-2xl px-3 py-2 bg-vapor-card border border-vapor-purple/20 max-w-full text-left'}>
                <div dangerouslySetInnerHTML={{ __html: markdownToHtml(m.content) }} />
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
          className="flex-1 border border-vapor-purple/30 rounded-xl px-3 py-2 bg-[#1a1b36] text-vapor-text placeholder-vapor-subtext"
          placeholder="e.g. Somewhere warm in Europe next month under $2k"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <button className="px-4 py-2 rounded-xl bg-vapor-cyan hover:bg-vapor-green text-vapor-bg transition-colors disabled:opacity-50" disabled={loading}>Send</button>
      </form>
    </div>
  );
}