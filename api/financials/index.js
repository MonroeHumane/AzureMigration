const reportData = require('./published_2026_ytd.json');
const statementData = require('./statement_2026_08.json');

const DIRECTUS_URL = process.env.DIRECTUS_URL || 'https://mchs-directus.livelyfield-d0a70609.eastus.azurecontainerapps.io';

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

  const authHeader = (req.headers && (req.headers['authorization'] || req.headers['Authorization'])) || '';
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
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

  const token = authHeader.substring(7).trim();
  if (!token) {
    context.res = {
      status: 401,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, private',
      },
      body: { error: 'Unauthorized: Empty token provided.' },
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

    // Token successfully verified! Serve certified confidential financial report.
    context.res = {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'private, no-cache, no-store, must-revalidate',
      },
      body: {
        ...reportData,
        bank_statement: statementData,
      },
    };
  } catch (err) {
    context.log.error('Error verifying token with Directus:', err);
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
