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

const funSchema = base.superRefine((obj, ctx) => {
  const dests = (obj as any).destinations || [];
  if (dests.length > 0 && !dests.some((d: any) => typeof d.funScore !== 'undefined')) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'At least one destination should include funScore' });
  }
});
const foodSchema = base.superRefine((obj, ctx) => {
  const dests = (obj as any).destinations || [];
  if (dests.length > 0 && !dests.some((d: any) => typeof d.foodScore !== 'undefined')) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'At least one destination should include foodScore' });
  }
});
const highlightsSchema = base
  .refine(
    (obj) => (obj.destinations || []).length === 0 || (obj.destinations || []).some((d) => Array.isArray(d.highlights) && d.highlights.length > 0),
    { message: 'At least one destination should include highlights when present' }
  );
const climateSchema = base
  .refine(
    (obj) => (obj.destinations || []).length === 0 || (obj.destinations || []).some((d) => typeof d.weatherSummary === 'string' && d.weatherSummary.length > 0),
    { message: 'At least one destination should include weatherSummary when present' }
  );
const costsSchema = base
  .refine(
    (obj) => (obj.destinations || []).length === 0 || (obj.destinations || []).some((d) => typeof d.estCostUsd === 'number'),
    { message: 'At least one destination should include estCostUsd when present' }
  );
const flightsSchema = base
  .refine(
    (obj) => (obj.destinations || []).length === 0 || (obj.destinations || []).some((d) => typeof d.flightPriceUsd === 'number'),
    { message: 'At least one destination should include flightPriceUsd when present' }
  );
const hotelsSchema = base
  .refine(
    (obj) => (obj.destinations || []).length === 0 || (obj.destinations || []).some((d) => Array.isArray(d.hotels) && d.hotels.length > 0),
    { message: 'At least one destination should include hotels when present' }
  );
const tipsSchema = base
  .refine(
    (obj) => Array.isArray((obj as any).tips) || (obj.destinations || []).some((d) => Array.isArray(d.culturalInsights) && d.culturalInsights.length > 0) || (obj.destinations || []).length === 0,
    { message: 'Provide tips or culturalInsights for at least one destination when present' }
  );

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
