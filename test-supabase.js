const { createClient } = require('@supabase/supabase-js')

const url = 'https://ciekeqmpxvknrltesccr.supabase.co'
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNpZWtlcW1weHZrbnJsdGVzY2NyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODczNzM0OCwiZXhwIjoyMDk0MzEzMzQ4fQ.na7uxdx6ALkUlxbYbTDMILM2-gvMsKn9XrvQfmjd-4g'

const supabase = createClient(url, key)

async function test() {
  const { data, error } = await supabase.auth.admin.createUser({
    email: 'test@chatbolt.io',
    password: 'password123',
    email_confirm: true
  })
  
  if (error) {
    console.error('Error:', error)
  } else {
    console.log('Success:', data.user.id)
  }
}

test()
