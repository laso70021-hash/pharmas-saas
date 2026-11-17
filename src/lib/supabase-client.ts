import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';

const url = import.meta.env['VITE_SUPABASE_URL'];
const key = import.meta.env['VITE_SUPABASE_PUBLISHABLE_KEY'];

if (!url || !key) {
  throw new Error('Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in .env before starting the app.');
}
if (key.startsWith('sb_secret_')) {
  throw new Error('VITE_SUPABASE_PUBLISHABLE_KEY must be a public Supabase key.');
}

// All browser data access shares this client. User sessions and RLS remain in effect.
export const supabase = createClient<Database>(url, key, {
  auth: { persistSession: true, autoRefreshToken: true },
});
