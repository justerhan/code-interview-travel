import { z } from 'zod';

export const parsedPreferencesSchema = z.object({
  region: z.string().nullable().optional(),
  destinationType: z.string().nullable().optional(),
  budgetUsd: z.number().nullable().optional(),
  durationDays: z.number().nullable().optional(),
  month: z.string().nullable().optional(),
  dates: z
    .object({ start: z.string().optional(), end: z.string().optional() })
    .nullable()
    .optional(),
  activities: z.array(z.string()).nullable().optional(),
  weather: z.string().nullable().optional(),
});
export type ParsedPreferences = z.infer<typeof parsedPreferencesSchema>;

export const recommendationSchema = z.object({
  destinations: z.array(
    z.object({
      name: z.string(),
      country: z.string().optional(),
      bestMonth: z.string().optional(),
      bestTimeToVisit: z.string().optional(),
      estCostUsd: z.number().optional(),
      flightPriceUsd: z.number().optional(),
      weatherSummary: z.string().optional(),
      highlights: z.array(z.string()).default([]),
      funScore: z.number().optional(),
      hotels: z.array(
        z.object({
          name: z.string(),
          pricePerNight: z.number(),
          rating: z.number().optional(),
          type: z.string().optional(),
        })
      ).optional(),
      culturalInsights: z.array(z.string()).optional(),
      why: z.string().optional(),
    })
  ).default([]),
  tips: z.array(z.string()).optional(),
});
export type Recommendation = z.infer<typeof recommendationSchema>;