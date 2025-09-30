export function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function applyInline(md: string) {
  // bold, italics, inline links [text](url)
  let x = md;
  x = x.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  x = x.replace(/\*(.+?)\*/g, '<em>$1</em>');
  x = x.replace(/\[(.+?)\]\((https?:[^\s)]+)\)/g, '<a class="text-vapor-cyan hover:text-vapor-green underline" href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  return x;
}

function padClassForRem(rem: number) {
  const scale: Array<{ rem: number; cls: string }> = [
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
}

export function markdownToHtml(markdown: string) {
  const lines = markdown.split(/\r?\n/);
  const out: string[] = [];
  let listDepth = 0;
  let headingLevel = 0;
  const closeListsTo = (target: number) => {
    while (listDepth > target) {
      out.push('</ul>');
      listDepth--;
    }
  };
  for (let raw of lines) {
    const line = raw.replace(/\s+$/, '');
    if (!line.trim()) {
      closeListsTo(0);
      continue;
    }
    const hx = line.match(/^(#{1,3})\s+(.*)$/);
    if (hx) {
      closeListsTo(0);
      const level = hx[1].length;
      const inner = applyInline(escapeHtml(hx[2]));
      out.push(`<h${level}>${inner}</h${level}>`);
      headingLevel = level;
      continue;
    }
    const m = line.match(/^(\s*)-\s+(.*)$/);
    if (m) {
      const indent = m[1].length;
      const targetDepth = Math.max(1, Math.floor(indent / 2) + 1);
      if (targetDepth > listDepth) {
        for (let i = listDepth; i < targetDepth; i++) {
          const basePad = 2 + (i - 1) * 1.5;
          const headingPad = headingLevel > 0 ? headingLevel * 1.0 : 0;
          const cls = padClassForRem(basePad + headingPad);
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
    closeListsTo(0);
    const inner = applyInline(escapeHtml(line));
    const pCls = headingLevel > 0 ? padClassForRem(headingLevel * 1.0) : '';
    out.push(`<p class="${pCls}">${inner}</p>`);
  }
  closeListsTo(0);
  return out.join('');
}
