const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../chatai-backend/.env') });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function createTestUsers() {
  const users = [
    { email: 'test_user_1@chatbolt.ai', password: 'Password123!', name: 'Test User One' },
    { email: 'test_user_2@chatbolt.ai', password: 'Password123!', name: 'Test User Two' },
    { email: 'test_user_3@chatbolt.ai', password: 'Password123!', name: 'Test User Three' },
  ];

  for (const u of users) {
    console.log(`Creating user: ${u.email}...`);
    const { data, error } = await supabase.auth.admin.createUser({
      email: u.email,
      password: u.password,
      email_confirm: true,
      user_metadata: { full_name: u.name }
    });

    if (error) {
      console.error(`Error creating ${u.email}:`, error.message);
    } else {
      console.log(`Successfully created ${u.email}`);
    }
  }
}

createTestUsers();
