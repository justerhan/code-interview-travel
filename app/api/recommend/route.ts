import { NextRequest, NextResponse } from 'next/server';
import { openai, model } from '@/lib/llm';
import { type ParsedPreferences, type Recommendation } from '@/lib/schemas';
import { estimateTripCostUSD, getWeatherSummary, estimateFlightPriceUSD, getHotelSuggestions } from '@/lib/tools';
import { classify, taskFor, type FollowUpMode } from '@/lib/followups';
import { schemaFor } from '@/lib/modeSchemas';

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

  function funScoreFor(args: { place: string; weatherSummary?: string; activities?: (string | null)[] | null; hotels: { name: string; pricePerNight: number }[]; }): number {
    let score = 70;
    const w = (args.weatherSummary || '').toLowerCase();
    if (/(warm|sunny|breeze|pleasant)/.test(w)) score += 8;
    if (/(dry|low rain|limited rain)/.test(w)) score += 5;
    if (/(rain|cold|cool)/.test(w)) score -= 6;
    const acts = (args.activities || []).map(a => (a || '').toLowerCase());
    if (acts.some(a => /(nightlife|party|bars|music)/.test(a))) score += 8;
    if (acts.some(a => /(beach|swim|sun)/.test(a))) score += 6;
    if (acts.some(a => /(hiking|adventure|boat|sailing)/.test(a))) score += 4;
    if (args.hotels.some(h => h.pricePerNight > 250)) score += 2; // access to upscale venues
    return Math.max(0, Math.min(100, Math.round(score)));
  }
  function foodScoreFor(args: { place: string; activities?: (string | null)[] | null; hotels: { name: string; pricePerNight: number }[]; }): number {
    let score = 70;
    const acts = (args.activities || []).map(a => (a || '').toLowerCase());
    if (acts.some(a => /(food|cuisine|tapas|pasta|gelato|seafood|wine|market|bistro|restaurant|dining)/.test(a))) score += 10;
    if (acts.some(a => /(fine dining|michelin|tasting)/.test(a))) score += 6;
    if (args.hotels.some(h => h.pricePerNight > 250)) score += 2; // proximity to upscale dining
    return Math.max(0, Math.min(100, Math.round(score)));
  }

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
      const funScore = funScoreFor({ place, weatherSummary, activities: preferences.activities || null, hotels });
      const foodScore = foodScoreFor({ place, activities: preferences.activities || null, hotels });
      return { place, weatherSummary, estCostUsd, flightPrice, hotels, funScore, foodScore };
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
      "funScore"?: number,
      "foodScore"?: number,
      "culturalInsights"?: string[] (2-3 cultural tips, local customs, or insider knowledge),
      "why"?: string 
    }
  ],
  "tips"?: string[] (general travel tips for the region)
}

Context-handling directives (apply silently without changing output shape):
- Always read and consider the full conversation history provided.
- If the user refers to earlier context (e.g., "that idea"), resolve it using prior messages.
- If context is ambiguous or missing, ask briefly for clarification in a follow-up turn; for this turn, keep outputs constrained to known facts.
- Retain important details (names, preferences, goals) when generating reasoning, but only output fields defined by the schema.
- Keep responses concise and avoid repetition.

Meta self-check (internal only; do not include in output):
1) Did you use history and user preferences? 2) Did you avoid fabricating facts not in 'facts'? 3) Is the JSON valid and minimal for the requested mode?`;

  const facts = enriched.map((e, i) => 
    `#${i+1} ${e.place} | flightUSD=${e.flightPrice} | totalCostUSD=${e.estCostUsd} | weather='${e.weatherSummary}' | fun=${e.funScore} | food=${e.foodScore} | hotels=${JSON.stringify(e.hotels)}`
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
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: sys + (
        mode === 'climate' ? '\nInstruction: If the latest user turn asks about climate/weather, reply minimally with weatherSummary plus a one-sentence appeal per destination. Avoid flights, costs, hotels, extra tips.' :
        mode === 'costs' ? '\nInstruction: If the latest user turn asks about cost/budget, reply minimally with estCostUsd plus a one-sentence value note per destination. Avoid flights, hotels, weather, extra tips.' :
        mode === 'flights' ? '\nInstruction: If the latest user turn asks about flights, reply minimally with flightPriceUsd per destination. Avoid costs, hotels, weather, tips.' :
        mode === 'hotels' ? '\nInstruction: If the latest user turn asks about hotels, reply minimally with 1-2 hotel suggestions (name and pricePerNight) per destination. Avoid flights, costs, weather, generic tips.' :
        mode === 'highlights' ? '\nInstruction: If the latest user turn asks about highlights, reply minimally with 2-3 short highlights per destination. Avoid flights, costs, hotels, tips.' :
        mode === 'tips' ? '\nInstruction: If the latest user turn asks for tips/advice, reply minimally with 2-3 short tips per destination. Avoid flights, costs, hotels, weather.' :
        mode === 'fun' ? '\nInstruction: If the latest user turn asks which is most fun, reply minimally with funScore per destination (0-100) and a one-phrase reason. Rank descending.' :
        mode === 'food' ? '\nInstruction: If the latest user turn asks which has the best food, reply minimally with foodScore per destination (0-100) and a one-phrase cuisine reason. Rank descending.' :
        ''
      ) + `\nTone directive: Adopt a ${tone} tone in phrasings while keeping facts unchanged and schema-respecting. Examples — surfer: chill, upbeat, a bit playful; friendly: warm, approachable; formal: professional, neutral; concise: brief, to the point; enthusiastic: energetic, positive; luxury: refined, polished; adventure: bold, outdoorsy; 90s-daria: dry, sardonic, deadpan, a little over it; avoid exclamation points; hank-hill: polite Texan, plainspoken, mentions practicality.` },
      ...historyMessages,
      { role: 'user', content: user }
    ]
  });

  let structured: Recommendation;
  try {
    const raw = completion.choices[0]?.message?.content || '{}';
    const obj = JSON.parse(raw);
    structured = schemaFor(mode).parse(obj) as Recommendation;
  } catch (e: any) {
    const msg = typeof e?.message === 'string' ? e.message : 'Parse error';
    const md = `**Sorry** — I had trouble understanding the results.\n- Error: ${msg}\n- Please try rephrasing your request or asking again.`;
    return NextResponse.json({ json: { destinations: [], tips: [] }, markdown: md });
  }

  // Normalize structured data: ensure arrays, clamp scores, dedupe highlights
  structured.destinations = (structured.destinations || []).map((d) => {
    const highlights = Array.from(new Set((d.highlights || []).map((s) => (s || '').trim()).filter(Boolean)));
    const hotels = (d.hotels || []).filter(h => h && typeof h.name === 'string' && typeof h.pricePerNight === 'number');
    const clamp = (n?: number) => typeof n === 'number' ? Math.max(0, Math.min(100, Math.round(n))) : undefined;
    return {
      ...d,
      highlights,
      hotels,
      funScore: clamp(d.funScore),
      foodScore: clamp((d as any).foodScore),
      culturalInsights: (d.culturalInsights || []).filter(Boolean),
    };
  });

  const md = (() => {
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
        bits.push(`you're aiming for a ${preferences.destinationType.toLowerCase()} vibe in ${preferences.region}`);
      } else if (preferences.region) {
        bits.push(`you're considering ${preferences.region}`);
      } else if (preferences.destinationType) {
        bits.push(`you'd like a ${preferences.destinationType.toLowerCase()} destination`);
      }
      if (preferences.month) bits.push(`around ${preferences.month}`);
      if (typeof preferences.durationDays === 'number') bits.push(`for about ${preferences.durationDays} day${preferences.durationDays === 1 ? '' : 's'}`);
      if (typeof preferences.budgetUsd === 'number') bits.push(`with a total budget near $${preferences.budgetUsd.toLocaleString()}`);
      if (preferences.activities?.length) bits.push(`and you're into ${preferences.activities.slice(0, 3).join(', ')}`);
      if (!bits.length) return '';
      const base = `${toneLead} ${bits.join(', ')}. Here are tailored picks:`;
      return tone === '90s-daria' ? `${base} (try to contain your excitement)` : base;
    })();
    const label = (d: Recommendation['destinations'][number]) => d.country ? `${d.name}, ${d.country}` : d.name;
    const aggregateActivities = mode === 'highlights' && /\b(best|top)\b/i.test(lastUser?.content || '');
    const aggregatedActivities: string[] = aggregateActivities
      ? Array.from(
          new Set(
            (structured.destinations || [])
              .flatMap(d => (d.highlights || []))
              .map(s => (s || '').trim())
              .filter(Boolean)
          )
        ).slice(0, 15)
      : [];
    switch (mode) {
      case 'food':
        return [
          `**Food rating (0–100)**`,
          ...[...structured.destinations]
            .map(d => ({ name: label(d), score: d.foodScore, why: d.why }))
            .sort((a, b) => (b.score ?? -1) - (a.score ?? -1))
            .map(x => `- ${x.name}: ${typeof x.score === 'number' ? x.score : '—'}${x.why ? ` — ${x.why}` : ''}`)
        ].join('\n');
      case 'fun':
        return [
          `**Fun rating (0–100)**`,
          ...[...structured.destinations]
            .map(d => ({ name: label(d), score: typeof d.funScore === 'number' ? d.funScore : undefined, why: d.why }))
            .sort((a, b) => (b.score ?? -1) - (a.score ?? -1))
            .map(x => `- ${x.name}: ${typeof x.score === 'number' ? x.score : '—'}${x.why ? ` — ${x.why}` : ''}`)
        ].join('\n');
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
        if (aggregateActivities) {
          return [
            `**Best activities**`,
            ...aggregatedActivities.map(a => `- ${a}`)
          ].join('\n');
        }
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
          recap && `${recap}`,
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