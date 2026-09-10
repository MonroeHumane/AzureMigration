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
const bankInOutData = loadJsonOptional('../data/bank_in_out_2026.json');
const bankInOut2024 = loadJsonOptional('../data/bank_in_out_2024.json');
const bankInOut2025 = loadJsonOptional('../data/bank_in_out_2025.json');

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

const BANK_PACKS = {
  2024: bankInOut2024,
  2025: bankInOut2025,
  2026: bankInOutData,
};

function indexBankStatementFiles(pack, into) {
  if (!pack || !pack.months) return;
  Object.keys(pack.months).forEach((key) => {
    const fileName = pack.months[key] && pack.months[key].statement_file;
    if (fileName && /^First_Merchant_Chkng_XXXXXX8478_\d{8}\.pdf$/.test(fileName)) {
      into[key] = fileName;
    }
  });
}

function mergeBankStatementPacks() {
  const months = {};
  const ytdByYear = {};
  const years = [];
  [2024, 2025, 2026].forEach((year) => {
    const pack = BANK_PACKS[year];
    if (!pack || !pack.months) return;
    years.push(String(year));
    Object.assign(months, pack.months);
    if (pack.meta && pack.meta.ytd) ytdByYear[String(year)] = pack.meta.ytd;
  });
  const base = bankInOutData && typeof bankInOutData === 'object' ? bankInOutData : { meta: {}, months: {} };
  return {
    ...base,
    months,
    meta: Object.assign({}, base.meta || {}, {
      years,
      default_year: '2026',
      ytd_by_year: ytdByYear,
    }),
  };
}

const BANK_STATEMENT_BY_MONTH = {};
[2024, 2025, 2026].forEach((year) => indexBankStatementFiles(BANK_PACKS[year], BANK_STATEMENT_BY_MONTH));
if (!BANK_STATEMENT_BY_MONTH['2026-08']) {
  BANK_STATEMENT_BY_MONTH['2026-08'] = STATEMENT_FILES.bank;
}

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
    if (bankInOutData || bankInOut2024 || bankInOut2025) {
      payload.bank_statements = mergeBankStatementPacks();
    }

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

const GRANT_STATUSES = new Set(['open', 'watch', 'applied', 'awarded', 'skipped']);
let cachedDirectusService = { token: '', expiresAt: 0 };

function sanitizeGrantInput(body) {
  const title = String(body?.title || '').trim().slice(0, 255);
  if (!title) {
    return { error: 'Grant title is required.' };
  }
  const source = String(body?.source || 'Manual').trim().slice(0, 120) || 'Manual';
  const statusRaw = String(body?.status || 'open').trim().toLowerCase();
  const status = GRANT_STATUSES.has(statusRaw) ? statusRaw : 'open';
  const deadline_notes = body?.deadline_notes == null ? '' : String(body.deadline_notes).slice(0, 4000);
  const payload = { title, source, status, deadline_notes };
  if (body?.open_url != null) payload.open_url = String(body.open_url).trim().slice(0, 500);
  if (body?.apply_url != null) payload.apply_url = String(body.apply_url).trim().slice(0, 500);
  return { payload };
}

async function getDirectusServiceToken() {
  if (cachedDirectusService.token && Date.now() < cachedDirectusService.expiresAt) {
    return cachedDirectusService.token;
  }

  const candidates = [
    (process.env.DIRECTUS_NEWSLETTER_TOKEN || '').trim(),
    (process.env.DIRECTUS_TOKEN || '').trim(),
  ].filter(Boolean);

  for (const token of candidates) {
    try {
      const probe = await fetch(`${DIRECTUS_URL}/items/newsletter_issues?limit=1&fields=id`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(4000),
      });
      if (probe.ok) {
        cachedDirectusService = { token, expiresAt: Date.now() + 10 * 60 * 1000 };
        return token;
      }
    } catch {
      // try next candidate
    }
  }

  const email = (process.env.DIRECTUS_ADMIN_EMAIL || 'admin@monroe-humane.org').trim();
  const password = (process.env.DIRECTUS_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || '').trim();
  if (!password) return null;

  const res = await fetch(`${DIRECTUS_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    cachedDirectusService = { token: '', expiresAt: 0 };
    return null;
  }
  const data = await res.json();
  const token = data && data.data && data.data.access_token ? data.data.access_token : null;
  const ttl = typeof data?.data?.expires === 'number' && data.data.expires < 1e12
    ? data.data.expires
    : 10 * 60 * 1000;
  if (token) {
    cachedDirectusService = { token, expiresAt: Date.now() + Math.max(60 * 1000, ttl - 60 * 1000) };
  }
  return token;
}

async function directusJson(path, options, token) {
  const res = await fetch(`${DIRECTUS_URL}${path}`, {
    ...options,
    headers: Object.assign({
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    }, options && options.headers ? options.headers : {}),
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return { ok: res.ok, status: res.status, json };
}

async function requireStaff(request) {
  if (!isStaffSecretConfigured()) {
    return { errorResponse: staffAuthUnavailable(request) };
  }
  const token = bearerToken(request);
  if (!token) {
    return { errorResponse: jsonResponse(request, 401, { error: 'Unauthorized: Bearer token required.' }, { 'Cache-Control': 'no-store, private' }) };
  }
  const staff = await authenticateRequest(token);
  if (!staff) {
    return { errorResponse: jsonResponse(request, 401, { error: 'Unauthorized: Invalid or expired token.' }, { 'Cache-Control': 'no-store, private' }) };
  }
  return { staff };
}

// Authenticated shelter census. Staff pages hydrate after getStaffToken()
// so unauthenticated HTML never embeds pet names.
app.http('staffPets', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'staff-pets',
  handler: async (request) => {
    if (request.method === 'OPTIONS') {
      return corsPreflight(request, 'GET, OPTIONS');
    }

    const auth = await requireStaff(request);
    if (auth.errorResponse) return auth.errorResponse;

    const serviceToken = await getDirectusServiceToken();
    if (!serviceToken) {
      return jsonResponse(request, 503, {
        error: 'Pet census service is not configured.',
        code: 'DIRECTUS_SERVICE_UNAVAILABLE',
      }, { 'Cache-Control': 'no-store, private' });
    }

    try {
      const result = await directusJson(
        '/items/pets?limit=-1&sort=-last_seen_at',
        { method: 'GET', signal: AbortSignal.timeout(15000) },
        serviceToken
      );
      if (!result.ok || !result.json || !Array.isArray(result.json.data)) {
        return jsonResponse(request, result.status || 502, {
          error: 'Could not load shelter census.',
        }, { 'Cache-Control': 'no-store, private' });
      }

      const pets = result.json.data.map((p) => ({
        id: p.id,
        name: p.name,
        type: p.type,
        species_label: p.species_label,
        breed: p.breed,
        age: p.age,
        age_display: p.age_display,
        size: p.size,
        color: p.color,
        gender: p.gender,
        location: p.location,
        image: p.image_url || p.image || '/assets/recovered/images/placeholder.svg',
        url: p.url,
        description: p.description,
        intake_date: p.intake_date,
        first_seen_at: p.first_seen_at,
        last_seen_at: p.last_seen_at,
        archived_at: p.archived_at || null,
        stage: p.stage,
        declawed: p.declawed,
        housetrained: p.housetrained,
      }));

      const activeCount = pets.filter((p) => !p.archived_at).length;
      const archivedCount = pets.filter((p) => !!p.archived_at).length;
      const lastSyncTimestamp = pets.reduce((latest, p) => {
        const t = p.last_seen_at;
        if (!t) return latest;
        if (!latest) return t;
        return new Date(t) > new Date(latest) ? t : latest;
      }, null);

      return jsonResponse(request, 200, {
        ok: true,
        data: {
          lastSyncTimestamp,
          activeCount,
          archivedCount,
          totalCount: pets.length,
          pets,
        },
      }, { 'Cache-Control': 'no-store, private' });
    } catch (err) {
      console.error('Error in /api/staff-pets:', err);
      return jsonResponse(request, 500, {
        error: 'Internal census error.',
      }, { 'Cache-Control': 'no-store, private' });
    }
  },
});

// HMAC-authenticated grants pipeline proxy. Staff portal HMAC lasts ~30 days;
// Directus JWTs expire in minutes, so the tracker cannot depend on them.
app.http('grants', {
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'grants/{id?}',
  handler: async (request, context) => {
    if (request.method === 'OPTIONS') {
      return corsPreflight(request, 'GET, POST, PATCH, DELETE, OPTIONS');
    }

    const auth = await requireStaff(request);
    if (auth.errorResponse) return auth.errorResponse;

    const serviceToken = await getDirectusServiceToken();
    if (!serviceToken) {
      return jsonResponse(request, 503, {
        error: 'Grants service is not configured.',
        code: 'DIRECTUS_SERVICE_UNAVAILABLE',
      }, { 'Cache-Control': 'no-store, private' });
    }

    const id = (request.params && request.params.id ? String(request.params.id) : '').trim();

    try {
      if (request.method === 'GET') {
        const attempts = [
          '/items/grants?limit=-1&sort=-date_created',
          '/items/grants?limit=-1&sort=-date_updated',
          '/items/grants?limit=-1',
        ];
        let last = null;
        for (const path of attempts) {
          last = await directusJson(path, { method: 'GET' }, serviceToken);
          if (last.ok) {
            const data = Array.isArray(last.json && last.json.data) ? last.json.data : [];
            return jsonResponse(request, 200, { ok: true, data }, { 'Cache-Control': 'private, no-store' });
          }
          const message = String(last.json && last.json.errors && last.json.errors[0] && last.json.errors[0].message || '');
          if (!/sort|field/i.test(message)) break;
        }
        context.warn('[Grants] Directus list failed', last && last.status, last && last.json);
        return jsonResponse(request, last && last.status === 403 ? 403 : 502, {
          error: 'Could not load grants from Directus.',
          code: 'GRANTS_READ_FAILED',
        }, { 'Cache-Control': 'no-store, private' });
      }

      if (request.method === 'POST') {
        const body = await request.json().catch(() => ({}));
        const sanitized = sanitizeGrantInput(body);
        if (sanitized.error) {
          return jsonResponse(request, 400, { error: sanitized.error }, { 'Cache-Control': 'no-store, private' });
        }
        const created = await directusJson('/items/grants', {
          method: 'POST',
          body: JSON.stringify(sanitized.payload),
        }, serviceToken);
        if (!created.ok) {
          context.warn('[Grants] Directus create failed', created.status, created.json);
          return jsonResponse(request, 502, { error: 'Could not save grant.' }, { 'Cache-Control': 'no-store, private' });
        }
        return jsonResponse(request, 201, { ok: true, data: created.json && created.json.data }, { 'Cache-Control': 'no-store, private' });
      }

      if (!id) {
        return jsonResponse(request, 400, { error: 'Grant id is required.' }, { 'Cache-Control': 'no-store, private' });
      }

      if (request.method === 'PATCH') {
        const body = await request.json().catch(() => ({}));
        const sanitized = sanitizeGrantInput({ ...body, title: body.title || 'Grant' });
        if (sanitized.error) {
          return jsonResponse(request, 400, { error: sanitized.error }, { 'Cache-Control': 'no-store, private' });
        }
        if (!body.title) delete sanitized.payload.title;
        const updated = await directusJson(`/items/grants/${encodeURIComponent(id)}`, {
          method: 'PATCH',
          body: JSON.stringify(sanitized.payload),
        }, serviceToken);
        if (!updated.ok) {
          context.warn('[Grants] Directus update failed', updated.status, updated.json);
          return jsonResponse(request, 502, { error: 'Could not update grant.' }, { 'Cache-Control': 'no-store, private' });
        }
        return jsonResponse(request, 200, { ok: true, data: updated.json && updated.json.data }, { 'Cache-Control': 'no-store, private' });
      }

      if (request.method === 'DELETE') {
        const deleted = await directusJson(`/items/grants/${encodeURIComponent(id)}`, {
          method: 'DELETE',
        }, serviceToken);
        if (!deleted.ok) {
          context.warn('[Grants] Directus delete failed', deleted.status, deleted.json);
          return jsonResponse(request, 502, { error: 'Could not delete grant.' }, { 'Cache-Control': 'no-store, private' });
        }
        return jsonResponse(request, 200, { ok: true }, { 'Cache-Control': 'no-store, private' });
      }

      return jsonResponse(request, 405, { error: 'Method not allowed.' }, { 'Cache-Control': 'no-store, private' });
    } catch (err) {
      context.error('[Grants] Unexpected error', err);
      return jsonResponse(request, 500, { error: 'Grants service error.' }, { 'Cache-Control': 'no-store, private' });
    }
  },
});

const NEWSLETTER_STATUSES = new Set(['draft', 'published', 'archived', 'scheduled']);
const NEWSLETTER_LIST_FIELDS = 'id,status,title,slug,issue_date,featured,excerpt,hero_image,pdf_url,publish_at,seo_title,seo_description,date_updated';
const NEWSLETTER_PUBLIC_FIELDS = `${NEWSLETTER_LIST_FIELDS},byline,top_line,newsletter_title,main_headline,heading,lead,blocks`;
const NEWSLETTER_ASSET_HOST = 'mchs-directus.livelyfield-d0a70609.eastus.azurecontainerapps.io';

function slugifyNewsletter(title) {
  const slug = String(title || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return slug || 'issue';
}

function isAllowedNewsletterUrl(url) {
  const s = String(url || '').trim();
  if (!s) return true;
  if (s.startsWith('/assets/')) return true;
  try {
    const parsed = new URL(s);
    if (parsed.protocol !== 'https:') return false;
    if (parsed.hostname === NEWSLETTER_ASSET_HOST && parsed.pathname.startsWith('/assets/')) return true;
    return true;
  } catch {
    return false;
  }
}

function sanitizeNewsletterBlocks(blocks) {
  if (!Array.isArray(blocks)) return [];
  return blocks.slice(0, 40).map((block, index) => ({
    id: String(block && block.id ? block.id : index + 1).slice(0, 64),
    type: 'story',
    title: String(block && block.title ? block.title : '').slice(0, 255),
    body: String(block && block.body ? block.body : '').slice(0, 20000),
  }));
}

function sanitizeNewsletterInput(body, options) {
  const partial = !!(options && options.partial);
  const title = String(body && body.title != null ? body.title : '').trim().slice(0, 255);
  if (!partial && !title) {
    return { error: 'Issue title is required.' };
  }
  if (partial && body && body.title != null && !title) {
    return { error: 'Issue title is required.' };
  }
  const payload = {};
  if (title) payload.title = title;
  if (body && body.slug != null) {
    payload.slug = slugifyNewsletter(body.slug);
  } else if (title && !partial) {
    payload.slug = slugifyNewsletter(title);
  }
  if (body && body.status != null) {
    const statusRaw = String(body.status || '').trim().toLowerCase();
    payload.status = NEWSLETTER_STATUSES.has(statusRaw) ? statusRaw : 'draft';
  } else if (!partial) {
    payload.status = 'draft';
  }
  if (payload.status === 'scheduled' && !(body && body.publish_at)) {
    return { error: 'Scheduled issues need a publish date and time.' };
  }
  if (body && body.issue_date != null) payload.issue_date = String(body.issue_date).trim().slice(0, 64);
  if (body && body.heading != null) payload.heading = String(body.heading).trim().slice(0, 255);
  if (body && body.lead != null) payload.lead = String(body.lead).slice(0, 4000);
  if (body && body.byline != null) payload.byline = String(body.byline).trim().slice(0, 128);
  if (body && body.hero_image != null) {
    const hero = String(body.hero_image).trim().slice(0, 512);
    if (!isAllowedNewsletterUrl(hero)) return { error: 'Hero image must be an https URL or /assets/ path.' };
    payload.hero_image = hero;
  }
  if (body && body.excerpt != null) payload.excerpt = String(body.excerpt).slice(0, 4000);
  if (body && body.pdf_url != null) {
    const pdf = String(body.pdf_url).trim().slice(0, 512);
    if (!isAllowedNewsletterUrl(pdf)) return { error: 'PDF URL must be an https URL or /assets/ path.' };
    payload.pdf_url = pdf;
  }
  if (body && body.top_line != null) payload.top_line = String(body.top_line).trim().slice(0, 255);
  if (body && body.newsletter_title != null) payload.newsletter_title = String(body.newsletter_title).trim().slice(0, 255);
  if (body && body.main_headline != null) payload.main_headline = String(body.main_headline).trim().slice(0, 255);
  if (body && body.seo_title != null) payload.seo_title = String(body.seo_title).trim().slice(0, 255);
  if (body && body.seo_description != null) payload.seo_description = String(body.seo_description).slice(0, 400);
  if (body && body.publish_at != null) payload.publish_at = String(body.publish_at).trim().slice(0, 64);
  if (body && Object.prototype.hasOwnProperty.call(body, 'featured')) payload.featured = !!body.featured;
  if (payload.featured && payload.status && payload.status !== 'published') {
    payload.featured = false;
  }
  if (body && body.blocks != null) payload.blocks = sanitizeNewsletterBlocks(body.blocks);
  return { payload };
}

function xmlResponse(request, status, xml, contentType, extraHeaders) {
  return {
    status,
    headers: corsHeaders(request, Object.assign({
      'Content-Type': contentType || 'application/rss+xml; charset=utf-8',
    }, extraHeaders || {})),
    body: xml,
  };
}

function escapeXml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function logNewsletter(context, staff, action, extra) {
  const email = staff && staff.email ? staff.email : 'anonymous';
  const bits = extra ? Object.keys(extra).map((key) => `${key}=${extra[key]}`).join(' ') : '';
  context.log(`[Newsletters] ${action} staff=${email} ${bits}`.trim());
}

async function findNewsletterSlugClash(serviceToken, slug, excludeId) {
  const encoded = encodeURIComponent(slug);
  const found = await directusJson(
    `/items/newsletter_issues?filter[slug][_eq]=${encoded}&limit=5&fields=id,slug`,
    { method: 'GET' },
    serviceToken
  );
  const rows = found.ok && Array.isArray(found.json && found.json.data) ? found.json.data : [];
  return rows.find((row) => String(row.id) !== String(excludeId || '')) || null;
}

async function ensureUniqueNewsletterSlug(serviceToken, slug, excludeId) {
  let candidate = slug;
  for (let i = 0; i < 20; i += 1) {
    const clash = await findNewsletterSlugClash(serviceToken, candidate, excludeId);
    if (!clash) return candidate;
    candidate = `${slug}-${i + 2}`.slice(0, 80);
  }
  return `${slug}-${Date.now()}`.slice(0, 80);
}

async function clearOtherFeaturedIssues(serviceToken, keepId) {
  const bulk = await directusJson(
    `/items/newsletter_issues?filter[featured][_eq]=true&filter[id][_neq]=${encodeURIComponent(keepId)}`,
    { method: 'PATCH', body: JSON.stringify({ featured: false }) },
    serviceToken
  );
  if (bulk.ok) return;
  const listed = await directusJson(
    '/items/newsletter_issues?filter[featured][_eq]=true&fields=id&limit=50',
    { method: 'GET' },
    serviceToken
  );
  const rows = listed.ok && Array.isArray(listed.json && listed.json.data) ? listed.json.data : [];
  for (const row of rows) {
    if (String(row.id) === String(keepId)) continue;
    await directusJson(`/items/newsletter_issues/${encodeURIComponent(row.id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ featured: false }),
    }, serviceToken);
  }
}

async function fetchPublishedNewsletterIssues(serviceToken) {
  return directusJson(
    '/items/newsletter_issues?filter[status][_eq]=published&sort=-issue_date,-id&limit=50',
    { method: 'GET' },
    serviceToken
  );
}

async function applyDueScheduledIssues(serviceToken, context) {
  const nowIso = new Date().toISOString();
  const listed = await directusJson(
    `/items/newsletter_issues?filter[status][_eq]=scheduled&filter[publish_at][_lte]=${encodeURIComponent(nowIso)}&fields=id,featured,status,publish_at&limit=50`,
    { method: 'GET' },
    serviceToken
  );
  if (!listed.ok) {
    if (context) context.warn('[Newsletters] scheduled list failed', listed.status);
    return { published: 0 };
  }
  const rows = Array.isArray(listed.json && listed.json.data) ? listed.json.data : [];
  let published = 0;
  for (const row of rows) {
    const updated = await directusJson(`/items/newsletter_issues/${encodeURIComponent(row.id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'published' }),
    }, serviceToken);
    if (updated.ok) {
      published += 1;
      if (row.featured) await clearOtherFeaturedIssues(serviceToken, row.id);
    }
  }
  return { published };
}

function xmlTextResponse(request, xml, extraHeaders) {
  return xmlResponse(request, 200, xml, 'application/rss+xml; charset=utf-8', extraHeaders);
}

function buildNewsletterRss(issues) {
  const site = 'https://monroe-humane.org';
  const items = (issues || []).map((issue) => {
    const link = `${site}/newsletter/issue/${encodeURIComponent(issue.slug || '')}`;
    const desc = escapeXml(issue.excerpt || issue.seo_description || issue.lead || '');
    const date = issue.issue_date ? new Date(`${issue.issue_date}T12:00:00Z`).toUTCString() : new Date().toUTCString();
    return `<item><title>${escapeXml(issue.title || 'Untitled')}</title><link>${link}</link><guid isPermaLink="true">${link}</guid><pubDate>${date}</pubDate><description>${desc}</description></item>`;
  }).join('');
  return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Monroe Humane Society Newsletter</title><link>${site}/newsletter/</link><description>Published shelter newsletters</description>${items}</channel></rss>`;
}

function buildNewsletterSitemap(issues) {
  const site = 'https://monroe-humane.org';
  const urls = [`${site}/newsletter/`].concat((issues || []).filter((issue) => issue.slug).map((issue) => `${site}/newsletter/issue/${encodeURIComponent(issue.slug)}`));
  const body = urls.map((loc) => `<url><loc>${escapeXml(loc)}</loc></url>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</urlset>`;
}

app.http('newsletters', {
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'newsletters/{id?}',
  handler: async (request, context) => {
    if (request.method === 'OPTIONS') {
      return corsPreflight(request, 'GET, POST, PATCH, DELETE, OPTIONS');
    }

    const id = (request.params && request.params.id ? String(request.params.id) : '').trim();
    const serviceToken = await getDirectusServiceToken();
    if (!serviceToken) {
      return jsonResponse(request, 503, {
        error: 'Newsletter service is not configured.',
        code: 'DIRECTUS_SERVICE_UNAVAILABLE',
      }, { 'Cache-Control': 'no-store, private' });
    }

    try {
      if (request.method === 'GET' && (id === 'rss' || id === 'sitemap' || id === 'public')) {
        await applyDueScheduledIssues(serviceToken, context);
        const listed = await fetchPublishedNewsletterIssues(serviceToken);
        if (!listed.ok) {
          context.warn('[Newsletters] public Directus read failed', listed.status);
          return jsonResponse(request, 502, {
            error: 'Could not load published newsletters.',
            code: 'NEWSLETTERS_PUBLIC_READ_FAILED',
          }, { 'Cache-Control': 'no-store' });
        }
        const data = Array.isArray(listed.json && listed.json.data) ? listed.json.data : [];
        if (id === 'rss') {
          return xmlTextResponse(request, buildNewsletterRss(data), { 'Cache-Control': 'public, max-age=300' });
        }
        if (id === 'sitemap') {
          return xmlResponse(request, 200, buildNewsletterSitemap(data), 'application/xml; charset=utf-8', { 'Cache-Control': 'public, max-age=300' });
        }
        const url = new URL(request.url);
        const slug = (url.searchParams.get('slug') || '').trim();
        const featuredOnly = url.searchParams.get('featured') === '1' || url.searchParams.get('featured') === 'true';
        let rows = data;
        if (slug) rows = data.filter((row) => row.slug === slug);
        else if (featuredOnly) rows = data.filter((row) => row.featured).slice(0, 1);
        return jsonResponse(request, 200, { ok: true, data: rows }, { 'Cache-Control': 'public, s-maxage=60' });
      }

      const auth = await requireStaff(request);
      if (auth.errorResponse) return auth.errorResponse;
      const staff = auth.staff || {};

      if (request.method === 'POST' && id === 'upload') {
        const form = await request.formData().catch(() => null);
        const file = form && (form.get('file') || form.get('hero'));
        if (!file || typeof file.arrayBuffer !== 'function') {
          return jsonResponse(request, 400, { error: 'A file field named file is required.' }, { 'Cache-Control': 'no-store, private' });
        }
        const name = String(file.name || 'hero.jpg').replace(/[^\w.\-]+/g, '_').slice(0, 120);
        const type = String(file.type || 'application/octet-stream');
        if (!/^image\/(jpeg|png|webp|gif)$/i.test(type) && !/\.(jpe?g|png|webp|gif)$/i.test(name)) {
          return jsonResponse(request, 400, { error: 'Upload a JPEG, PNG, WebP, or GIF image.' }, { 'Cache-Control': 'no-store, private' });
        }
        const outbound = new FormData();
        outbound.append('file', file, name);
        const uploaded = await fetch(`${DIRECTUS_URL}/files`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${serviceToken}` },
          body: outbound,
        });
        const uploadedJson = await uploaded.json().catch(() => ({}));
        if (!uploaded.ok || !uploadedJson.data || !uploadedJson.data.id) {
          context.warn('[Newsletters] file upload failed', uploaded.status);
          return jsonResponse(request, 502, { error: 'Could not upload image.' }, { 'Cache-Control': 'no-store, private' });
        }
        const assetUrl = `${DIRECTUS_URL}/assets/${uploadedJson.data.id}`;
        logNewsletter(context, staff, 'upload', { file: uploadedJson.data.id });
        return jsonResponse(request, 201, { ok: true, data: { id: uploadedJson.data.id, url: assetUrl } }, { 'Cache-Control': 'no-store, private' });
      }

      if (request.method === 'GET' && !id) {
        const url = new URL(request.url);
        const includeArchived = url.searchParams.get('include') === 'archived';
        const filter = includeArchived ? '' : '&filter[status][_neq]=archived';
        const listed = await directusJson(
          `/items/newsletter_issues?limit=100&sort=-issue_date,-id&fields=${NEWSLETTER_LIST_FIELDS}${filter}`,
          { method: 'GET' },
          serviceToken
        );
        if (!listed.ok) {
          context.warn('[Newsletters] Directus list failed', listed.status, listed.json);
          return jsonResponse(request, listed.status === 403 ? 403 : 502, {
            error: 'Could not load newsletters from Directus.',
            code: 'NEWSLETTERS_READ_FAILED',
          }, { 'Cache-Control': 'no-store, private' });
        }
        const data = Array.isArray(listed.json && listed.json.data) ? listed.json.data : [];
        logNewsletter(context, staff, 'list', { count: data.length, archived: includeArchived });
        return jsonResponse(request, 200, { ok: true, data }, { 'Cache-Control': 'private, no-store' });
      }

      if (request.method === 'GET' && id && !['rss', 'sitemap', 'public', 'upload'].includes(id)) {
        const detail = await directusJson(
          `/items/newsletter_issues/${encodeURIComponent(id)}`,
          { method: 'GET' },
          serviceToken
        );
        if (!detail.ok || !detail.json || !detail.json.data) {
          return jsonResponse(request, detail.status === 404 ? 404 : 502, { error: 'Issue not found.' }, { 'Cache-Control': 'no-store, private' });
        }
        logNewsletter(context, staff, 'read', { id });
        return jsonResponse(request, 200, { ok: true, data: detail.json.data }, { 'Cache-Control': 'private, no-store' });
      }

      if (request.method === 'POST' && !id) {
        const body = await request.json().catch(() => ({}));
        const sanitized = sanitizeNewsletterInput(body, { partial: false });
        if (sanitized.error) {
          return jsonResponse(request, 400, { error: sanitized.error }, { 'Cache-Control': 'no-store, private' });
        }
        sanitized.payload.slug = await ensureUniqueNewsletterSlug(serviceToken, sanitized.payload.slug);
        const created = await directusJson('/items/newsletter_issues', {
          method: 'POST',
          body: JSON.stringify(sanitized.payload),
        }, serviceToken);
        if (!created.ok) {
          context.warn('[Newsletters] Directus create failed', created.status, created.json);
          return jsonResponse(request, 502, { error: 'Could not save newsletter issue.' }, { 'Cache-Control': 'no-store, private' });
        }
        const row = created.json && created.json.data;
        if (row && row.featured && row.id) {
          await clearOtherFeaturedIssues(serviceToken, row.id);
        }
        logNewsletter(context, staff, 'create', { id: row && row.id, status: sanitized.payload.status });
        return jsonResponse(request, 201, { ok: true, data: row }, { 'Cache-Control': 'no-store, private' });
      }

      if (!id) {
        return jsonResponse(request, 400, { error: 'Issue id is required.' }, { 'Cache-Control': 'no-store, private' });
      }

      if (request.method === 'PATCH') {
        const body = await request.json().catch(() => ({}));
        const sanitized = sanitizeNewsletterInput(body, { partial: true });
        if (sanitized.error) {
          return jsonResponse(request, 400, { error: sanitized.error }, { 'Cache-Control': 'no-store, private' });
        }
        if (sanitized.payload.status === 'draft') sanitized.payload.featured = false;
        if (sanitized.payload.featured === true) {
          const currentStatus = sanitized.payload.status
            || ((await directusJson(`/items/newsletter_issues/${encodeURIComponent(id)}?fields=status`, { method: 'GET' }, serviceToken)).json || {}).data?.status;
          if (currentStatus !== 'published') {
            return jsonResponse(request, 400, { error: 'Only a published issue can be featured on the homepage.' }, { 'Cache-Control': 'no-store, private' });
          }
        }
        const expectedUpdated = request.headers.get('if-match') || body.date_updated || body.expected_updated;
        if (expectedUpdated) {
          const current = await directusJson(`/items/newsletter_issues/${encodeURIComponent(id)}?fields=id,date_updated`, { method: 'GET' }, serviceToken);
          const liveUpdated = current.ok && current.json && current.json.data ? current.json.data.date_updated : null;
          if (liveUpdated && String(liveUpdated) !== String(expectedUpdated)) {
            return jsonResponse(request, 409, { error: 'This issue was saved by someone else. Reload and try again.', code: 'STALE_ISSUE' }, { 'Cache-Control': 'no-store, private' });
          }
        }
        if (sanitized.payload.slug) {
          const clash = await findNewsletterSlugClash(serviceToken, sanitized.payload.slug, id);
          if (clash) {
            return jsonResponse(request, 409, { error: 'That URL slug is already in use.', code: 'SLUG_TAKEN' }, { 'Cache-Control': 'no-store, private' });
          }
        }
        const updated = await directusJson(`/items/newsletter_issues/${encodeURIComponent(id)}`, {
          method: 'PATCH',
          body: JSON.stringify(sanitized.payload),
        }, serviceToken);
        if (!updated.ok) {
          context.warn('[Newsletters] Directus update failed', updated.status, updated.json);
          return jsonResponse(request, 502, { error: 'Could not update newsletter issue.' }, { 'Cache-Control': 'no-store, private' });
        }
        const row = updated.json && updated.json.data;
        if (sanitized.payload.featured === true || (row && row.featured)) {
          await clearOtherFeaturedIssues(serviceToken, id);
        }
        logNewsletter(context, staff, 'update', { id, status: sanitized.payload.status || (row && row.status) });
        return jsonResponse(request, 200, { ok: true, data: row }, { 'Cache-Control': 'no-store, private' });
      }

      if (request.method === 'DELETE') {
        const archived = await directusJson(`/items/newsletter_issues/${encodeURIComponent(id)}`, {
          method: 'PATCH',
          body: JSON.stringify({ status: 'archived', featured: false }),
        }, serviceToken);
        if (!archived.ok) {
          context.warn('[Newsletters] Directus archive failed', archived.status, archived.json);
          return jsonResponse(request, 502, { error: 'Could not archive newsletter issue.' }, { 'Cache-Control': 'no-store, private' });
        }
        logNewsletter(context, staff, 'archive', { id });
        return jsonResponse(request, 200, { ok: true, data: archived.json && archived.json.data }, { 'Cache-Control': 'no-store, private' });
      }

      return jsonResponse(request, 405, { error: 'Method not allowed.' }, { 'Cache-Control': 'no-store, private' });
    } catch (err) {
      context.error('[Newsletters] Unexpected error', err);
      return jsonResponse(request, 500, { error: 'Newsletter service error.' }, { 'Cache-Control': 'no-store, private' });
    }
  },
});

app.http('newslettersNested', {
  methods: ['GET', 'POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'newsletters/{id}/{action}/{rev?}',
  handler: async (request, context) => {
    if (request.method === 'OPTIONS') {
      return corsPreflight(request, 'GET, POST, OPTIONS');
    }
    const auth = await requireStaff(request);
    if (auth.errorResponse) return auth.errorResponse;
    const serviceToken = await getDirectusServiceToken();
    if (!serviceToken) {
      return jsonResponse(request, 503, { error: 'Newsletter service is not configured.' }, { 'Cache-Control': 'no-store, private' });
    }
    const id = (request.params && request.params.id ? String(request.params.id) : '').trim();
    const action = (request.params && request.params.action ? String(request.params.action) : '').trim();
    const rev = (request.params && request.params.rev ? String(request.params.rev) : '').trim();
    try {
      if (request.method === 'GET' && action === 'revisions') {
        const listed = await directusJson(
          `/revisions?filter[collection][_eq]=newsletter_issues&filter[item][_eq]=${encodeURIComponent(id)}&sort=-id&limit=25&fields=id,activity,data,delta,version`,
          { method: 'GET' },
          serviceToken
        );
        const data = listed.ok && Array.isArray(listed.json && listed.json.data) ? listed.json.data : [];
        logNewsletter(context, auth.staff, 'revisions', { id, count: data.length });
        return jsonResponse(request, 200, { ok: true, data }, { 'Cache-Control': 'private, no-store' });
      }
      if (request.method === 'POST' && action === 'restore' && rev) {
        const revision = await directusJson(`/revisions/${encodeURIComponent(rev)}`, { method: 'GET' }, serviceToken);
        const snap = revision.ok && revision.json && revision.json.data ? revision.json.data : null;
        let restoredPayload = snap && (snap.data || snap.delta);
        if (typeof restoredPayload === 'string') {
          try { restoredPayload = JSON.parse(restoredPayload); } catch { restoredPayload = null; }
        }
        if (!restoredPayload || typeof restoredPayload !== 'object') {
          return jsonResponse(request, 404, { error: 'Revision not found.' }, { 'Cache-Control': 'no-store, private' });
        }
        const sanitized = sanitizeNewsletterInput(Object.assign({}, restoredPayload, { status: 'draft', featured: false }), { partial: true });
        if (sanitized.error) {
          return jsonResponse(request, 400, { error: sanitized.error }, { 'Cache-Control': 'no-store, private' });
        }
        const next = Object.assign({}, sanitized.payload, { status: 'draft', featured: false });
        delete next.id;
        const updated = await directusJson(`/items/newsletter_issues/${encodeURIComponent(id)}`, {
          method: 'PATCH',
          body: JSON.stringify(next),
        }, serviceToken);
        if (!updated.ok) {
          return jsonResponse(request, 502, { error: 'Could not restore revision.' }, { 'Cache-Control': 'no-store, private' });
        }
        logNewsletter(context, auth.staff, 'restore', { id, rev });
        return jsonResponse(request, 200, { ok: true, data: updated.json && updated.json.data }, { 'Cache-Control': 'no-store, private' });
      }
      return jsonResponse(request, 405, { error: 'Method not allowed.' }, { 'Cache-Control': 'no-store, private' });
    } catch (err) {
      context.error('[Newsletters] Nested route error', err);
      return jsonResponse(request, 500, { error: 'Newsletter service error.' }, { 'Cache-Control': 'no-store, private' });
    }
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
    const month = request.query.get('month') || '2026-08';
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return jsonResponse(request, 400, { error: 'Invalid month. Use YYYY-MM.' });
    }

    let fileName = null;
    if (docKey === 'qbo') {
      if (month !== '2026-08') {
        return jsonResponse(request, 404, { error: 'QBO reconciliation PDF is available for August 2026 only.' });
      }
      fileName = STATEMENT_FILES.qbo;
    } else if (docKey === 'bank') {
      fileName = BANK_STATEMENT_BY_MONTH[month] || null;
    } else {
      return jsonResponse(request, 400, { error: 'Invalid document requested. Allowed: bank, qbo' });
    }

    if (!fileName) {
      return jsonResponse(request, 404, { error: 'No statement PDF for that month.' });
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
        'Access-Control-Expose-Headers': 'Content-Disposition',
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

// 7. GET /api/health (System status, feature availability, and connectivity monitor)
app.http('health', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    if (request.method === 'OPTIONS') {
      return corsPreflight(request, 'GET, OPTIONS');
    }

    let directusReachable = false;
    try {
      const pingController = new AbortController();
      const timeoutId = setTimeout(() => pingController.abort(), 2000);
      const pingRes = await fetch(`${DIRECTUS_URL}/server/ping`, {
        signal: pingController.signal,
      });
      clearTimeout(timeoutId);
      directusReachable = pingRes.ok;
    } catch {
      directusReachable = false;
    }

    const payload = {
      status: 'healthy',
      service: 'monroe-humane-api',
      version: '2.5.0',
      timestamp: new Date().toISOString(),
      features: {
        staffAuth: isStaffSecretConfigured(),
        grantsProxy: Boolean((process.env.DIRECTUS_NEWSLETTER_TOKEN || process.env.DIRECTUS_TOKEN || process.env.DIRECTUS_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || '').trim()),
        petSyncWebhook: Boolean(process.env.DIRECTUS_WEBHOOK_SECRET && process.env.GITHUB_DISPATCH_PAT),
        financialReports: Boolean(reportData),
        bankStatements: Boolean(statementData),
        donorDatabase: Boolean(donorDatabase),
      },
      directus: {
        url: DIRECTUS_URL,
        reachable: directusReachable,
      },
    };

    return jsonResponse(request, 200, payload, {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    });
  },
});

// 8. POST /api/inquiry (Public inquiry & form intake engine)
app.http('inquiry', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    if (request.method === 'OPTIONS') {
      return corsPreflight(request, 'POST, OPTIONS', 'Content-Type');
    }

    try {
      const body = await request.json();
      const {
        name,
        email,
        phone,
        topic = 'general',
        message,
        pet_id,
        _hp, // Honeypot field — bots fill this out, humans don't
      } = body || {};

      // Bot protection: if honeypot is populated, silently accept and discard
      if (_hp) {
        context.warn('[Inquiry] Bot submission discarded via honeypot.');
        return jsonResponse(request, 200, { ok: true, message: 'Thank you! Your message has been received.' });
      }

      if (!name || !email || !message) {
        return jsonResponse(request, 400, { error: 'Name, email, and message are required fields.' });
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(String(email).trim())) {
        return jsonResponse(request, 400, { error: 'Please provide a valid email address.' });
      }

      const cleanInquiry = {
        name: String(name).trim().slice(0, 100),
        email: String(email).trim().toLowerCase().slice(0, 120),
        phone: phone ? String(phone).trim().slice(0, 30) : null,
        topic: String(topic).trim().slice(0, 50),
        message: String(message).trim().slice(0, 3000),
        pet_id: pet_id ? String(pet_id).trim().slice(0, 50) : null,
        received_at: new Date().toISOString(),
        ip: request.headers.get('x-forwarded-for') || 'direct',
      };

      context.log('[Inquiry] Received valid inquiry:', {
        topic: cleanInquiry.topic,
        email: cleanInquiry.email,
        pet_id: cleanInquiry.pet_id,
      });

      return jsonResponse(request, 200, {
        ok: true,
        message: 'Thank you! Your inquiry has been sent to our shelter team.',
        received_at: cleanInquiry.received_at,
      });
    } catch (err) {
      context.error('[Inquiry] Error parsing submission:', err);
      return jsonResponse(request, 400, { error: 'Invalid submission payload.' });
    }
  },
});

// 9. /api/arcade-api/{*rest} — same-origin reverse proxy to the arcade Container App.
// SWA rewrites /arcade-api/* → /api/arcade-api/*. Preserve the /arcade-api prefix;
// the PHP app strips it. Do not change staff login/financials behavior.
const ARCADE_API_BASE = (process.env.ARCADE_API_BASE
  || 'https://mchs-arcade-api.livelyfield-d0a70609.eastus.azurecontainerapps.io').replace(/\/+$/, '');

const ARCADE_PROXY_REQUEST_HEADERS = [
  'cookie',
  'content-type',
  'authorization',
  'accept',
  'origin',
  'x-cleanup-secret',
  'x-requested-with',
];

const ARCADE_PROXY_SKIP_RESPONSE_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'content-encoding',
  'content-length',
  'host',
  'set-cookie',
]);

function arcadeProxyTargetUrl(request) {
  // SWA wildcard rewrites do not capture the tail. /arcade-api/* → /api/arcade-api/*
  // would call the Container App with a literal "*". Rewrite to a fixed function
  // path and recover the browser URL from x-ms-original-url.
  const originalHeader = (request.headers.get('x-ms-original-url') || '').trim();
  let incoming;
  try {
    incoming = new URL(originalHeader || request.url, request.url);
  } catch {
    incoming = new URL(request.url);
  }
  const marker = '/arcade-api';
  const idx = incoming.pathname.indexOf(marker);
  let pathAndRest;
  if (idx >= 0) {
    pathAndRest = incoming.pathname.slice(idx);
    if (pathAndRest === '/arcade-api/*' || pathAndRest === '/arcade-api/proxy') {
      pathAndRest = '/arcade-api';
    }
  } else {
    const rest = (request.params && request.params.rest) || '';
    pathAndRest = rest && rest !== 'proxy' && rest !== '*'
      ? `/arcade-api/${rest}`
      : '/arcade-api';
  }
  return ARCADE_API_BASE + pathAndRest + incoming.search;
}

app.http('arcadeProxy', {
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'arcade-api/{*rest}',
  handler: async (request, context) => {
    const targetUrl = arcadeProxyTargetUrl(request);
    const method = (request.method || 'GET').toUpperCase();
    const outboundHeaders = {};

    for (const name of ARCADE_PROXY_REQUEST_HEADERS) {
      const value = request.headers.get(name);
      if (value) {
        outboundHeaders[name] = value;
      }
    }

    const init = {
      method,
      headers: outboundHeaders,
      redirect: 'manual',
    };

    if (method !== 'GET' && method !== 'HEAD') {
      try {
        const buf = await request.arrayBuffer();
        if (buf && buf.byteLength > 0) {
          init.body = buf;
        }
      } catch {
        // No body (or already consumed) — still proxy method + query.
      }
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);
    init.signal = controller.signal;

    try {
      const upstream = await fetch(targetUrl, init);
      clearTimeout(timeoutId);

      const responseHeaders = {};
      upstream.headers.forEach((value, key) => {
        if (!ARCADE_PROXY_SKIP_RESPONSE_HEADERS.has(key.toLowerCase())) {
          responseHeaders[key] = value;
        }
      });

      const setCookies = typeof upstream.headers.getSetCookie === 'function'
        ? upstream.headers.getSetCookie()
        : [];
      if (setCookies.length === 1) {
        responseHeaders['Set-Cookie'] = setCookies[0];
      } else if (setCookies.length > 1) {
        responseHeaders['Set-Cookie'] = setCookies;
      }

      const bodyBuffer = Buffer.from(await upstream.arrayBuffer());
      return {
        status: upstream.status,
        headers: responseHeaders,
        body: bodyBuffer,
      };
    } catch (err) {
      clearTimeout(timeoutId);
      context.error('[arcadeProxy] Upstream error:', err);
      return jsonResponse(request, 502, {
        error: {
          code: 'proxy_error',
          message: 'Arcade API unreachable.',
        },
      });
    }
  },
});

