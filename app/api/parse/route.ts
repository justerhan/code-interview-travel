import { NextRequest, NextResponse } from 'next/server';
import { openai, model } from '@/lib/llm';
import { parsedPreferencesSchema } from '@/lib/schemas';

export const runtime = 'edge';

export async function POST(req: NextRequest) {
  const { text } = await req.json();
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
- activities: split by commas/and phrases (adventure, food, hiking, museums, nightlife, beach, etc.)`;

  const completion = await openai.chat.completions.create({
    model: model().name,
    temperature: 0.2,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: sys },
      { role: 'user', content: text }
    ]
  });

  const json = JSON.parse(completion.choices[0]?.message?.content || '{}');
  const preferences = parsedPreferencesSchema.parse(json);
  return NextResponse.json({ preferences });
}