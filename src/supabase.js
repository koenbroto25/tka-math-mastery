import { createClient } from '@supabase/supabase-js'

// Mengambil URL dan Key dari file .env yang sudah kita buat
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Membuat jembatan koneksi
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

console.log("Supabase Client Berhasil Diinisialisasi!");