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
  const { preferences, history, tone: toneRaw } = (await req.json()) as { preferences: ParsedPreferences; history?: { role: 'user' | 'assistant'; content: string }[]; tone?: string };
  const tone = (String(toneRaw || 'surfer') || 'surfer').toLowerCase();
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

  const sys = `You are a knowledgeable travel recommender. Respond in concise Markdown only (no JSON).

Context-handling directives (apply silently):
- Always consider the full conversation history provided.
- If the user refers to earlier context, resolve with prior messages.
- If context is ambiguous/missing, keep this turn concise and avoid guessing.
- Use only provided facts; avoid fabrications.
- Keep output concise and avoid repetition.

Hyperlinks & media (when helpful):
- Include useful Markdown links such as Google Flights and hotel search for the destination.
- Occasionally embed a single tasteful image using Markdown (Lorem Picsum) for the first destination only.

Meta self-check (internal only):
1) Used history and preferences? 2) Avoided fabrications? 3) Output concise and mode-appropriate?

Tone directive: Adopt a ${tone} tone in phrasings while keeping facts unchanged. Examples — surfer: chill, upbeat, a bit playful; friendly: warm, approachable; formal: professional, neutral; concise: brief; enthusiastic: energetic.`;
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
      { role: 'system', content: sys + (
        mode === 'climate' ? '\nInstruction: If the latest user turn asks about climate/weather, reply minimally with weatherSummary per destination; avoid flights/costs/hotels/tips.' :
        mode === 'costs' ? '\nInstruction: If the latest user turn asks about cost/budget, reply minimally with estCostUsd per destination; avoid flights/hotels/weather/tips.' :
        mode === 'flights' ? '\nInstruction: If the latest user turn asks about flights, reply minimally with flightPriceUsd per destination; avoid costs/hotels/weather/tips.' :
        mode === 'hotels' ? '\nInstruction: If the latest user turn asks about hotels, reply minimally with 1-2 hotel suggestions (name and pricePerNight) per destination; avoid flights/costs/weather/generic tips.' :
        mode === 'highlights' ? '\nInstruction: If the latest user turn asks about highlights, reply minimally with 2-3 short highlights per destination; avoid flights/costs/hotels/tips.' :
        mode === 'tips' ? '\nInstruction: If the latest user turn asks for tips/advice, reply minimally with 2-3 short tips per destination; avoid flights/costs/hotels/weather.' :
        mode === 'fun' ? '\nInstruction: If the latest user turn asks which is most fun, reply minimally with funScore per destination (0-100) and a one-phrase reason; rank descending.' :
        mode === 'food' ? '\nInstruction: If the latest user turn asks which has the best food, reply minimally with foodScore per destination (0-100) and a one-phrase cuisine reason; rank descending.' :
        ''
      ) },
      ...historyMessages,
      { role: 'user', content: user }
    ]
  });

  const encoder = new TextEncoder();
  const firstPlace = enriched[0]?.place;
  const recap = (() => {
    const toneLead = (() => {
      switch (tone) {
        case 'surfer': return "Stoked for your trip —";
        case 'friendly': return "Great plan —";
        case 'formal': return "Summary —";
        case 'concise': return "Summary —";
        case 'enthusiastic': return "Awesome —";
        default: return "Summary —";
      }
    })();
    const bits: string[] = [];
    if (preferences.destinationType && preferences.region) {
      bits.push(`you're aiming for a ${String(preferences.destinationType).toLowerCase()} vibe in ${preferences.region}`);
    } else if (preferences.region) {
      bits.push(`you're considering ${preferences.region}`);
    } else if (preferences.destinationType) {
      bits.push(`you'd like a ${String(preferences.destinationType).toLowerCase()} destination`);
    }
    if (preferences.month) bits.push(`around ${preferences.month}`);
    if (typeof preferences.durationDays === 'number') bits.push(`for about ${preferences.durationDays} day${preferences.durationDays === 1 ? '' : 's'}`);
    if (typeof preferences.budgetUsd === 'number') bits.push(`with a total budget near $${preferences.budgetUsd.toLocaleString()}`);
    if (preferences.activities?.length) bits.push(`and you're into ${preferences.activities.slice(0, 3).join(', ')}`);
    return bits.length ? `${toneLead} ${bits.join(', ')}. Here are tailored picks:\n\n` : '';
  })();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        // Emit recap first for default mode only
        if (mode === 'none' && recap) {
          controller.enqueue(encoder.encode(recap));
          // Opportunistic image and helpful links for the first destination
          if (firstPlace) {
            const enc = encodeURIComponent(firstPlace);
            const img = `![${firstPlace}](https://picsum.photos/800/500/?${enc})\n`;
            const links = `- **Helpful links**: [Google Flights](https://www.google.com/travel/flights?q=Flights%20to%20${enc}) · [Booking](https://www.booking.com/searchresults.html?ss=${enc}) · [Google Hotels](https://www.google.com/travel/hotels?dest=${enc})\n\n`;
            controller.enqueue(encoder.encode(img + links));
          }
        }
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
