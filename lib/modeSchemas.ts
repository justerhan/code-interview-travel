import { z } from 'zod';
import { recommendationSchema } from '@/lib/schemas';
import type { FollowUpMode } from '@/lib/followups';

const base = recommendationSchema;

// Helper to ensure when destinations exist, a particular key is present (or allow empty destinations)
function requireKeyWhenDestinations<K extends string>(key: K) {
  return z
    .object({ destinations: z.array(z.object({ [key]: z.any().optional() })).default([]) })
    .passthrough()
    .refine(
      (obj) => (obj.destinations || []).length === 0 || (obj.destinations || []).some((d: any) => key in d),
      { message: `At least one destination should include ${key}` }
    );
}

const funSchema = base.merge(requireKeyWhenDestinations('funScore'));
const foodSchema = base.merge(requireKeyWhenDestinations('foodScore'));
const highlightsSchema = base; // already has highlights defaulted
const climateSchema = base; // uses weatherSummary
const costsSchema = base; // estCostUsd
const flightsSchema = base; // flightPriceUsd
const hotelsSchema = base; // hotels
const tipsSchema = base; // culturalInsights or tips

export function schemaFor(mode: FollowUpMode) {
  switch (mode) {
    case 'fun':
      return funSchema;
    case 'food':
      return foodSchema;
    case 'highlights':
      return highlightsSchema;
    case 'climate':
      return climateSchema;
    case 'costs':
      return costsSchema;
    case 'flights':
      return flightsSchema;
    case 'hotels':
      return hotelsSchema;
    case 'tips':
      return tipsSchema;
    default:
      return base;
  }
}
