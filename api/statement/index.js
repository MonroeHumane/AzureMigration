const fs = require('fs');
const path = require('path');

const DIRECTUS_URL = process.env.DIRECTUS_URL || 'https://mchs-directus.livelyfield-d0a70609.eastus.azurecontainerapps.io';

const STATEMENT_FILES = {
  bank: 'First_Merchant_Chkng_XXXXXX8478_08312026.pdf',
  qbo: 'QBO_Reconciliation_Report_08312026.pdf',
};

module.exports = async function (context, req) {
  if (req.method === 'OPTIONS') {
    context.res = {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      },
    };
    return;
  }

  // Support token from Authorization header OR query param for inline PDF viewers/links
  let token = '';
  const authHeader = (req.headers && (req.headers['authorization'] || req.headers['Authorization'])) || '';
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else if (req.query && req.query.token) {
    token = String(req.query.token).trim();
  }

  if (!token) {
    context.res = {
      status: 401,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, private',
      },
      body: { error: 'Unauthorized: Valid Directus staff Bearer token required.' },
    };
    return;
  }

  try {
    // Authenticate token directly against Directus /users/me
    const verifyRes = await fetch(`${DIRECTUS_URL}/users/me`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!verifyRes.ok) {
      context.res = {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, private',
        },
        body: { error: 'Unauthorized: Directus token expired or invalid.' },
      };
      return;
    }

    const userData = await verifyRes.json();
    if (!userData || !userData.data || !userData.data.id) {
      context.res = {
        status: 403,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, private',
        },
        body: { error: 'Forbidden: Inactive or unrecognized staff account.' },
      };
      return;
    }

    // Determine requested document
    const docKey = (req.query && req.query.doc) || 'bank';
    const fileName = STATEMENT_FILES[docKey];

    if (!fileName) {
      context.res = {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, private',
        },
        body: { error: 'Invalid document requested. Valid doc values: bank, qbo' },
      };
      return;
    }

    const filePath = path.join(__dirname, 'files', fileName);
    if (!fs.existsSync(filePath)) {
      context.res = {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, private',
        },
        body: { error: 'Statement file not found on server.' },
      };
      return;
    }

    const fileBuffer = fs.readFileSync(filePath);
    context.res = {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${fileName}"`,
        'Cache-Control': 'private, no-cache, no-store, must-revalidate',
      },
      body: fileBuffer,
      isRaw: true,
    };
  } catch (err) {
    context.log.error('Error in statement endpoint:', err);
    context.res = {
      status: 502,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, private',
      },
      body: { error: 'Authentication service temporarily unavailable.' },
    };
  }
};
