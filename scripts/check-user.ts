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

async function checkUser() {
  try {
    // Check if the user exists
    const { data, error } = await supabase.auth.admin.listUsers()
    
    if (error) {
      console.error('Error listing users:', error.message)
      return
    }
    
    const user = data.users.find(u => u.email === 'chesterongpeixuan@gmail.com')
    
    if (user) {
      console.log('User exists:', user)
    } else {
      console.log('User does not exist. Creating new user...')
      
      // Create a new user
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email: 'chesterongpeixuan@gmail.com',
        password: '1234',
        email_confirm: true
      })
      
      if (createError) {
        console.error('Error creating user:', createError.message)
        return
      }
      
      console.log('User created successfully:', newUser)
    }
  } catch (error) {
    console.error('Error:', error)
  }
}

checkUser() 