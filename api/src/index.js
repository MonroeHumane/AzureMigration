const { app } = require('@azure/functions');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const reportData = require('../data/published_2026_ytd.json');
const statementData = require('../data/statement_2026_08.json');

const DIRECTUS_URL = process.env.DIRECTUS_URL || 'https://mchs-directus.livelyfield-d0a70609.eastus.azurecontainerapps.io';
const STAFF_SECRET = process.env.STAFF_AUTH_SECRET || 'mchs-staff-session-portal-secret-key-2026';

const STATEMENT_FILES = {
  bank: 'First_Merchant_Chkng_XXXXXX8478_08312026.pdf',
  qbo: 'QBO_Reconciliation_Report_08312026.pdf',
};

// Helper: Generate persistent HMAC-signed staff session token
function createStaffToken(email) {
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
      // Enforce 30-day maximum session lifetime (2,592,000,000 ms)
      const MAX_SESSION_AGE = 30 * 24 * 60 * 60 * 1000;
      if (data.iat && (Date.now() - data.iat > MAX_SESSION_AGE)) {
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

// 1. POST /api/login
app.http('login', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    if (request.method === 'OPTIONS') {
      return {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Authorization, Content-Type',
        },
      };
    }

    try {
      const body = await request.json();
      const { email, password } = body || {};

      if (!email || !password) {
        return {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
          jsonBody: { error: 'Email and password are required.' },
        };
      }

      // Authenticate against Directus CMS
      const directusRes = await fetch(`${DIRECTUS_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!directusRes.ok) {
        return {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
          jsonBody: { error: 'Invalid email or password.' },
        };
      }

      const directusData = await directusRes.json();
      const staffToken = createStaffToken(email);

      return {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, private',
        },
        jsonBody: {
          ok: true,
          token: staffToken,
          email: email,
          directus: directusData && directusData.data ? directusData.data : null,
        },
      };
    } catch (err) {
      console.error('Error in /api/login:', err);
      return {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
        jsonBody: { error: 'Internal authentication error.' },
      };
    }
  },
});

// 2. POST /api/session (Exchange Directus token for persistent staff session token)
app.http('session', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    if (request.method === 'OPTIONS') {
      return {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Authorization, Content-Type',
        },
      };
    }

    try {
      let token = '';
      const authHeader = request.headers.get('authorization') || '';
      if (authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7).trim();
      }

      if (!token) {
        try {
          const body = await request.json();
          token = body?.directus_token || body?.token || '';
        } catch {}
      }

      if (!token) {
        return {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
          jsonBody: { error: 'Directus Bearer token required.' },
        };
      }

      // Check if already an HMAC staff token
      const existing = verifyStaffToken(token);
      if (existing) {
        return {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
          jsonBody: { ok: true, token, email: existing.email },
        };
      }

      // Verify with Directus
      const user = await verifyDirectusToken(token);
      if (!user) {
        return {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
          jsonBody: { error: 'Invalid or expired Directus token.' },
        };
      }

      const staffToken = createStaffToken(user.email || 'staff@monroe-humane.org');
      return {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        jsonBody: { ok: true, token: staffToken, email: user.email },
      };
    } catch (err) {
      console.error('Error in /api/session:', err);
      return {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
        jsonBody: { error: 'Internal session error.' },
      };
    }
  },
});

// 3. GET /api/financials
app.http('financials', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    if (request.method === 'OPTIONS') {
      return {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Authorization, Content-Type',
        },
      };
    }

    const authHeader = request.headers.get('authorization') || '';
    if (!authHeader.startsWith('Bearer ')) {
      return {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, private',
        },
        jsonBody: { error: 'Unauthorized: Bearer token required.' },
      };
    }

    const token = authHeader.substring(7).trim();
    const staff = await authenticateRequest(token);
    if (!staff) {
      return {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, private',
        },
        jsonBody: { error: 'Unauthorized: Invalid or expired token.' },
      };
    }

    return {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'private, no-cache, no-store, must-revalidate',
      },
      jsonBody: {
        ...reportData,
        bank_statement: statementData,
      },
    };
  },
});

// 4. GET /api/statement
app.http('statement', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    if (request.method === 'OPTIONS') {
      return {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Authorization, Content-Type',
        },
      };
    }

    // Support token via header or query param
    let token = '';
    const authHeader = request.headers.get('authorization') || '';
    if (authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    } else {
      token = request.query.get('token') || '';
    }

    if (!token) {
      return {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, private',
        },
        jsonBody: { error: 'Unauthorized: Staff Bearer token required.' },
      };
    }

    const staff = await authenticateRequest(token);
    if (!staff) {
      return {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, private',
        },
        jsonBody: { error: 'Unauthorized: Invalid or expired token.' },
      };
    }

    const docKey = request.query.get('doc') || 'bank';
    const fileName = STATEMENT_FILES[docKey];
    if (!fileName) {
      return {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
        jsonBody: { error: 'Invalid document requested. Allowed: bank, qbo' },
      };
    }

    const filePath = path.join(__dirname, '..', 'data', 'files', fileName);
    if (!fs.existsSync(filePath)) {
      return {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
        jsonBody: { error: 'Requested statement file not found.' },
      };
    }

    const fileBuffer = fs.readFileSync(filePath);
    return {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${fileName}"`,
        'Cache-Control': 'private, no-cache, no-store, must-revalidate',
      },
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
      return {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      };
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

      return {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        jsonBody: { ok: true },
      };
    } catch (e) {
      return {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
        jsonBody: { error: 'Invalid error payload' },
      };
    }
  },
});

