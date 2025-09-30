'use client';
import { useRef, useState } from 'react';
import { PreferenceForm } from '@/components/PreferenceForm';
import { Chat } from '@/components/Chat';
import { type ParsedPreferences, parsedPreferencesSchema } from '@/lib/schemas';

export default function Page() {
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [parsed, setParsed] = useState<ParsedPreferences | null>(null);
  const [loading, setLoading] = useState(false);
  const streamAbortRef = useRef<AbortController | null>(null);

  async function onSubmitInput(text: string) {
    setLoading(true);
    // Compose up-to-date history including the new user message
    const nextHistory = [...messages, { role: 'user' as const, content: text }].slice(-8);
    setMessages(nextHistory);
    try {
      const res = await fetch('/api/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, history: nextHistory }),
      });
      const data = await res.json();
      const parsedPref = parsedPreferencesSchema.parse(data.preferences);
      setParsed(parsedPref);

      // Streamed recommend call
      setMessages((m) => [...m, { role: 'assistant', content: '' }]);
      // Abort any prior stream
      if (streamAbortRef.current) {
        try { streamAbortRef.current.abort(); } catch {}
      }
      streamAbortRef.current = new AbortController();

      const streamRes = await fetch('/api/recommend/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferences: parsedPref, history: nextHistory }),
        signal: streamAbortRef.current.signal,
      });
      if (streamRes.body) {
        const reader = streamRes.body.getReader();
        const decoder = new TextDecoder();
        let done = false;
        while (!done) {
          const { value, done: readerDone } = await reader.read();
          done = readerDone;
          if (value) {
            const chunk = decoder.decode(value, { stream: true });
            setMessages((prev) => {
              const msgs = [...prev];
              // ensure last is assistant
              if (msgs.length === 0 || msgs[msgs.length - 1].role !== 'assistant') {
                msgs.push({ role: 'assistant', content: '' });
              }
              msgs[msgs.length - 1] = {
                role: 'assistant',
                content: (msgs[msgs.length - 1].content || '') + chunk,
              };
              return msgs;
            });
          }
        }
      } else {
        // Fallback to non-streaming if body missing
        const recRes = await fetch('/api/recommend', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ preferences: parsedPref, history: nextHistory }),
        });
        const recData = await recRes.json();
        setMessages((m) => {
          const msgs = [...m];
          // replace placeholder with final content
          if (msgs.length && msgs[msgs.length - 1].role === 'assistant') {
            msgs[msgs.length - 1] = { role: 'assistant', content: recData.markdown };
          } else {
            msgs.push({ role: 'assistant', content: recData.markdown });
          }
          return msgs;
        });
      }
    } catch (e: any) {
      setMessages((m) => [...m, { role: 'assistant', content: `Oops: ${e.message}` }]);
    } finally {
      // clear abort controller on completion
      streamAbortRef.current = null;
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen text-vapor-text p-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-4">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-vapor-pink via-vapor-purple to-vapor-cyan inline-block text-transparent bg-clip-text neon-text-cyan">Travel Recommendation Assistant</h1>
          <Chat messages={messages} onSubmitInput={onSubmitInput} loading={loading} />
        </div>
        <div className="md:col-span-1">
          <PreferenceForm parsed={parsed} onSubmit={onSubmitInput} />
        </div>
      </div>
    </div>
  );
}