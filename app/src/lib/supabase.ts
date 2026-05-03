import { createClient } from "@supabase/supabase-js";

import { env } from "@/lib/env";

export const supabaseUrl = env.supabaseUrl;
export const supabaseAnonKey = env.supabaseAnonKey;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});