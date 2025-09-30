import { NextRequest, NextResponse } from 'next/server';
import { openai, model } from '@/lib/llm';
import { parsedPreferencesSchema } from '@/lib/schemas';

export const runtime = 'edge';

export async function POST(req: NextRequest) {
  const { text, history } = await req.json();
  const sys = `You extract structured travel preferences from a short user message.
Return ONLY JSON matching this schema:
{
  "region": string | undefined,
  "destinationType": string | undefined,
  "budgetUsd": number | null | undefined,
  "durationDays": number | null | undefined,
  "month": string | undefined,
  "dates": { "start"?: string, "end"?: string } | undefined,
  "activities": string[] | undefined,
  "weather": string | undefined
}
Rules:
- budget can be parsed from phrases like 'under $2000'
- month: map relative like 'next month' to a month name if possible, else keep original phrase
- activities: split by commas/and phrases (adventure, food, hiking, museums, nightlife, beach, etc.)
- weather must be a single short string summary (NOT an object; do not return per-destination weather here)`;

  const historyMessages = Array.isArray(history)
    ? history.map((m: any) => ({ role: m.role as 'user' | 'assistant', content: m.content }))
    : [];

  const completion = await openai.chat.completions.create({
    model: model().name,
    temperature: 0.2,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: sys },
      ...historyMessages,
      { role: 'user', content: text }
    ]
  });

  const json = JSON.parse(completion.choices[0]?.message?.content || '{}');

  // Normalize LLM output to satisfy schema
  const obj: any = typeof json === 'object' && json ? { ...json } : {};
  // Coerce weather: if object/array, compress to short string
  if (obj.weather && typeof obj.weather !== 'string') {
    try {
      if (Array.isArray(obj.weather)) {
        obj.weather = obj.weather.filter(Boolean).join('; ').slice(0, 200);
      } else if (typeof obj.weather === 'object') {
        obj.weather = Object.values(obj.weather).filter(Boolean).join('; ').slice(0, 200);
      } else {
        obj.weather = String(obj.weather);
      }
    } catch {
      obj.weather = undefined;
    }
  }
  // Coerce activities: accept string and split
  if (obj.activities && !Array.isArray(obj.activities)) {
    if (typeof obj.activities === 'string') {
      obj.activities = obj.activities
        .split(/,| and | & /i)
        .map((s: string) => s.trim())
        .filter(Boolean);
    } else {
      obj.activities = undefined;
    }
  }

  const preferences = parsedPreferencesSchema.parse(obj);
  return NextResponse.json({ preferences });
}