import { NextRequest } from 'next/server';
import { openai, model } from '@/lib/llm';
import { type ParsedPreferences } from '@/lib/schemas';
import { estimateTripCostUSD, getWeatherSummary, estimateFlightPriceUSD, getHotelSuggestions } from '@/lib/tools';
import { classify, taskFor, type FollowUpMode } from '@/lib/followups';

export const runtime = 'edge';

function candidateDestinations(pref: ParsedPreferences) {
  const pool = [
    { name: 'Lisbon', country: 'Portugal', type: 'city+beach' },
    { name: 'Canary Islands', country: 'Spain', type: 'beach' },
    { name: 'Crete', country: 'Greece', type: 'beach+adventure' },
    { name: 'Nice', country: 'France', type: 'city+beach' },
  ];
  const type = (pref.destinationType || '').toLowerCase();
  const region = (pref.region || '').toLowerCase();
  return pool.filter((d) =>
    (!type || d.type.includes(type)) &&
    (!region || ['europe','eu'].some(r => region.includes(r)) || region.includes(d.country.toLowerCase()) || region.includes(d.name.toLowerCase()))
  ).slice(0, 3);
}

export async function POST(req: NextRequest) {
  const { preferences, history } = (await req.json()) as { preferences: ParsedPreferences; history?: { role: 'user' | 'assistant'; content: string }[] };
  const picks = candidateDestinations(preferences);

  const comfort = preferences.budgetUsd && preferences.budgetUsd < 1500 ? 'budget' : 
                  preferences.budgetUsd && preferences.budgetUsd > 3000 ? 'premium' : 'mid';

  const enriched = await Promise.all(
    picks.map(async (d) => {
      const place = `${d.name}, ${d.country}`;
      const month = preferences.month || undefined;
      const weatherSummary = await getWeatherSummary(place, month);
      const flightPrice = estimateFlightPriceUSD({ destination: place, month });
      const estCostUsd = estimateTripCostUSD({ destination: place, durationDays: preferences.durationDays, comfort, flightPrice });
      const hotels = getHotelSuggestions(place, comfort);
      return { place, weatherSummary, estCostUsd, flightPrice, hotels };
    })
  );

  const sys = `You are a knowledgeable travel recommender. Respond in concise Markdown only (no JSON).`;
  const facts = enriched.map((e, i) => 
    `#${i+1} ${e.place} | flightUSD=${e.flightPrice} | totalCostUSD=${e.estCostUsd} | weather='${e.weatherSummary}' | hotels=${JSON.stringify(e.hotels)}`
  ).join('\n');
  const lastUser = Array.isArray(history) ? [...history].reverse().find(m => m.role === 'user') : undefined;
  const mode: FollowUpMode = classify(lastUser?.content);
  const user = `User preferences: ${JSON.stringify(preferences)}\n\nFacts to include exactly as given (do not alter numbers):\n${facts}\n\nTask: ${taskFor[mode]}`;

  const historyMessages = Array.isArray(history)
    ? history.map((m) => ({ role: m.role, content: m.content }))
    : [];

  const completion = await openai.chat.completions.create({
    model: model().name,
    temperature: 0.4,
    stream: true,
    messages: [
      { role: 'system', content: sys },
      ...historyMessages,
      { role: 'user', content: user }
    ]
  });

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const part of completion) {
          const delta = part.choices?.[0]?.delta?.content;
          if (delta) controller.enqueue(encoder.encode(delta));
        }
      } catch (e) {
        controller.enqueue(encoder.encode('\n\n(Streaming ended with an error, please retry)'));
      } finally {
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache',
    },
  });
}
