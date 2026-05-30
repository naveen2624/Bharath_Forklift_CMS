import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Singleton — one client instance for the entire browser session
let _client = null;

export function createClient() {
  if (_client) return _client;
  _client = createBrowserClient(supabaseUrl, supabaseAnonKey);
  return _client;
}

// Named export alias used by some files
export const supabase = createClient();
