import { createClient } from '@supabase/supabase-js'
import type { Database } from './tipos'
import { env } from './env'

export const supabase = createClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
  auth: { persistSession: true, autoRefreshToken: true },
})
