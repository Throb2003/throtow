const NAIROBI_DEFAULT_LAT = -1.286389;
const NAIROBI_DEFAULT_LNG = 36.817223;

const parseNumber = (value: string | undefined, fallback: number) => {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const requireEnv = (value: string | undefined, name: string) => {
  const normalized = value?.trim();

  if (!normalized) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return normalized;
};

const supabaseUrl = requireEnv(import.meta.env.VITE_SUPABASE_URL, "VITE_SUPABASE_URL");
const supabaseAnonKey = requireEnv(
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  "VITE_SUPABASE_ANON_KEY",
);

export const env = {
  supabaseUrl,
  supabaseAnonKey,
  supabaseFunctionsUrl:
    import.meta.env.VITE_SUPABASE_FUNCTIONS_URL?.trim() || `${supabaseUrl}/functions/v1`,
  mapDefaultLat: parseNumber(import.meta.env.VITE_MAP_DEFAULT_LAT, NAIROBI_DEFAULT_LAT),
  mapDefaultLng: parseNumber(import.meta.env.VITE_MAP_DEFAULT_LNG, NAIROBI_DEFAULT_LNG),
};