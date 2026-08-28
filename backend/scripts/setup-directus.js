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
      const fields = (schemaData.fields || []).filter((f) => f.collection === col.collection);

      if (existingNames.has(col.collection)) {
        console.log(`   ℹ️ Collection already exists: ${col.collection}`);
        // Reconcile fields too — a collection existing doesn't mean every
        // field in schema.json has actually been added to it (e.g. someone
        // extends schema.json for an already-live collection later).
        const existingFieldsRes = await fetch(`${DIRECTUS_URL}/fields/${col.collection}`, { headers: authHeaders });
        const existingFieldNames = new Set();
        if (existingFieldsRes.ok) {
          const existingFieldsData = await existingFieldsRes.json();
          for (const f of existingFieldsData.data || []) existingFieldNames.add(f.field);
        }
        for (const field of fields) {
          if (existingFieldNames.has(field.field)) continue;
          const fieldRes = await fetch(`${DIRECTUS_URL}/fields/${col.collection}`, {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify(field),
          });
          if (fieldRes.ok) {
            console.log(`   ✅ Added missing field: ${col.collection}.${field.field}`);
          } else {
            console.warn(`   ⚠️ Field create failed for ${col.collection}.${field.field} (${fieldRes.status}): ${await fieldRes.text()}`);
          }
        }
        continue;
      }

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

  // 3. Create a least-privilege "PetSync Service" policy + user + static
  //    token (the sync job authenticates as this, NOT as the admin
  //    account). Directus 11 moved permissions onto policies (not roles
  //    directly) — a policy is attached to a user via directus_access,
  //    optionally with no role at all (same pattern as a direct admin grant).
  console.log('🔧 Setting up PetSync service account...');
  let syncToken = null;
  try {
    let policyId = null;
    const policiesRes = await fetch(`${DIRECTUS_URL}/policies?filter[name][_eq]=PetSync Service`, { headers: authHeaders });
    if (policiesRes.ok) {
      const policiesData = await policiesRes.json();
      if (policiesData.data && policiesData.data.length > 0) {
        policyId = policiesData.data[0].id;
        console.log('   ℹ️ PetSync Service policy already exists.');
      }
    }

    if (!policyId) {
      const policyRes = await fetch(`${DIRECTUS_URL}/policies`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ name: 'PetSync Service', icon: 'sync', admin_access: false, app_access: false }),
      });
      if (policyRes.ok) {
        const policyData = await policyRes.json();
        policyId = policyData.data.id;
        console.log('   ✅ Created PetSync Service policy.');
      } else {
        console.warn(`   ⚠️ Policy creation failed (${policyRes.status}): ${await policyRes.text()}`);
      }
    }

    if (policyId) {
      // Least-privilege permissions: write pets + sync_runs, nothing else.
      // Report failures loudly — a silently-missing permission here means
      // the sync job gets a 403 the next time it runs, which is exactly
      // the kind of bug that's invisible until it fails in production.
      const servicePerms = [
        { collection: 'pets', action: 'create' },
        { collection: 'pets', action: 'update' },
        { collection: 'pets', action: 'read' },
        { collection: 'sync_runs', action: 'create' },
        { collection: 'sync_runs', action: 'read' },
      ];
      const existingPermsRes = await fetch(`${DIRECTUS_URL}/permissions?filter[policy][_eq]=${policyId}&limit=-1`, { headers: authHeaders });
      const existingPerms = existingPermsRes.ok ? (await existingPermsRes.json()).data || [] : [];
      const has = (collection, action) => existingPerms.some((p) => p.collection === collection && p.action === action);

      for (const p of servicePerms) {
        if (has(p.collection, p.action)) {
          console.log(`   ℹ️ Permission already exists: ${p.action} ${p.collection}`);
          continue;
        }
        const permRes = await fetch(`${DIRECTUS_URL}/permissions`, {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({ policy: policyId, collection: p.collection, action: p.action, fields: ['*'] }),
        });
        if (permRes.ok) {
          console.log(`   ✅ Granted: ${p.action} ${p.collection}`);
        } else {
          console.warn(`   ⚠️ Permission grant failed for ${p.action} ${p.collection} (${permRes.status}): ${await permRes.text()}`);
        }
      }

      // Ensure a service user exists, with a static token, directly linked
      // to the policy (no role — same pattern as the admin account setup).
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
            status: 'active',
            first_name: 'PetSync',
            last_name: 'Service',
            token: syncToken,
          }),
        });
        if (userRes.ok) {
          userId = (await userRes.json()).data.id;
          console.log('   ✅ Created PetSync service user with static token.');
        } else {
          console.warn(`   ⚠️ Service user creation failed (${userRes.status}): ${await userRes.text()}`);
          syncToken = null;
        }
      }

      if (userId) {
        const accessRes = await fetch(`${DIRECTUS_URL}/access?filter[user][_eq]=${userId}&filter[policy][_eq]=${policyId}`, { headers: authHeaders });
        const accessExists = accessRes.ok && (await accessRes.json()).data?.length > 0;
        if (!accessExists) {
          const linkRes = await fetch(`${DIRECTUS_URL}/access`, {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify({ user: userId, policy: policyId }),
          });
          if (linkRes.ok) {
            console.log('   ✅ Linked PetSync service user to policy.');
          } else {
            console.warn(`   ⚠️ User-policy link failed (${linkRes.status}): ${await linkRes.text()}`);
          }
        } else {
          console.log('   ℹ️ PetSync service user already linked to policy.');
        }
      }
    }
  } catch (err) {
    console.warn('   ⚠️ PetSync service account setup error:', err.message);
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

  // Directus 11 resolves anonymous/public access through a specific system
  // policy (not `role: null` on the permission itself, which is the pre-11
  // convention and gets silently rejected here). Find it by its stable
  // system name rather than hardcoding its UUID.
  let publicPolicyId = null;
  const publicPolicyRes = await fetch(`${DIRECTUS_URL}/policies?filter[name][_eq]=$t:public_label`, { headers: authHeaders });
  if (publicPolicyRes.ok) {
    const publicPolicyData = await publicPolicyRes.json();
    publicPolicyId = publicPolicyData.data?.[0]?.id || null;
  }

  if (!publicPolicyId) {
    console.warn('   ⚠️ Could not find the system Public policy — skipping public read setup.');
  } else {
    const existingPublicRes = await fetch(`${DIRECTUS_URL}/permissions?filter[policy][_eq]=${publicPolicyId}&limit=-1`, { headers: authHeaders });
    const existingPublic = existingPublicRes.ok ? (await existingPublicRes.json()).data || [] : [];
    const hasPublicRead = (collection) => existingPublic.some((p) => p.collection === collection && p.action === 'read');

    for (const col of publicCollections) {
      if (hasPublicRead(col)) {
        console.log(`   ℹ️ Public read already exists: ${col}`);
        continue;
      }
      try {
        const permRes = await fetch(`${DIRECTUS_URL}/permissions`, {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({ policy: publicPolicyId, collection: col, action: 'read', fields: ['*'] }),
        });
        if (permRes.ok) {
          console.log(`   ✅ Public read granted: ${col}`);
        } else {
          console.warn(`   ⚠️ Public read grant failed for ${col} (${permRes.status}): ${await permRes.text()}`);
        }
      } catch (e) {
        console.warn(`   ⚠️ Permission network error for ${col}:`, e.message);
      }
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
