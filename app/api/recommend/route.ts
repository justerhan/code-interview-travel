import { NextRequest, NextResponse } from 'next/server';
import { openai, model } from '@/lib/llm';
import { type ParsedPreferences, recommendationSchema } from '@/lib/schemas';
import { estimateTripCostUSD, getWeatherSummary } from '@/lib/tools';

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
  const { preferences } = (await req.json()) as { preferences: ParsedPreferences };
  const picks = candidateDestinations(preferences);

  const enriched = await Promise.all(
    picks.map(async (d) => {
      const place = `${d.name}, ${d.country}`;
      const weatherSummary = await getWeatherSummary(place, preferences.month);
      const estCostUsd = estimateTripCostUSD({ destination: place, durationDays: preferences.durationDays, comfort: 'mid' });
      return { place, weatherSummary, estCostUsd };
    })
  );

  const sys = `You are a concise travel recommender. Use provided facts; avoid fabrications.
Output JSON ONLY with this schema:
{
  "destinations": [
    { "name": string, "country": string, "bestMonth"?: string, "estCostUsd"?: number, "weatherSummary"?: string, "highlights": string[], "why"?: string }
  ],
  "tips"?: string[]
}`;

  const facts = enriched.map((e, i) => `#${i+1} ${e.place} | costUSD=${e.estCostUsd} | weather='${e.weatherSummary}'`).join('\n');
  const user = `User preferences: ${JSON.stringify(preferences)}\n\nFacts to include exactly as given (do not alter numbers):\n${facts}`;

  const completion = await openai.chat.completions.create({
    model: model().name,
    temperature: 0.4,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: sys },
      { role: 'user', content: user }
    ]
  });

  const obj = JSON.parse(completion.choices[0]?.message?.content || '{}');
  const structured = recommendationSchema.parse(obj);

  const md = [
    `**Top picks** (based on your prefs):`,
    ...structured.destinations.map((d) => `\n### ${d.name}, ${d.country}\n- **Why**: ${d.why || 'Great fit for your stated interests and weather prefs.'}\n- **Weather**: ${d.weatherSummary || '—'}\n- **Est. total**: $${d.estCostUsd?.toLocaleString() || '—'}\n- **Highlights**: ${d.highlights.join(', ') || '—'}\n${d.bestMonth ? `- **Best month**: ${d.bestMonth}` : ''}`),
    structured.tips?.length ? `\n**Tips**\n- ${structured.tips.join('\n- ')}` : ''
  ].join('\n');

  return NextResponse.json({ json: structured, markdown: md });
}