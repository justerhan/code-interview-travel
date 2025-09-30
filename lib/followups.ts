export type FollowUpMode = 'none' | 'climate' | 'costs' | 'flights' | 'hotels' | 'highlights' | 'tips' | 'fun' | 'food';

const patterns: Array<{ mode: FollowUpMode; re: RegExp }> = [
  { mode: 'climate', re: /(climate|weather|temperature)/i },
  // Check flights before costs so phrases like "flight prices" classify as flights
  { mode: 'flights', re: /(flight|airfare|plane|airline)/i },
  { mode: 'costs', re: /(cost|price|budget|how much|estimate)/i },
  { mode: 'hotels', re: /(hotel|stay|accommodation)/i },
  { mode: 'highlights', re: /(highlight|what to do|things to do|must[- ]see|attraction|activities|best activities)/i },
  { mode: 'tips', re: /(tip|advice|insight|etiquette|safety)/i },
  { mode: 'fun', re: /(fun|most fun|lively|vibe|party)/i },
  { mode: 'food', re: /(best food|food scene|cuisine|restaurants?|dining|eat)/i },
];

export function classify(content?: string): FollowUpMode {
  if (!content) return 'none';
  const c = content.toLowerCase();
  for (const p of patterns) {
    if (p.re.test(c)) return p.mode;
  }
  return 'none';
}

export const taskFor: Record<FollowUpMode, string> = {
  none: 'Return well-rounded recommendations.',
  climate: 'Return concise climate summary per destination only.',
  costs: 'Return concise total cost estimate per destination only.',
  flights: 'Return concise flight price per destination only.',
  hotels: 'Return 1-2 concise hotel suggestions (name + pricePerNight) per destination only.',
  highlights: 'Return 2-3 concise activity highlights per destination only.',
  tips: 'Return 2-3 concise travel/cultural tips per destination only.',
  fun: 'Return concise fun rating per destination only (0-100).',
  food: 'Return concise food rating per destination only (0-100).',
};
