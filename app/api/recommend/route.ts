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
      "country"?: string, 
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
  const lastUser = Array.isArray(history) ? [...history].reverse().find(m => m.role === 'user') : undefined;
  type FollowUpMode = 'none' | 'climate' | 'costs' | 'flights' | 'hotels' | 'highlights' | 'tips';
  const classify = (content?: string): FollowUpMode => {
    if (!content) return 'none';
    const c = content.toLowerCase();
    if (/(climate|weather|temperature)/i.test(c)) return 'climate';
    if (/(cost|price|budget|how much|estimate)/i.test(c)) return 'costs';
    if (/(flight|airfare|plane|airline)/i.test(c)) return 'flights';
    if (/(hotel|stay|accommodation)/i.test(c)) return 'hotels';
    if (/(highlight|what to do|things to do|must[- ]see|attraction)/i.test(c)) return 'highlights';
    if (/(tip|advice|insight|etiquette|safety)/i.test(c)) return 'tips';
    return 'none';
  };
  const mode: FollowUpMode = classify(lastUser?.content);
  const taskMap: Record<FollowUpMode, string> = {
    none: 'Return well-rounded recommendations.',
    climate: 'Return concise climate summary per destination only.',
    costs: 'Return concise total cost estimate per destination only.',
    flights: 'Return concise flight price per destination only.',
    hotels: 'Return 1-2 concise hotel suggestions (name + pricePerNight) per destination only.',
    highlights: 'Return 2-3 concise activity highlights per destination only.',
    tips: 'Return 2-3 concise travel/cultural tips per destination only.'
  };
  const user = `User preferences: ${JSON.stringify(preferences)}\n\nFacts to include exactly as given (do not alter numbers):\n${facts}\n\nTask: ${taskMap[mode]}`;

  const historyMessages = Array.isArray(history)
    ? history.map((m) => ({ role: m.role, content: m.content }))
    : [];

  const completion = await openai.chat.completions.create({
    model: model().name,
    temperature: 0.4,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: sys + (
        mode === 'climate' ? '\nInstruction: If the latest user turn asks about climate/weather, reply minimally with weatherSummary plus a one-sentence appeal per destination. Avoid flights, costs, hotels, extra tips.' :
        mode === 'costs' ? '\nInstruction: If the latest user turn asks about cost/budget, reply minimally with estCostUsd plus a one-sentence value note per destination. Avoid flights, hotels, weather, extra tips.' :
        mode === 'flights' ? '\nInstruction: If the latest user turn asks about flights, reply minimally with flightPriceUsd per destination. Avoid costs, hotels, weather, tips.' :
        mode === 'hotels' ? '\nInstruction: If the latest user turn asks about hotels, reply minimally with 1-2 hotel suggestions (name and pricePerNight) per destination. Avoid flights, costs, weather, generic tips.' :
        mode === 'highlights' ? '\nInstruction: If the latest user turn asks about highlights, reply minimally with 2-3 short highlights per destination. Avoid flights, costs, hotels, tips.' :
        mode === 'tips' ? '\nInstruction: If the latest user turn asks for tips/advice, reply minimally with 2-3 short tips per destination. Avoid flights, costs, hotels, weather.' :
        ''
      ) },
      ...historyMessages,
      { role: 'user', content: user }
    ]
  });

  const obj = JSON.parse(completion.choices[0]?.message?.content || '{}');
  const structured = recommendationSchema.parse(obj);

  const md = (() => {
    const label = (d: any) => d.country ? `${d.name}, ${d.country}` : d.name;
    switch (mode) {
      case 'climate':
        return [
          `**Climate overview**`,
          ...structured.destinations.map((d) => {
            const appeal = d.why || (d.highlights?.[0] ? `Appeal: ${d.highlights[0]}` : '');
            return `- ${label(d)}: ${d.weatherSummary || '—'}${appeal ? ` — ${appeal}` : ''}`;
          }),
        ].join('\n');
      case 'costs':
        return [
          `**Estimated total costs**`,
          ...structured.destinations.map((d) => `- ${label(d)}: $${d.estCostUsd?.toLocaleString() || '—'}`),
        ].join('\n');
      case 'flights':
        return [
          `**Estimated flight prices (roundtrip)**`,
          ...structured.destinations.map((d) => `- ${label(d)}: $${d.flightPriceUsd?.toLocaleString() || '—'}`),
        ].join('\n');
      case 'hotels':
        return [
          `**Hotel suggestions**`,
          ...structured.destinations.map((d) => {
            const list = (d.hotels || []).slice(0, 2).map(h => `  - ${h.name} ($${h.pricePerNight}/night)`).join('\n');
            return `- ${label(d)}:\n${list || '  - —'}`;
          }),
        ].join('\n');
      case 'highlights':
        return [
          `**Activity highlights**`,
          ...structured.destinations.map((d) => `- ${label(d)}: ${(d.highlights || []).slice(0,3).join(', ') || '—'}`),
        ].join('\n');
      case 'tips':
        return [
          `**Travel tips**`,
          ...structured.destinations.map((d) => `- ${label(d)}: ${(d.culturalInsights || structured.tips || []).slice(0,3).join('; ') || '—'}`),
        ].join('\n');
      default:
        return [
          `**Top picks** (based on your prefs):`,
          ...structured.destinations.map((d) => {
            const parts = [
              `\n### ${label(d)}`,
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
    }
  })();

  return NextResponse.json({ json: structured, markdown: md });
}