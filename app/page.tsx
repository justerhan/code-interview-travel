'use client';
import { useEffect, useRef, useState } from 'react';
import { PreferenceForm } from '@/components/PreferenceForm';
import { Chat } from '@/components/Chat';
import { type ParsedPreferences, parsedPreferencesSchema } from '@/lib/schemas';

export default function Page() {
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [parsed, setParsed] = useState<ParsedPreferences | null>(null);
  const [loading, setLoading] = useState(false);
  const streamAbortRef = useRef<AbortController | null>(null);
  const [streamingEnabled, setStreamingEnabled] = useState(true);
  const [resetTick, setResetTick] = useState(0);
  const [tone, setTone] = useState<string>('surfer');

  // Load session from localStorage on mount
  useEffect(() => {
    try {
      const m = localStorage.getItem('travel.messages');
      const p = localStorage.getItem('travel.parsed');
      const s = localStorage.getItem('travel.streamingEnabled');
      const f = localStorage.getItem('travel.form');
      const t = localStorage.getItem('travel.tone');
      if (m) {
        const arr = JSON.parse(m);
        if (Array.isArray(arr)) setMessages(arr);
      }
      if (p) {
        const obj = JSON.parse(p);
        if (obj && typeof obj === 'object') setParsed(obj as ParsedPreferences);
      }
      if (s != null) setStreamingEnabled(s === 'true');
      let toneSet = false;
      if (f) {
        try {
          const form = JSON.parse(f);
          if (form && typeof form.tone === 'string') { setTone(form.tone); toneSet = true; }
        } catch {}
      }
      if (!toneSet && typeof t === 'string' && t) {
        setTone(t);
      }
    } catch {}
  }, []);

  // Persist session on changes
  useEffect(() => {
    try {
      localStorage.setItem('travel.messages', JSON.stringify(messages));
    } catch {}
  }, [messages]);
  useEffect(() => {
    try {
      localStorage.setItem('travel.parsed', JSON.stringify(parsed));
    } catch {}
  }, [parsed]);
  useEffect(() => {
    try {
      localStorage.setItem('travel.streamingEnabled', String(streamingEnabled));
    } catch {}
  }, [streamingEnabled]);
  useEffect(() => {
    try {
      localStorage.setItem('travel.tone', tone);
    } catch {}
  }, [tone]);
  useEffect(() => {
    // Mirror tone into travel.form immediately to ensure refresh picks it up
    try {
      const raw = localStorage.getItem('travel.form');
      const obj = raw ? JSON.parse(raw) : {};
      if (!obj || typeof obj !== 'object') {
        localStorage.setItem('travel.form', JSON.stringify({ tone }));
      } else {
        obj.tone = tone;
        localStorage.setItem('travel.form', JSON.stringify(obj));
      }
    } catch {}
  }, [tone]);

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

      // Clarifying question step: if critical fields are missing, ask succinctly and skip recommend for now
      const missing: string[] = [];
      if (!parsedPref.region && !parsedPref.destinationType) missing.push('region or destination type');
      if (!parsedPref.month) missing.push('target month');
      if (parsedPref.budgetUsd == null && parsedPref.durationDays == null) missing.push('budget or trip length');
      // Ask only when all three critical groups are missing
      if (missing.length >= 3) {
        const q = `Quick check: could you share your ${missing.join(', ')}?`;
        setMessages((m) => [...m, { role: 'assistant', content: q }]);
        return;
      }

      if (streamingEnabled) {
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
          body: JSON.stringify({ preferences: parsedPref, history: nextHistory, tone }),
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
            body: JSON.stringify({ preferences: parsedPref, history: nextHistory, tone }),
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
      } else {
        // Non-streaming mode
        const recRes = await fetch('/api/recommend', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ preferences: parsedPref, history: nextHistory, tone }),
        });
        const recData = await recRes.json();
        setMessages((m) => [...m, { role: 'assistant', content: recData.markdown }]);
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
          <div className="flex gap-2">
            <button
              className="px-3 py-1 rounded-md border border-vapor-purple/30 text-sm hover:bg-vapor-purple/10"
              onClick={() => {
                try {
                  localStorage.removeItem('travel.messages');
                  localStorage.removeItem('travel.parsed');
                  localStorage.removeItem('travel.streamingEnabled');
                  localStorage.removeItem('travel.form');
                  localStorage.removeItem('travel.tone');
                } catch {}
                setMessages([]);
                setParsed(null);
                setStreamingEnabled(true);
                setResetTick((x) => x + 1);
                setTone('surfer');
              }}
            >
              Reset Session
            </button>
          </div>
          <Chat
            messages={messages}
            onSubmitInput={onSubmitInput}
            loading={loading}
            streamingEnabled={streamingEnabled}
            onToggleStreaming={setStreamingEnabled}
            onStop={() => {
              try { streamAbortRef.current?.abort(); } catch {}
              streamAbortRef.current = null;
              setLoading(false);
            }}
          />
        </div>
        <div className="md:col-span-1">
          <PreferenceForm
            parsed={parsed}
            onSubmit={onSubmitInput}
            resetSignal={resetTick}
            tone={tone}
            onToneChange={setTone}
          />
        </div>
      </div>
    </div>
  );
}