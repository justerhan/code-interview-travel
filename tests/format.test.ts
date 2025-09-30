import { describe, it, expect } from 'vitest';
import { markdownToHtml } from '@/lib/format';

describe('format.markdownToHtml', () => {
  it('escapes HTML and renders bold/italics/links', () => {
    const md = `Hello <b>world</b> **bold** *ital* [link](https://example.com)`;
    const html = markdownToHtml(md);
    expect(html).toContain('Hello');
    expect(html).toContain('&lt;b&gt;world&lt;/b&gt;');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<em>ital</em>');
    expect(html).toContain('<a');
  });

  it('renders headings and paragraphs', () => {
    const md = `# Title\nSome text`;
    const html = markdownToHtml(md);
    expect(html).toContain('<h1>Title</h1>');
    expect(html).toContain('<p');
  });

  it('renders nested lists with padding', () => {
    const md = `- Item\n  - Sub\n    - SubSub`;
    const html = markdownToHtml(md);
    // Expect multiple <ul> nesting and <li> items
    const ulCount = (html.match(/<ul/g) || []).length;
    const liCount = (html.match(/<li>/g) || []).length;
    expect(ulCount).toBeGreaterThanOrEqual(2);
    expect(liCount).toBe(3);
  });
});
