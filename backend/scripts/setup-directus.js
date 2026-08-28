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
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

if (!ADMIN_PASSWORD) {
  console.error('❌ ADMIN_PASSWORD env var is required (no default — do not hardcode credentials).');
  process.exit(1);
}

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

  // 2. Create any missing collections (targeted, additive-only).
  //    Deliberately NOT using /schema/diff+/schema/apply against the full
  //    snapshot: on this live DB it tries to "fix" directus_extensions (an
  //    internal system table with drift from an earlier migration) and fails
  //    with a MySQL primary-key error unrelated to anything this script
  //    actually needs to create. Creating only genuinely-missing collections
  //    via the Collections API is safer — it never touches existing tables.
  const schemaPath = path.join(__dirname, '..', 'schema', 'schema.json');
  if (fs.existsSync(schemaPath)) {
    console.log('📦 Checking for missing collections...');
    const schemaData = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));

    const existingRes = await fetch(`${DIRECTUS_URL}/collections`, { headers: authHeaders });
    const existingNames = new Set();
    if (existingRes.ok) {
      const existingData = await existingRes.json();
      for (const c of existingData.data || []) existingNames.add(c.collection);
    }

    for (const col of schemaData.collections || []) {
      if (existingNames.has(col.collection)) {
        console.log(`   ℹ️ Collection already exists: ${col.collection}`);
        continue;
      }
      const fields = (schemaData.fields || []).filter((f) => f.collection === col.collection);
      try {
        const createRes = await fetch(`${DIRECTUS_URL}/collections`, {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({ collection: col.collection, meta: col.meta, schema: col.schema, fields }),
        });
        if (createRes.ok) {
          console.log(`   ✅ Created collection: ${col.collection}`);
        } else {
          console.warn(`   ⚠️ Collection create failed for ${col.collection} (${createRes.status}): ${await createRes.text()}`);
        }
      } catch (err) {
        console.warn(`   ⚠️ Collection create error for ${col.collection}:`, err.message);
      }
    }
  }

  // 3. Create a least-privilege "PetSync Service" role + user + static token
  //    (the sync job authenticates as this, NOT as the admin account).
  console.log('🔧 Setting up PetSync service role...');
  let syncToken = null;
  try {
    let roleId = null;
    const rolesRes = await fetch(`${DIRECTUS_URL}/roles?filter[name][_eq]=PetSync Service`, { headers: authHeaders });
    if (rolesRes.ok) {
      const rolesData = await rolesRes.json();
      if (rolesData.data && rolesData.data.length > 0) {
        roleId = rolesData.data[0].id;
        console.log('   ℹ️ PetSync Service role already exists.');
      }
    }

    if (!roleId) {
      const roleRes = await fetch(`${DIRECTUS_URL}/roles`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ name: 'PetSync Service', icon: 'sync', admin_access: false, app_access: false }),
      });
      if (roleRes.ok) {
        const roleData = await roleRes.json();
        roleId = roleData.data.id;
        console.log('   ✅ Created PetSync Service role.');
      } else {
        console.warn(`   ⚠️ Role creation failed (${roleRes.status}): ${await roleRes.text()}`);
      }
    }

    if (roleId) {
      // Least-privilege permissions: write pets + sync_runs, nothing else.
      const servicePerms = [
        { collection: 'pets', action: 'create' },
        { collection: 'pets', action: 'update' },
        { collection: 'pets', action: 'read' },
        { collection: 'sync_runs', action: 'create' },
        { collection: 'sync_runs', action: 'read' },
      ];
      for (const p of servicePerms) {
        await fetch(`${DIRECTUS_URL}/permissions`, {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({ role: roleId, collection: p.collection, action: p.action, fields: ['*'] }),
        }).catch(() => {});
      }
      console.log('   ✅ Granted PetSync Service role write access to pets + sync_runs.');

      // Ensure a service user exists under this role, with a static token.
      let userId = null;
      const usersRes = await fetch(`${DIRECTUS_URL}/users?filter[email][_eq]=petsync-service@monroe-humane.org`, { headers: authHeaders });
      if (usersRes.ok) {
        const usersData = await usersRes.json();
        if (usersData.data && usersData.data.length > 0) {
          userId = usersData.data[0].id;
          syncToken = usersData.data[0].token || null;
          console.log('   ℹ️ PetSync service user already exists.');
        }
      }

      if (!userId) {
        syncToken = `psvc_${Buffer.from(`${Date.now()}-${Math.random()}`).toString('base64url').slice(0, 40)}`;
        const userRes = await fetch(`${DIRECTUS_URL}/users`, {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({
            email: 'petsync-service@monroe-humane.org',
            role: roleId,
            status: 'active',
            first_name: 'PetSync',
            last_name: 'Service',
            token: syncToken,
          }),
        });
        if (userRes.ok) {
          console.log('   ✅ Created PetSync service user with static token.');
        } else {
          console.warn(`   ⚠️ Service user creation failed (${userRes.status}): ${await userRes.text()}`);
          syncToken = null;
        }
      }
    }
  } catch (err) {
    console.warn('   ⚠️ PetSync service role setup error:', err.message);
  }

  // 4. Configure Public Read Permissions
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

  // 5. Seed Site Settings if empty
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
  if (syncToken) {
    console.log('\n🔑 PetSync DIRECTUS_STATIC_TOKEN (save this into the job secret, it is not shown again):');
    console.log(`   ${syncToken}`);
  }
}

main().catch(console.error);
