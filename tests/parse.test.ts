import { describe, it, expect } from 'vitest';
import { parsedPreferencesSchema } from '@/lib/schemas';

describe('parsedPreferencesSchema', () => {
  it('accepts a typical parsed object', () => {
    const obj = {
      region: 'Europe',
      destinationType: 'beach',
      budgetUsd: 2000,
      durationDays: 5,
      month: 'May',
      activities: ['food', 'adventure'],
      weather: 'warm'
    };
    expect(() => parsedPreferencesSchema.parse(obj)).not.toThrow();
  });

  it('allows minimal object', () => {
    const obj = {};
    expect(() => parsedPreferencesSchema.parse(obj)).not.toThrow();
  });
});