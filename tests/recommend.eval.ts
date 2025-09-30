import { describe, it, expect } from 'vitest';
import { recommendationSchema } from '@/lib/schemas';

describe('recommendationSchema', () => {
  it('validates shape and requires 1+ destinations', () => {
    const sample = {
      destinations: [
        { name: 'Lisbon', country: 'Portugal', estCostUsd: 1500, weatherSummary: 'Sunny', highlights: ['food', 'beaches'] },
        { name: 'Crete', country: 'Greece', estCostUsd: 1700, weatherSummary: 'Warm', highlights: ['hikes'] },
      ],
      tips: ['Pack light']
    };
    const parsed = recommendationSchema.parse(sample);
    expect(parsed.destinations.length).toBeGreaterThanOrEqual(2);
  });
});