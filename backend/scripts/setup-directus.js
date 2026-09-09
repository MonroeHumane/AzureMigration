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
        const existingFieldsByName = new Map();
        if (existingFieldsRes.ok) {
          const existingFieldsData = await existingFieldsRes.json();
          for (const f of existingFieldsData.data || []) existingFieldsByName.set(f.field, f);
        }
        // Only these meta keys are UI/display-layer and safe to reconcile
        // on a field that already exists — never touch type/schema (that's
        // a real migration, out of scope here) or Directus-managed keys
        // like sort/special/id.
        const RECONCILABLE_META_KEYS = ['interface', 'display', 'display_options', 'options', 'width', 'readonly', 'note', 'required'];
        for (const field of fields) {
          const existing = existingFieldsByName.get(field.field);
          if (!existing) {
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
            continue;
          }

          const desiredMeta = field.meta || {};
          const existingMeta = existing.meta || {};
          const metaPatch = {};
          for (const key of RECONCILABLE_META_KEYS) {
            if (!(key in desiredMeta)) continue;
            const desiredVal = JSON.stringify(desiredMeta[key]);
            if (JSON.stringify(existingMeta[key]) !== desiredVal) metaPatch[key] = desiredMeta[key];
          }
          if (Object.keys(metaPatch).length === 0) {
            console.log(`   ℹ️ Field up to date: ${col.collection}.${field.field}`);
          } else {
            const patchRes = await fetch(`${DIRECTUS_URL}/fields/${col.collection}/${field.field}`, {
              method: 'PATCH',
              headers: authHeaders,
              body: JSON.stringify({ meta: metaPatch }),
            });
            if (patchRes.ok) {
              console.log(`   ✅ Updated field styling: ${col.collection}.${field.field} (${Object.keys(metaPatch).join(', ')})`);
            } else {
              console.warn(`   ⚠️ Field update failed for ${col.collection}.${field.field} (${patchRes.status}): ${await patchRes.text()}`);
            }
          }
          if (col.collection === 'newsletter_issues' && field.field === 'slug' && field.schema && field.schema.is_unique && !(existing.schema && existing.schema.is_unique)) {
            const uniqueRes = await fetch(`${DIRECTUS_URL}/fields/${col.collection}/${field.field}`, {
              method: 'PATCH',
              headers: authHeaders,
              body: JSON.stringify({ schema: { is_unique: true } }),
            });
            if (uniqueRes.ok) {
              console.log('   ✅ Unique constraint on newsletter_issues.slug');
            } else {
              console.warn(`   ⚠️ Could not set unique slug (${uniqueRes.status}): ${await uniqueRes.text()}`);
            }
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

  // 3b. Least-privilege newsletter Function service (CRUD + files, not admin).
  console.log('🔧 Setting up Newsletter Function service account...');
  try {
    let nlPolicyId = null;
    const nlPoliciesRes = await fetch(`${DIRECTUS_URL}/policies?filter[name][_eq]=Newsletter Function Service`, { headers: authHeaders });
    if (nlPoliciesRes.ok) {
      const nlPoliciesData = await nlPoliciesRes.json();
      if (nlPoliciesData.data && nlPoliciesData.data.length > 0) {
        nlPolicyId = nlPoliciesData.data[0].id;
        console.log('   ℹ️ Newsletter Function Service policy already exists.');
      }
    }
    if (!nlPolicyId) {
      const nlPolicyRes = await fetch(`${DIRECTUS_URL}/policies`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ name: 'Newsletter Function Service', icon: 'newspaper', admin_access: false, app_access: false }),
      });
      if (nlPolicyRes.ok) {
        nlPolicyId = (await nlPolicyRes.json()).data.id;
        console.log('   ✅ Created Newsletter Function Service policy.');
      } else {
        console.warn(`   ⚠️ Newsletter policy creation failed (${nlPolicyRes.status}): ${await nlPolicyRes.text()}`);
      }
    }
    if (nlPolicyId) {
      const nlPerms = [
        { collection: 'newsletter_issues', action: 'create' },
        { collection: 'newsletter_issues', action: 'read' },
        { collection: 'newsletter_issues', action: 'update' },
        { collection: 'newsletter_issues', action: 'delete' },
        { collection: 'directus_files', action: 'create' },
        { collection: 'directus_files', action: 'read' },
        { collection: 'directus_revisions', action: 'read' },
      ];
      const existingNlPermsRes = await fetch(`${DIRECTUS_URL}/permissions?filter[policy][_eq]=${nlPolicyId}&limit=-1`, { headers: authHeaders });
      const existingNlPerms = existingNlPermsRes.ok ? (await existingNlPermsRes.json()).data || [] : [];
      const hasNl = (collection, action) => existingNlPerms.some((p) => p.collection === collection && p.action === action);
      for (const p of nlPerms) {
        if (hasNl(p.collection, p.action)) {
          console.log(`   ℹ️ Permission already exists: ${p.action} ${p.collection}`);
          continue;
        }
        const permRes = await fetch(`${DIRECTUS_URL}/permissions`, {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({ policy: nlPolicyId, collection: p.collection, action: p.action, fields: ['*'] }),
        });
        if (permRes.ok) {
          console.log(`   ✅ Granted: ${p.action} ${p.collection}`);
        } else {
          console.warn(`   ⚠️ Permission grant failed for ${p.action} ${p.collection} (${permRes.status}): ${await permRes.text()}`);
        }
      }

      let nlUserId = null;
      const nlUsersRes = await fetch(`${DIRECTUS_URL}/users?filter[email][_eq]=newsletter-service@monroe-humane.org`, { headers: authHeaders });
      if (nlUsersRes.ok) {
        const nlUsersData = await nlUsersRes.json();
        if (nlUsersData.data && nlUsersData.data.length > 0) {
          nlUserId = nlUsersData.data[0].id;
          console.log('   ℹ️ Newsletter service user already exists.');
        }
      }
      if (!nlUserId) {
        const nlToken = `nlsvc_${Buffer.from(`${Date.now()}-${Math.random()}`).toString('base64url').slice(0, 40)}`;
        const nlUserRes = await fetch(`${DIRECTUS_URL}/users`, {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({
            email: 'newsletter-service@monroe-humane.org',
            status: 'active',
            first_name: 'Newsletter',
            last_name: 'Service',
            token: nlToken,
          }),
        });
        if (nlUserRes.ok) {
          nlUserId = (await nlUserRes.json()).data.id;
          console.log('   ✅ Created Newsletter service user. Set DIRECTUS_NEWSLETTER_TOKEN in SWA (token not printed).');
          if (process.env.SET_SWA_NEWSLETTER_TOKEN === '1') {
            const { spawnSync } = require('child_process');
            const azBin = process.platform === 'win32' ? 'az.cmd' : 'az';
            const setRes = spawnSync(azBin, [
              'staticwebapp', 'appsettings', 'set',
              '-n', process.env.SWA_NAME || 'mchs-frontend-prod',
              '-g', process.env.SWA_RG || 'MCHS-Platform-RG',
              '--setting-names', `DIRECTUS_NEWSLETTER_TOKEN=${nlToken}`,
              '--output', 'none',
            ], { encoding: 'utf8', windowsHide: true, shell: false });
            if (setRes.status === 0) {
              console.log('   ✅ DIRECTUS_NEWSLETTER_TOKEN stored in Static Web App settings.');
            } else {
              console.warn('   ⚠️ Could not write SWA app setting (run SET_SWA_NEWSLETTER_TOKEN=1 after creating the user).');
            }
          }
        } else {
          console.warn(`   ⚠️ Newsletter service user creation failed (${nlUserRes.status}): ${await nlUserRes.text()}`);
        }
      }
      if (nlUserId) {
        const nlAccessRes = await fetch(`${DIRECTUS_URL}/access?filter[user][_eq]=${nlUserId}&filter[policy][_eq]=${nlPolicyId}`, { headers: authHeaders });
        const nlAccessExists = nlAccessRes.ok && (await nlAccessRes.json()).data?.length > 0;
        if (!nlAccessExists) {
          const linkRes = await fetch(`${DIRECTUS_URL}/access`, {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify({ user: nlUserId, policy: nlPolicyId }),
          });
          if (linkRes.ok) {
            console.log('   ✅ Linked Newsletter service user to policy.');
          } else {
            console.warn(`   ⚠️ Newsletter user-policy link failed (${linkRes.status}): ${await linkRes.text()}`);
          }
        } else {
          console.log('   ℹ️ Newsletter service user already linked to policy.');
        }
      }
    }
  } catch (err) {
    console.warn('   ⚠️ Newsletter Function service setup error:', err.message);
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
    const publicReadPerm = (collection) => existingPublic.find((p) => p.collection === collection && p.action === 'read');
    const newsletterPublicFilter = { status: { _eq: 'published' } };

    for (const col of publicCollections) {
      const existingPerm = publicReadPerm(col);
      const body = {
        policy: publicPolicyId,
        collection: col,
        action: 'read',
        fields: ['*'],
      };
      if (col === 'newsletter_issues') {
        body.permissions = newsletterPublicFilter;
      }
      if (existingPerm) {
        if (col === 'newsletter_issues') {
          const currentFilter = JSON.stringify(existingPerm.permissions || {});
          const desiredFilter = JSON.stringify(newsletterPublicFilter);
          if (currentFilter !== desiredFilter) {
            const patchRes = await fetch(`${DIRECTUS_URL}/permissions/${existingPerm.id}`, {
              method: 'PATCH',
              headers: authHeaders,
              body: JSON.stringify({ permissions: newsletterPublicFilter }),
            });
            if (patchRes.ok) {
              console.log('   ✅ Public read filter (published only): newsletter_issues');
            } else {
              console.warn(`   ⚠️ Public newsletter filter patch failed (${patchRes.status}): ${await patchRes.text()}`);
            }
          } else {
            console.log('   ℹ️ Public read already exists: newsletter_issues (published only)');
          }
        } else {
          console.log(`   ℹ️ Public read already exists: ${col}`);
        }
        continue;
      }
      try {
        const permRes = await fetch(`${DIRECTUS_URL}/permissions`, {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify(body),
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

  // 5. Staff / app-access policies: grants + newsletter CRUD (never public)
  console.log('🔐 Configuring staff grants and newsletter permissions...');
  try {
    const policiesRes = await fetch(`${DIRECTUS_URL}/policies?limit=-1`, { headers: authHeaders });
    const policies = policiesRes.ok ? ((await policiesRes.json()).data || []) : [];
    const staffActions = ['read', 'create', 'update', 'delete'];
    const staffCollections = ['grants', 'newsletter_issues'];
    const extraStaffPerms = [
      { collection: 'directus_files', action: 'create' },
      { collection: 'directus_files', action: 'read' },
      { collection: 'directus_revisions', action: 'read' },
    ];
    for (const policy of policies) {
      const name = String(policy.name || '');
      if (name === '$t:public_label' || name.toLowerCase().includes('public')) continue;
      if (policy.admin_access) continue;
      if (!policy.app_access && name !== 'PetSync Service') continue;
      if (name === 'PetSync Service' || name === 'Newsletter Function Service') continue;

      const existingRes = await fetch(`${DIRECTUS_URL}/permissions?filter[policy][_eq]=${policy.id}&limit=-1`, { headers: authHeaders });
      const existing = existingRes.ok ? ((await existingRes.json()).data || []) : [];
      const has = (collection, action) => existing.some((p) => p.collection === collection && p.action === action);
      for (const collection of staffCollections) {
        for (const action of staffActions) {
          if (has(collection, action)) {
            console.log(`   ℹ️ ${name} already has ${action} ${collection}`);
            continue;
          }
          const permRes = await fetch(`${DIRECTUS_URL}/permissions`, {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify({ policy: policy.id, collection, action, fields: ['*'] }),
          });
          if (permRes.ok) {
            console.log(`   ✅ ${name}: ${action} ${collection}`);
          } else {
            console.warn(`   ⚠️ ${name} ${action} ${collection} failed (${permRes.status}): ${await permRes.text()}`);
          }
        }
      }
      for (const extra of extraStaffPerms) {
        if (has(extra.collection, extra.action)) {
          console.log(`   ℹ️ ${name} already has ${extra.action} ${extra.collection}`);
          continue;
        }
        const extraRes = await fetch(`${DIRECTUS_URL}/permissions`, {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({ policy: policy.id, collection: extra.collection, action: extra.action, fields: ['*'] }),
        });
        if (extraRes.ok) {
          console.log(`   ✅ ${name}: ${extra.action} ${extra.collection}`);
        } else {
          console.warn(`   ⚠️ ${name} ${extra.action} ${extra.collection} failed (${extraRes.status}): ${await extraRes.text()}`);
        }
      }
    }
  } catch (err) {
    console.warn('   ⚠️ Staff grants/newsletter permission setup error:', err.message);
  }

  // 6. Seed grants pipeline if empty
  try {
    const grantsCheck = await fetch(`${DIRECTUS_URL}/items/grants?limit=1`, { headers: authHeaders });
    if (grantsCheck.ok) {
      const grantsData = await grantsCheck.json();
      const existingCount = (grantsData.data || []).length;
      if (existingCount === 0) {
        console.log('🌱 Seeding initial grants pipeline...');
        const seedGrants = [
          {
            title: 'La-Z-Boy Foundation — Feline Room Renovation',
            source: 'Manual',
            status: 'open',
            deadline_notes: 'Capital grant for shelter feline adoption room expansion and modern cat housing suites. Amount: $25,000.',
          },
          {
            title: 'Microsoft Azure for Nonprofits Cloud Grant',
            source: 'Manual',
            status: 'awarded',
            deadline_notes: 'Annual recurring nonprofit cloud credits supporting Monroe Humane website, Directus CMS, database, and PetSync services. Amount: $2,000/yr.',
          },
          {
            title: 'Dave Durbano Philanthropic Gift — Feline Care Wing',
            source: 'Manual',
            status: 'open',
            deadline_notes: 'Dedicated major donor sponsorship towards feline isolation & adoption suites renovation. Amount: $15,000.',
          },
          {
            title: 'The Harold & Grace LeBel Foundation Grant',
            source: 'Manual',
            status: 'open',
            deadline_notes: 'Animal welfare operations, intake veterinary medical supplies, and shelter care support. Amount: $2,000.',
          },
        ];
        for (const row of seedGrants) {
          const createRes = await fetch(`${DIRECTUS_URL}/items/grants`, {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify(row),
          });
          if (createRes.ok) {
            console.log(`   ✅ Seeded: ${row.title}`);
          } else {
            console.warn(`   ⚠️ Seed failed for ${row.title} (${createRes.status}): ${await createRes.text()}`);
          }
        }
      } else {
        console.log('   ℹ️ Grants collection already has records.');
      }
    } else {
      console.warn(`   ⚠️ Could not read grants for seeding (${grantsCheck.status}): ${await grantsCheck.text()}`);
    }
  } catch (e) {
    console.warn('   ⚠️ Grants seed skipped:', e.message);
  }

  // 6b. Seed newsletter archive if empty
  try {
    const nlCheck = await fetch(`${DIRECTUS_URL}/items/newsletter_issues?limit=1`, { headers: authHeaders });
    if (nlCheck.ok) {
      const nlData = await nlCheck.json();
      if ((nlData.data || []).length === 0) {
        console.log('🌱 Seeding 2025 in Review newsletter issue...');
        const seedIssue = {
          status: 'published',
          title: '2025 in Review',
          slug: '2025-in-review',
          issue_date: '2026-01-15',
          heading: '2025 in Review',
          lead: 'A new direction, a busy shelter, and a community that showed up all year.',
          byline: 'by, Jacqueline Monteer',
          featured: true,
          hero_image: '/assets/recovered/images/monroe-humane.org/wp-content/uploads/2026/05/0dcb5211-4496-4c57-9b4a-73f5f856a667.png',
          excerpt: 'A new direction, a busy shelter, and a community that showed up all year. Read how 2025 reshaped the shelter — new play yards, climate control, a medical room, and hundreds of animals finding their way home.',
          pdf_url: '',
          top_line: 'PO Box 1457 • Monroe, MI',
          newsletter_title: 'Monroe Humane Society Newsletter',
          main_headline: '2025 in Review',
          blocks: [
            {
              id: '1',
              type: 'story',
              title: 'A New Direction',
              body: 'After years of donations and plans for building a new shelter it was not to be. In 2023 I became president of HSMC there was debt, the Telegraph location was falling apart, very little progress on a new shelter and then covid. I spent a lot of time working with different agencies, government entities and contractors to see if we could salvage the project within a realistic budget. It was not financially prudent.\n\nThe new board took a different direction, and it has been a blessing. We have partnered with the Sheriff’s dept. We are now a vendor for the county and rent the animal control shelter building. With hard work and support of the community we have improved all aspects of shelter life for dogs and cats.\n\nWe wanted to give back to the community as much as possible with improvements to the shelter putting to work all the donations for a new shelter. These improvements are here to stay no matter what. The dogs and cats of Monroe County will benefit from the Humane Society and the generosity of this community.',
            },
            {
              id: '2',
              type: 'story',
              title: 'Things improved',
              body: '1. Two new fenced play yards and reconfigured some of the existing fencing so that if a dog escapes the kennel area it is confined inside the fencing. We also installed a pedestrian gate so that access is easier and safer for dogs being walked.\n2. Installed air conditioning in the dog kennel and installed a separate heating and cooling unit in the cat area.\n3. Installed new commercial sink, allowing us to clean and sterilize all animal dishes and other items.\n4. Installed commercial size washer and dryer. It holds 5 times the load limit of the previous units capacity.\n5. Created a medical room. All animals brought into the shelter are evaluated and vaccinated.\n6. Are in the process of building two additional outdoor covered kennels. Previously we had just small kennel runs under a permanent roof and 6 larger runs on gravel with no overhead protection except a tarp. The new kennels have roofs and are larger than the existing runs with a total of 14 larger runs. So with what is here now we will have more room to get dogs out in good weather and places to put them for cleaning kennels where they are protected from the elements.\n7. All of the staff are certified in Fear Free which is a course offered to teach how to handle shelter animals to reduce fear and stress.\n8. We also implemented a program called Please, the dogs are asked to sit and calm before exiting their kennel.\n9. We have created play groups for the dogs. We find which dogs like each other and we allow them to play in the play yard together. Often, they will let us know when they are ready to come in and some of our dogs would rather be in a play group than to go for a walk.\n10. We have a program called Doggie Day Out which allows dogs to leave the shelter for a day. We have dogs who now drool when they go by a fast food place that has pup cups, some dogs go to a park and some go to a home for a day of cuddles. They usually come back tired and happy.\n11. We rotate dogs in the office area so that they are exposed to different people and different situations. Much like they experience in a home.\n12. We had a mural painted on the side of the building. This was a community event with many people helping to paint. The animals on the wall are all former residents of the shelter. On the front of the building is a memorial to ACO Darrian Young and Dr. Hermann, both had dedicated their lives to animals and the community and each tragically were killed in car accidents.',
            },
            {
              id: '3',
              type: 'story',
              title: 'Partner Shelters & Our Cats',
              body: 'In addition to all these changes and improvements we have programs with other state approved shelters. We trade about 4 dogs a month, sometimes it just takes another set of eyes to find the perfect match.\n\nIn reading this you may have noticed most centers around our dogs. We also have cats here for adoption and looking for homes. Each year we take in cats that are left behind or have owners that have passed and many other unfortunate circumstances. We have cats that give birth in our care, we have litters brought to us and there is always far more in need than we can care for.',
            },
            {
              id: '4',
              type: 'story',
              title: 'The Cat Room 2014 Next Project',
              body: 'With that, the next project we have planned is for a “Cat Room”. We want to build onto the front of the building, about 800 square feet, where we can put community kennels for the cats. Where they can play and climb and do what cats and kittens do. An architect donated his time and drew up plans. Building the cat room will move the cats from the garage to an area built specifically for them and their needs. This will also leave us with a large area at the back of the building where we can build isolation kennels, so that when a dog is brought into the building it can go to the isolation area to decompress and be observed for health problems.\n\nAt the same time, it will open some much needed space outside of the medical room for Legacy Pet Care, for the vaccine and animal care clinic once monthly.\n\nThis project will be expensive and will require fundraisers. We will need corporate sponsors and will offer naming rights for this new addition.',
            },
          ],
        };
        const createRes = await fetch(`${DIRECTUS_URL}/items/newsletter_issues`, {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify(seedIssue),
        });
        if (createRes.ok) {
          console.log('   ✅ Seeded: 2025 in Review');
        } else {
          console.warn(`   ⚠️ Newsletter seed failed (${createRes.status}): ${await createRes.text()}`);
        }
      } else {
        console.log('   ℹ️ Newsletter collection already has records.');
      }
    } else {
      console.warn(`   ⚠️ Could not read newsletter_issues for seeding (${nlCheck.status}): ${await nlCheck.text()}`);
    }
  } catch (e) {
    console.warn('   ⚠️ Newsletter seed skipped:', e.message);
  }

  // 7. Seed Site Settings if empty
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
