import { createClient } from '@supabase/supabase-js'

// Mengambil URL dan Key dari file .env yang sudah kita buat
// Fallback ke hardcoded values jika env vars tidak tersedia di production (misal Vercel belum diset)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://wbtudvwiwbpqqyxlkfxg.supabase.co";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndidHVkdndpd2JwcXF5eGxrZnhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2OTUxNjcsImV4cCI6MjA4NzI3MTE2N30.pjLdHGtAIWnP3opKoFOhE_oRRIILCxhe7NxpFM_em88";

// Membuat jembatan koneksi
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

console.log("Supabase Client Berhasil Diinisialisasi!");