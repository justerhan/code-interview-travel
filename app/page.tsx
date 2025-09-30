'use client';
import { useState } from 'react';
import { PreferenceForm } from '@/components/PreferenceForm';
import { Chat } from '@/components/Chat';
import { type ParsedPreferences, parsedPreferencesSchema } from '@/lib/schemas';

export default function Page() {
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [parsed, setParsed] = useState<ParsedPreferences | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmitInput(text: string) {
    setLoading(true);
    // Compose up-to-date history including the new user message
    const nextHistory = [...messages, { role: 'user' as const, content: text }];
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

      const recRes = await fetch('/api/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferences: parsedPref, history: nextHistory }),
      });
      const recData = await recRes.json();
      setMessages((m) => [...m, { role: 'assistant', content: recData.markdown }]);
    } catch (e: any) {
      setMessages((m) => [...m, { role: 'assistant', content: `Oops: ${e.message}` }]);
    } finally {
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