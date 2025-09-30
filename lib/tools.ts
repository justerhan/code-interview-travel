export type LatLng = { lat: number; lng: number };
export type Hotel = { name: string; pricePerNight: number; rating?: number; type?: string };

// Simple in-memory TTL cache (per serverless instance)
const cache = new Map<string, { value: any; exp: number }>();
function setCache(key: string, value: any, ttlSec: number) {
  cache.set(key, { value, exp: Date.now() + ttlSec * 1000 });
}
function getCache<T = any>(key: string): T | undefined {
  const hit = cache.get(key);
  if (!hit) return undefined;
  if (Date.now() > hit.exp) { cache.delete(key); return undefined; }
  return hit.value as T;
}

const COORDS: Record<string, LatLng> = {
  'Lisbon, Portugal': { lat: 38.7223, lng: -9.1393 },
  'Canary Islands, Spain': { lat: 28.2916, lng: -16.6291 },
  'Crete, Greece': { lat: 35.2401, lng: 24.8093 },
  'Nice, France': { lat: 43.7102, lng: 7.2620 },
};

export async function getWeatherSummary(place: string, month?: string): Promise<string> {
  const cacheKey = `weather:${place}:${month || ''}`;
  const cached = getCache<string>(cacheKey);
  if (cached) return cached;
  const coords = COORDS[place];
  const monthHint = month ? ` in ${month}` : '';
  if (!process.env.WEATHER_API_BASE || !coords) {
    const fallback = `Typically mild to warm${monthHint}; expect 65–80°F, low rain.`;
    setCache(cacheKey, fallback, 12 * 3600);
    return fallback;
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
    const summary = `Avg highs ${avgHigh.toFixed(0)}°F / lows ${avgLow.toFixed(0)}°F; precipitation ${avgPrecip.toFixed(1)}mm/day.`;
    setCache(cacheKey, summary, 3600); // 1h
    return summary;
  } catch {
    const fallback = `Seasonal: pleasant${monthHint}, moderate temps, limited rain.`;
    setCache(cacheKey, fallback, 3600);
    return fallback;
  }
}

export function estimateFlightPriceUSD(opts: {
  origin?: string;
  destination: string;
  month?: string | null;
}): number {
  // Base roundtrip flight prices from US to European destinations
  const basePrice = 700;
  
  // Seasonal multipliers
  const peakMonths = ['june', 'july', 'august', 'december'];
  const shoulderMonths = ['april', 'may', 'september', 'october'];
  const monthLower = (opts.month || '').toLowerCase();
  
  let multiplier = 1.0; // off-season
  if (peakMonths.some(m => monthLower.includes(m))) {
    multiplier = 1.4; // peak season
  } else if (shoulderMonths.some(m => monthLower.includes(m))) {
    multiplier = 1.15; // shoulder season
  }
  
  return Math.round(basePrice * multiplier);
}

export function estimateTripCostUSD(opts: {
  origin?: string;
  destination: string;
  durationDays?: number | null;
  comfort?: 'budget' | 'mid' | 'premium';
  flightPrice?: number;
}): number {
  const flight = opts.flightPrice || 700;
  const nightly: Record<string, number> = { budget: 80, mid: 150, premium: 300 };
  const nights = Math.max(1, (opts.durationDays || 5) - 1);
  return flight + nights * (nightly[opts.comfort || 'mid']);
}
export function getHotelSuggestions(destination: string, comfort: 'budget' | 'mid' | 'premium' = 'mid'): Hotel[] {
  const cacheKey = `hotels:${destination}:${comfort}`;
  const cached = getCache<Hotel[]>(cacheKey);
  if (cached) return cached;
  const hotelsByDestination: Record<string, Hotel[]> = {
    'Lisbon, Portugal': [
      { name: 'My Story Hotel Rossio', pricePerNight: 120, rating: 4.3, type: 'Boutique Hotel' },
      { name: 'Hotel Avenida Palace', pricePerNight: 180, rating: 4.5, type: 'Historic Luxury' },
      { name: 'The Lumiares Hotel & Spa', pricePerNight: 250, rating: 4.7, type: 'Luxury Spa' },
    ],
    'Canary Islands, Spain': [
      { name: 'Hotel Riu Palace Oasis', pricePerNight: 140, rating: 4.4, type: 'Beach Resort' },
      { name: 'Seaside Grand Hotel Residencia', pricePerNight: 280, rating: 4.8, type: 'Luxury Resort' },
      { name: 'Parque Tropical', pricePerNight: 95, rating: 4.1, type: 'Budget Beach Hotel' },
    ],
    'Crete, Greece': [
      { name: 'Blue Palace Resort', pricePerNight: 320, rating: 4.8, type: 'Luxury Beach Resort' },
      { name: 'Aquila Atlantis Hotel', pricePerNight: 150, rating: 4.3, type: 'City Hotel' },
      { name: 'Olive Green Hotel', pricePerNight: 110, rating: 4.2, type: 'Eco-Friendly' },
    ],
    'Nice, France': [
      { name: 'Hotel Negresco', pricePerNight: 350, rating: 4.6, type: 'Historic Luxury' },
      { name: 'Hyatt Regency Nice Palais', pricePerNight: 200, rating: 4.5, type: 'Modern Luxury' },
      { name: 'Hotel Aston La Scala', pricePerNight: 130, rating: 4.2, type: 'Mid-Range' },
    ],
  };

  const hotels: Hotel[] = hotelsByDestination[destination] || [];

  let result: Hotel[];
  if (comfort === 'budget') {
    result = hotels.filter(h => h.pricePerNight < 150).slice(0, 2);
  } else if (comfort === 'premium') {
    result = hotels.filter(h => h.pricePerNight > 200).slice(0, 2);
  } else {
    result = hotels.filter(h => h.pricePerNight >= 100 && h.pricePerNight <= 250).slice(0, 2);
  }
  result = result.map(h => ({ ...h, name: h.name.charAt(0).toUpperCase() + h.name.slice(1) }));
  setCache(cacheKey, result, 6 * 3600);
  return result;
}