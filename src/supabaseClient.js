import { createClient } from '@supabase/supabase-js'

// Temporarily hardcoded for testing - replace with env vars once working
const supabaseUrl = 'https://pceciiplmyqdefrjfnbr.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBjZWNpaXBsbXlxZGVmcmpmbmJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyODUzMjIsImV4cCI6MjA4OTg2MTMyMn0.YepCSbidqjPNymVnqyA-PDLuBSXEHuHTvZ5tUZKAYl8'

console.log('Supabase URL:', supabaseUrl)
console.log('Supabase Key exists:', !!supabaseAnonKey)

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
