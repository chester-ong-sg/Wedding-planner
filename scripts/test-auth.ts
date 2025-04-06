import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { resolve } from 'path'

// Load environment variables from .env.local
dotenv.config({ path: resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing required environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function testAuth() {
  try {
    // Try to sign in with the test credentials
    const { data, error } = await supabase.auth.signInWithPassword({
      email: 'chesterongpeixuan@gmail.com',
      password: '1234',
    })

    if (error) {
      console.error('Authentication error:', error.message)
      return
    }

    console.log('Authentication successful!')
    console.log('User:', data.user)
    console.log('Session:', data.session)
  } catch (error) {
    console.error('Error:', error)
  }
}

testAuth() 