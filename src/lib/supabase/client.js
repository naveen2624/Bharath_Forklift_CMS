// LOCATION: src/lib/supabase/client.js
import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Single instance for the lifetime of the browser tab.
// Re-used across every page navigation — no reconnect cost.
let _client = null;

export function createClient() {
  if (_client) return _client;
  _client = createBrowserClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true, // store in localStorage — survives refresh
      detectSessionInUrl: true, // handle OAuth/magic-link redirects
      autoRefreshToken: true, // silent background token refresh
    },
  });
  return _client;
}

export const supabase = createClient();
