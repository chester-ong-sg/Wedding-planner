import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { resolve } from 'path'

// Load environment variables from .env.local
dotenv.config({ path: resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function updatePassword() {
  try {
    // Reset the password which will send a reset password email
    const { data, error } = await supabase.auth.resetPasswordForEmail(
      'chesterongpeixuan@gmail.com',
      {
        redirectTo: `${supabaseUrl}/auth/v1/callback`
      }
    )

    if (error) {
      console.error('Error sending reset password email:', error.message)
      return
    }

    console.log('Password reset email sent successfully. Please check your email to reset the password to "1234".')
  } catch (error) {
    console.error('Error:', error)
  }
}

updatePassword() 