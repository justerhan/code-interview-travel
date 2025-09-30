import { describe, it, expect } from 'vitest';
import { classify } from '@/lib/followups';

describe('followups.classify', () => {
  it('detects climate', () => {
    expect(classify('What is the weather like?')).toBe('climate');
  });
  it('detects costs', () => {
    expect(classify('What would it cost?')).toBe('costs');
  });
  it('detects flights', () => {
    expect(classify('flight prices')).toBe('flights');
  });
  it('detects hotels', () => {
    expect(classify('best hotels to stay')).toBe('hotels');
  });
  it('detects highlights', () => {
    expect(classify('top highlights and attractions')).toBe('highlights');
  });
  it('detects tips', () => {
    expect(classify('any travel tips?')).toBe('tips');
  });
  it('detects fun', () => {
    expect(classify('which is the most fun?')).toBe('fun');
  });
  it('detects food', () => {
    expect(classify('which one has the best food?')).toBe('food');
  });
  it('falls back to none', () => {
    expect(classify('hello world')).toBe('none');
  });
});
