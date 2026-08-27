/**
 * Directus Automated Setup Script (Schema + Permissions + Seed Data)
 * 
 * Run against your live Directus Container App or local instance:
 *   node backend/scripts/setup-directus.js
 */

const fs = require('fs');
const path = require('path');

const DIRECTUS_URL = process.env.DIRECTUS_URL || 'https://mchs-directus.livelyfield-d0a70609.eastus.azurecontainerapps.io';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@monroe-humane.org';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Directus-Mchs-2026-Kp7#';

async function main() {
  console.log(`🚀 Connecting to Directus at: ${DIRECTUS_URL}`);

  // 1. Authenticate as Admin
  let token = '';
  try {
    const authRes = await fetch(`${DIRECTUS_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
    });

    if (!authRes.ok) {
      const err = await authRes.text();
      throw new Error(`Admin login failed (${authRes.status}): ${err}`);
    }

    const authData = await authRes.json();
    token = authData.data.access_token;
    console.log('✅ Admin authenticated successfully.');
  } catch (err) {
    console.error('❌ Could not connect to Directus API:', err.message);
    console.error('👉 Make sure the Directus container is running and not in a cold start state.');
    process.exit(1);
  }

  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };

  // 2. Apply Collections & Fields Schema
  const schemaPath = path.join(__dirname, '..', 'schema', 'schema.json');
  if (fs.existsSync(schemaPath)) {
    console.log('📦 Applying collections schema from schema.json...');
    const schemaData = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));

    try {
      const applyRes = await fetch(`${DIRECTUS_URL}/schema/apply`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(schemaData),
      });

      if (applyRes.ok) {
        console.log('✅ Collections schema applied successfully.');
      } else {
        const text = await applyRes.text();
        console.warn(`⚠️ Schema apply response (${applyRes.status}): ${text}`);
      }
    } catch (err) {
      console.warn('⚠️ Schema apply error:', err.message);
    }
  }

  // 3. Configure Public Read Permissions
  console.log('🔐 Configuring Public Read permissions for frontend access...');
  const publicCollections = [
    'pets',
    'event_flyers',
    'memorial_tributes',
    'newsletter_issues',
    'testimonials',
    'membership_tiers',
    'site_settings',
    'directus_files',
  ];

  for (const col of publicCollections) {
    try {
      const permRes = await fetch(`${DIRECTUS_URL}/permissions`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          role: null, // null role = Public
          collection: col,
          action: 'read',
          fields: ['*'],
        }),
      });

      if (permRes.ok) {
        console.log(`   ✅ Public read granted: ${col}`);
      } else if (permRes.status === 400 || permRes.status === 409) {
        console.log(`   ℹ️ Public read already exists: ${col}`);
      } else {
        const text = await permRes.text();
        console.warn(`   ⚠️ Permission update for ${col} (${permRes.status}): ${text}`);
      }
    } catch (e) {
      console.warn(`   ⚠️ Permission network error for ${col}:`, e.message);
    }
  }

  // 4. Seed Site Settings if empty
  try {
    const settingsCheck = await fetch(`${DIRECTUS_URL}/items/site_settings/1`, { headers: authHeaders });
    if (!settingsCheck.ok) {
      console.log('🌱 Seeding initial site settings...');
      await fetch(`${DIRECTUS_URL}/items/site_settings`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          id: 1,
          adoptions_count: 539,
          return_to_owner_count: 53,
          intakes_count: 672,
          emergency_phone: '734-240-7700',
        }),
      });
      console.log('✅ Site settings seeded.');
    }
  } catch (e) {
    // Ignore if collection not ready
  }

  console.log('\n🎉 Directus setup and configuration complete!');
}

main().catch(console.error);
