import { NextRequest, NextResponse } from 'next/server';
import { openai, model } from '@/lib/llm';
import { type ParsedPreferences, recommendationSchema } from '@/lib/schemas';
import { estimateTripCostUSD, getWeatherSummary, estimateFlightPriceUSD, getHotelSuggestions } from '@/lib/tools';

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
      const estCostUsd = estimateTripCostUSD({ 
        destination: place, 
        durationDays: preferences.durationDays, 
        comfort,
        flightPrice 
      });
      const hotels = getHotelSuggestions(place, comfort);
      return { place, weatherSummary, estCostUsd, flightPrice, hotels };
    })
  );

  const sys = `You are a knowledgeable travel recommender. Use provided facts; avoid fabrications.
Output JSON ONLY with this schema:
{
  "destinations": [
    { 
      "name": string, 
      "country": string, 
      "bestMonth"?: string,
      "bestTimeToVisit"?: string (e.g., "April-June for mild weather and fewer crowds"),
      "estCostUsd"?: number, 
      "flightPriceUsd"?: number,
      "weatherSummary"?: string, 
      "highlights": string[], 
      "culturalInsights"?: string[] (2-3 cultural tips, local customs, or insider knowledge),
      "why"?: string 
    }
  ],
  "tips"?: string[] (general travel tips for the region)
}`;

  const facts = enriched.map((e, i) => 
    `#${i+1} ${e.place} | flightUSD=${e.flightPrice} | totalCostUSD=${e.estCostUsd} | weather='${e.weatherSummary}' | hotels=${JSON.stringify(e.hotels)}`
  ).join('\n');
  const user = `User preferences: ${JSON.stringify(preferences)}\n\nFacts to include exactly as given (do not alter numbers):\n${facts}`;

  const historyMessages = Array.isArray(history)
    ? history.map((m) => ({ role: m.role, content: m.content }))
    : [];

  const completion = await openai.chat.completions.create({
    model: model().name,
    temperature: 0.4,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: sys },
      ...historyMessages,
      { role: 'user', content: user }
    ]
  });

  const obj = JSON.parse(completion.choices[0]?.message?.content || '{}');
  const structured = recommendationSchema.parse(obj);

  const md = [
    `**Top picks** (based on your prefs):`,
    ...structured.destinations.map((d) => {
      const parts = [
        `\n### ${d.name}, ${d.country}`,
        `- **Why**: ${d.why || 'Great fit for your stated interests and weather prefs.'}`,
        d.bestTimeToVisit ? `- **Best time to visit**: ${d.bestTimeToVisit}` : '',
        `- **Weather**: ${d.weatherSummary || '—'}`,
        d.flightPriceUsd ? `- **Flight estimate**: $${d.flightPriceUsd.toLocaleString()} roundtrip` : '',
        `- **Est. total trip cost**: $${d.estCostUsd?.toLocaleString() || '—'}`,
        d.hotels?.length ? `- **Hotel suggestions**:\n${d.hotels.map(h => `  - ${h.name} ($${h.pricePerNight}/night${h.rating ? `, ${h.rating}★` : ''}${h.type ? ` - ${h.type}` : ''})`).join('\n')}` : '',
        `- **Highlights**: ${d.highlights.join(', ') || '—'}`,
        d.culturalInsights?.length ? `- **Cultural insights**:\n${d.culturalInsights.map(ci => `  - ${ci}`).join('\n')}` : '',
      ];
      return parts.filter(Boolean).join('\n');
    }),
    structured.tips?.length ? `\n**General Travel Tips**\n- ${structured.tips.join('\n- ')}` : ''
  ].join('\n');

  return NextResponse.json({ json: structured, markdown: md });
}