import { createClient } from '@supabase/supabase-js'
const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
export const isSupabaseConfigured = Boolean(url && key)
if (!isSupabaseConfigured && !import.meta.env.DEV) throw new Error('Supabase environment variables are required')
export const supabase = createClient(url || 'https://placeholder.invalid', key || 'placeholder', { auth: { persistSession:true, autoRefreshToken:true, detectSessionInUrl:true } })
