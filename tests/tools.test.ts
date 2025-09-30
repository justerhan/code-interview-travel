import { describe, it, expect } from 'vitest';
import { estimateTripCostUSD, getHotelSuggestions } from '@/lib/tools';

describe('estimateTripCostUSD', () => {
  it('uses mid comfort by default', () => {
    const cost = estimateTripCostUSD({ destination: 'Lisbon, Portugal', durationDays: 5 });
    expect(cost).toBe(700 + (5 - 1) * 150);
  });
  it('changes with comfort level', () => {
    const budget = estimateTripCostUSD({ destination: 'Lisbon, Portugal', durationDays: 5, comfort: 'budget' });
    const premium = estimateTripCostUSD({ destination: 'Lisbon, Portugal', durationDays: 5, comfort: 'premium' });
    expect(budget).toBeLessThan(premium);
  });
});

describe('getHotelSuggestions cache', () => {
  it('returns a cached result on subsequent calls with same key', () => {
    const first = getHotelSuggestions('Lisbon, Portugal', 'mid');
    const second = getHotelSuggestions('Lisbon, Portugal', 'mid');
    // Expect same contents
    expect(second).toEqual(first);
  });
});