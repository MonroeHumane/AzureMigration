const { app } = require('@azure/functions');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const reportData = require('../data/published_2026_ytd.json');
const statementData = require('../data/statement_2026_08.json');

function loadJsonOptional(relPath) {
  try {
    return require(relPath);
  } catch (err) {
    if (err && err.code === 'MODULE_NOT_FOUND') {
      return null;
    }
    throw err;
  }
}

const donorDatabase = loadJsonOptional('../data/donor_database.json');
const monthlyDrilldown = loadJsonOptional('../data/monthly_drilldown_2026.json');

const DIRECTUS_URL = process.env.DIRECTUS_URL || 'https://mchs-directus.livelyfield-d0a70609.eastus.azurecontainerapps.io';
const STAFF_SECRET = (process.env.STAFF_AUTH_SECRET || '').trim();

function isAllowedOrigin(origin) {
  if (!origin) return false;
  try {
    const url = new URL(origin);
    const host = url.hostname;
    return (
      host === 'monroe-humane.org' ||
      host.endsWith('.monroe-humane.org') ||
      host.endsWith('.azurestaticapps.net') ||
      host === 'localhost' ||
      host === '127.0.0.1'
    );
  } catch {
    return false;
  }
}

const STATEMENT_FILES = {
  bank: 'First_Merchant_Chkng_XXXXXX8478_08312026.pdf',
  qbo: 'QBO_Reconciliation_Report_08312026.pdf',
};

function isStaffSecretConfigured() {
  return STAFF_SECRET.length > 0;
}

function corsHeaders(request, extra) {
  const headers = Object.assign({}, extra || {});
  const origin = (request.headers.get('origin') || '').trim();
  if (origin && isAllowedOrigin(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Vary'] = 'Origin';
  }
  return headers;
}

const DEFAULT_ALLOWED_HEADERS = 'Authorization, Content-Type, X-Staff-Token, X-Authorization';

function corsPreflight(request, methods, allowHeaders) {
  return {
    status: 204,
    headers: corsHeaders(request, {
      'Access-Control-Allow-Methods': methods,
      'Access-Control-Allow-Headers': allowHeaders || DEFAULT_ALLOWED_HEADERS,
      'Access-Control-Max-Age': '86400',
    }),
  };
}

function jsonResponse(request, status, body, extraHeaders) {
  return {
    status,
    headers: corsHeaders(request, Object.assign({
      'Content-Type': 'application/json',
    }, extraHeaders || {})),
    jsonBody: body,
  };
}

function staffAuthUnavailable(request) {
  return jsonResponse(request, 503, { error: 'Service temporarily unavailable.' }, {
    'Cache-Control': 'no-store, private',
  });
}

// Helper: Generate persistent HMAC-signed staff session token
function createStaffToken(email) {
  if (!isStaffSecretConfigured()) {
    throw new Error('Staff session signing is not configured');
  }
  const payload = Buffer.from(JSON.stringify({
    email: (email || 'staff@monroe-humane.org').toLowerCase().trim(),
    role: 'staff',
    iat: Date.now(),
  })).toString('base64url');
  const hmac = crypto.createHmac('sha256', STAFF_SECRET).update(payload).digest('base64url');
  return `mchs_${payload}.${hmac}`;
}

// Helper: Verify persistent HMAC-signed staff session token
function verifyStaffToken(token) {
  if (!isStaffSecretConfigured()) {
    return null;
  }
  if (!token || typeof token !== 'string' || !token.startsWith('mchs_')) {
    return null;
  }
  const clean = token.substring(5);
  const parts = clean.split('.');
  if (parts.length !== 2) return null;
  const [payloadB64, sig] = parts;
  try {
    const expectedSig = crypto.createHmac('sha256', STAFF_SECRET).update(payloadB64).digest('base64url');
    if (sig.length !== expectedSig.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) {
      return null;
    }
    const data = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    if (data && data.email) {
      // Enforce 30-day maximum session lifetime (2,592,000,000 ms) with clock-skew tolerance
      const MAX_SESSION_AGE = 30 * 24 * 60 * 60 * 1000;
      if (data.iat && Math.abs(Date.now() - data.iat) > MAX_SESSION_AGE) {
        console.warn(`[StaffAuth] HMAC session expired for ${data.email}`);
        return null;
      }
      return data;
    }
  } catch {
    return null;
  }
  return null;
}

// Helper: Verify Directus Bearer token
async function verifyDirectusToken(token) {
  if (!token) return null;
  try {
    const res = await fetch(`${DIRECTUS_URL}/users/me`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!res.ok) return null;
    const data = await res.json();
    return data && data.data && data.data.id ? data.data : null;
  } catch (err) {
    console.error('Error contacting Directus auth endpoint:', err);
    return null;
  }
}

// Helper: Unified staff authentication (HMAC staff token or Directus JWT)
async function authenticateRequest(token) {
  if (!token) return null;

  // 1. Instant HMAC verification (no network call, never drops session)
  const staff = verifyStaffToken(token);
  if (staff) return { email: staff.email, role: staff.role };

  // 2. Directus access token verification
  const directusUser = await verifyDirectusToken(token);
  if (directusUser) return { email: directusUser.email, role: 'staff', directus: directusUser };

  return null;
}

function bearerToken(request) {
  // Azure Static Web Apps reserves/strips standard 'Authorization' header.
  // We check X-Staff-Token, X-Authorization, query token, and Authorization.
  const custom = request.headers.get('x-staff-token') || request.headers.get('x-authorization') || '';
  if (custom) {
    return custom.startsWith('Bearer ') ? custom.substring(7).trim() : custom.trim();
  }
  const authHeader = request.headers.get('authorization') || '';
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }
  try {
    const url = new URL(request.url);
    const qToken = url.searchParams.get('token');
    if (qToken) return qToken.trim();
  } catch {}

  return authHeader.trim();
}

// 1. POST /api/login
app.http('login', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    if (request.method === 'OPTIONS') {
      return corsPreflight(request, 'POST, OPTIONS', 'Authorization, Content-Type');
    }

    if (!isStaffSecretConfigured()) {
      return staffAuthUnavailable(request);
    }

    try {
      const body = await request.json();
      const { email, password } = body || {};

      if (!email || !password) {
        return jsonResponse(request, 400, { error: 'Email and password are required.' });
      }

      // Authenticate against Directus CMS
      const directusRes = await fetch(`${DIRECTUS_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!directusRes.ok) {
        return jsonResponse(request, 401, { error: 'Invalid email or password.' });
      }

      const directusData = await directusRes.json();
      const staffToken = createStaffToken(email);

      return jsonResponse(request, 200, {
        ok: true,
        token: staffToken,
        email: email,
        directus: directusData && directusData.data ? directusData.data : null,
      }, {
        'Cache-Control': 'no-store, private',
      });
    } catch (err) {
      console.error('Error in /api/login:', err);
      return jsonResponse(request, 500, { error: 'Internal authentication error.' });
    }
  },
});

// 2. POST /api/session (Exchange Directus token for persistent staff session token)
app.http('session', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    if (request.method === 'OPTIONS') {
      return corsPreflight(request, 'POST, OPTIONS');
    }

    if (!isStaffSecretConfigured()) {
      return staffAuthUnavailable(request);
    }

    try {
      let token = bearerToken(request);

      if (!token) {
        try {
          const body = await request.json();
          token = body?.directus_token || body?.token || '';
        } catch {}
      }

      if (!token) {
        return jsonResponse(request, 401, { error: 'Directus Bearer token required.' });
      }

      // Check if already an HMAC staff token
      const existing = verifyStaffToken(token);
      if (existing) {
        return jsonResponse(request, 200, { ok: true, token, email: existing.email });
      }

      // Verify with Directus
      const user = await verifyDirectusToken(token);
      if (!user) {
        return jsonResponse(request, 401, { error: 'Invalid or expired Directus token.' });
      }

      const staffToken = createStaffToken(user.email || 'staff@monroe-humane.org');
      return jsonResponse(request, 200, { ok: true, token: staffToken, email: user.email });
    } catch (err) {
      console.error('Error in /api/session:', err);
      return jsonResponse(request, 500, { error: 'Internal session error.' });
    }
  },
});

// 3. GET /api/financials
app.http('financials', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    if (request.method === 'OPTIONS') {
      return corsPreflight(request, 'GET, OPTIONS');
    }

    if (!isStaffSecretConfigured()) {
      return staffAuthUnavailable(request);
    }

    const token = bearerToken(request);
    if (!token) {
      return jsonResponse(request, 401, { error: 'Unauthorized: Bearer token required.' }, {
        'Cache-Control': 'no-store, private',
      });
    }

    const staff = await authenticateRequest(token);
    if (!staff) {
      return jsonResponse(request, 401, { error: 'Unauthorized: Invalid or expired token.' }, {
        'Cache-Control': 'no-store, private',
      });
    }

    const payload = {
      ...reportData,
      bank_statement: statementData,
    };

    // 3-level GL drilldown for the board explorer (not baked into Astro pages).
    if (monthlyDrilldown) {
      payload.monthly_drilldown = monthlyDrilldown;
    }

    // Donor registry — same Bearer auth as financials. Keys match staff hydrators:
    //   data.donors (array), data.donor_meta, data.donor_database ({ meta, donors })
    if (donorDatabase) {
      payload.donors = Array.isArray(donorDatabase.donors) ? donorDatabase.donors : [];
      payload.donor_meta = donorDatabase.meta || null;
      payload.donor_database = donorDatabase;
    }

    return jsonResponse(request, 200, payload, {
      'Cache-Control': 'private, no-store',
    });
  },
});

// 4. GET /api/statement
app.http('statement', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    if (request.method === 'OPTIONS') {
      return corsPreflight(request, 'GET, OPTIONS');
    }

    if (!isStaffSecretConfigured()) {
      return staffAuthUnavailable(request);
    }

    const token = bearerToken(request);
    if (!token) {
      return jsonResponse(request, 401, { error: 'Unauthorized: Staff Bearer token required.' }, {
        'Cache-Control': 'no-store, private',
      });
    }

    const staff = await authenticateRequest(token);
    if (!staff) {
      return jsonResponse(request, 401, { error: 'Unauthorized: Invalid or expired token.' }, {
        'Cache-Control': 'no-store, private',
      });
    }

    const docKey = request.query.get('doc') || 'bank';
    const fileName = STATEMENT_FILES[docKey];
    if (!fileName) {
      return jsonResponse(request, 400, { error: 'Invalid document requested. Allowed: bank, qbo' });
    }

    const filePath = path.join(__dirname, '..', 'data', 'files', fileName);
    if (!fs.existsSync(filePath)) {
      return jsonResponse(request, 404, { error: 'Requested statement file not found.' });
    }

    const fileBuffer = fs.readFileSync(filePath);
    return {
      status: 200,
      headers: corsHeaders(request, {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${fileName}"`,
        'Cache-Control': 'private, no-cache, no-store, must-revalidate',
      }),
      body: fileBuffer,
    };
  },
});

// 5. POST /api/client-error (Client telemetry & exception logger)
app.http('client-error', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    if (request.method === 'OPTIONS') {
      return corsPreflight(request, 'POST, OPTIONS', 'Content-Type');
    }

    try {
      const errorPayload = await request.json();
      console.warn('[ClientTelemetry] Error reported:', {
        timestamp: new Date().toISOString(),
        page: errorPayload?.page || 'unknown',
        error: errorPayload?.error || 'unspecified',
        message: errorPayload?.message || '',
        userAgent: request.headers.get('user-agent') || '',
      });

      return jsonResponse(request, 200, { ok: true });
    } catch (e) {
      return jsonResponse(request, 400, { error: 'Invalid error payload' });
    }
  },
});

// 6. POST /api/pet-sync-webhook (Directus → GitHub repository_dispatch rebuild trigger)
//
// Setup in Azure SWA application settings:
//   DIRECTUS_WEBHOOK_SECRET  — shared secret; set the same value in Directus webhook headers
//   GITHUB_DISPATCH_PAT      — GitHub fine-grained PAT with "actions:write" on this repo
//   GITHUB_REPO_OWNER        — e.g. "MonroeHumane"
//   GITHUB_REPO_NAME         — e.g. "AzureMigration"
//
// Setup in Directus: Admin → Settings → Webhooks → New Webhook
//   URL: https://<your-swa>.azurestaticapps.net/api/pet-sync-webhook
//   Method: POST
//   Headers: X-Webhook-Secret: <same value as DIRECTUS_WEBHOOK_SECRET>
//   Collections: pets (on items.create, items.update, items.delete)
//
app.http('pet-sync-webhook', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    if (request.method === 'OPTIONS') {
      return corsPreflight(request, 'POST, OPTIONS', 'Content-Type, X-Webhook-Secret');
    }

    const WEBHOOK_SECRET = (process.env.DIRECTUS_WEBHOOK_SECRET || '').trim();
    const GITHUB_PAT     = (process.env.GITHUB_DISPATCH_PAT || '').trim();
    const REPO_OWNER     = (process.env.GITHUB_REPO_OWNER || '').trim();
    const REPO_NAME      = (process.env.GITHUB_REPO_NAME || '').trim();

    // --- 1. Validate configuration ---
    if (!WEBHOOK_SECRET || !GITHUB_PAT || !REPO_OWNER || !REPO_NAME) {
      context.warn('[PetSyncWebhook] Missing required environment variables.');
      return { status: 503, headers: corsHeaders(request, { 'Content-Type': 'application/json' }), body: JSON.stringify({ error: 'Webhook not configured' }) };
    }

    // --- 2. Validate secret ---
    const incomingSecret = (request.headers.get('x-webhook-secret') || '').trim();
    const expectedBuf = Buffer.from(WEBHOOK_SECRET);
    const incomingBuf = Buffer.from(incomingSecret);
    let secretValid = false;
    try {
      secretValid =
        expectedBuf.length === incomingBuf.length &&
        crypto.timingSafeEqual(expectedBuf, incomingBuf);
    } catch {
      secretValid = false;
    }

    if (!secretValid) {
      context.warn('[PetSyncWebhook] Rejected: invalid secret.');
      return { status: 401, headers: corsHeaders(request, { 'Content-Type': 'application/json' }), body: JSON.stringify({ error: 'Unauthorized' }) };
    }

    // --- 3. Parse Directus event payload (for logging, non-blocking) ---
    let eventInfo = {};
    try {
      const body = await request.json();
      eventInfo = {
        collection: body?.collection || 'unknown',
        event: body?.event || 'unknown',
        keys: body?.keys || body?.key || [],
      };
    } catch {
      // Non-JSON bodies (e.g. plain pings) are fine — we still rebuild
      eventInfo = { collection: 'pets', event: 'ping' };
    }

    context.log('[PetSyncWebhook] Received event:', eventInfo);

    // --- 4. Fire GitHub repository_dispatch (async, we don't await GitHub's processing) ---
    const dispatchUrl = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/dispatches`;
    try {
      const ghRes = await fetch(dispatchUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${GITHUB_PAT}`,
          'Accept': 'application/vnd.github+json',
          'Content-Type': 'application/json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
        body: JSON.stringify({
          event_type: 'cms_rebuild',
          client_payload: {
            triggered_by: 'pet-sync-webhook',
            collection: eventInfo.collection,
            event: eventInfo.event,
            timestamp: new Date().toISOString(),
          },
        }),
      });

      if (!ghRes.ok) {
        const ghBody = await ghRes.text().catch(() => '');
        context.warn(`[PetSyncWebhook] GitHub dispatch failed: ${ghRes.status} — ${ghBody}`);
        return {
          status: 502,
          headers: corsHeaders(request, { 'Content-Type': 'application/json' }),
          body: JSON.stringify({ error: 'Failed to dispatch rebuild', github_status: ghRes.status }),
        };
      }

      context.log('[PetSyncWebhook] Rebuild dispatched to GitHub Actions successfully.');
      return {
        status: 202,
        headers: corsHeaders(request, { 'Content-Type': 'application/json' }),
        body: JSON.stringify({ ok: true, message: 'Rebuild queued', event: eventInfo }),
      };
    } catch (err) {
      context.error('[PetSyncWebhook] Network error dispatching to GitHub:', err);
      return {
        status: 502,
        headers: corsHeaders(request, { 'Content-Type': 'application/json' }),
        body: JSON.stringify({ error: 'Network error reaching GitHub' }),
      };
    }
  },
});

