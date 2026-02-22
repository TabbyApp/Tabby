/**
 * Supabase client for Realtime only (item_claims updates).
 * Requires VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in env.
 * If either is missing, createClient is not called and subscriptions are no-ops.
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabase: SupabaseClient | null =
  url && anonKey ? createClient(url, anonKey) : null;

export function isRealtimeAvailable(): boolean {
  return supabase != null;
}
