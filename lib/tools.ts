export type LatLng = { lat: number; lng: number };

const COORDS: Record<string, LatLng> = {
  'Lisbon, Portugal': { lat: 38.7223, lng: -9.1393 },
  'Canary Islands, Spain': { lat: 28.2916, lng: -16.6291 },
  'Crete, Greece': { lat: 35.2401, lng: 24.8093 },
  'Nice, France': { lat: 43.7102, lng: 7.2620 },
};

export async function getWeatherSummary(place: string, month?: string): Promise<string> {
  const coords = COORDS[place];
  const monthHint = month ? ` in ${month}` : '';
  if (!process.env.WEATHER_API_BASE || !coords) {
    return `Typically mild to warm${monthHint}; expect 65–80°F, low rain.`;
  }
  try {
    const url = `${process.env.WEATHER_API_BASE}?latitude=${coords.lat}&longitude=${coords.lng}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&forecast_days=7&timezone=auto`;
    const res = await fetch(url, { next: { revalidate: 3600 } as any });
    const data = await res.json();
    const highs: number[] = data?.daily?.temperature_2m_max || [];
    const lows: number[] = data?.daily?.temperature_2m_min || [];
    const precip: number[] = data?.daily?.precipitation_sum || [];
    const avgHigh = highs.reduce((a: number, b: number) => a + b, 0) / (highs.length || 1);
    const avgLow = lows.reduce((a: number, b: number) => a + b, 0) / (lows.length || 1);
    const avgPrecip = precip.reduce((a: number, b: number) => a + b, 0) / (precip.length || 1);
    return `Avg highs ${avgHigh.toFixed(0)}°F / lows ${avgLow.toFixed(0)}°F; precipitation ${avgPrecip.toFixed(1)}mm/day.`;
  } catch {
    return `Seasonal: pleasant${monthHint}, moderate temps, limited rain.`;
  }
}

export function estimateTripCostUSD(opts: {
  origin?: string;
  destination: string;
  durationDays?: number | null;
  comfort?: 'budget' | 'mid' | 'premium';
}): number {
  const baseFlight = 700; // crude EU roundtrip proxy
  const nightly: Record<string, number> = { budget: 80, mid: 150, premium: 300 };
  const nights = Math.max(1, (opts.durationDays || 5) - 1);
  return baseFlight + nights * (nightly[opts.comfort || 'mid']);
}