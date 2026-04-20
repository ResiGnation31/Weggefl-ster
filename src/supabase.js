import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://rlsvphrdzmgweuwjcdye.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJsc3ZwaHJkem1nd2V1d2pjZHllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2NzU0NDQsImV4cCI6MjA5MjI1MTQ0NH0.crKhFem1abqDTa9f4osYC8TdkjkYjSMMF7APC8ewy8A'

export const supabase = createClient(supabaseUrl, supabaseKey)
