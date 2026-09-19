/**
 * Humane Society of Monroe County (HSMC)
 * Executive Financial Vault Compiler & Encryptor
 *
 * Compiles certified QBO financial records, multi-year statements,
 * and donor metrics into a tamper-proof AES-256-GCM encrypted vault
 * for zero-backend, 100% confidential hosting on GitHub Pages.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const API_DATA = path.join(ROOT, 'api', 'data');
const VAULT_DIR = path.join(ROOT, 'frontend', 'public', 'internal', 'vault');
const VAULT_FILE = path.join(VAULT_DIR, 'financials.enc.json');

// Authorized shelter passkeys
const PASSKEYS = [
  'Shelt3r2025!',
  'MonroeStaff2026!',
  'monroestaff2026!',
  'MonroeShelter2026!',
  'monroeshelter2026!',
  'MonroeCare2026!',
  'monroecare2026!',
];

function loadJson(filename) {
  const p = path.join(API_DATA, filename);
  if (!fs.existsSync(p)) {
    const fallback = path.join(ROOT, 'frontend', 'src', 'data', filename);
    if (fs.existsSync(fallback)) {
      return JSON.parse(fs.readFileSync(fallback, 'utf-8'));
    }
    console.warn(`[VaultCompiler] Optional file not found: ${filename}`);
    return null;
  }
  return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

function computePasskeySlotId(passkey) {
  return crypto.createHash('sha256').update(passkey.trim()).digest('hex').substring(0, 16);
}

function main() {
  console.log('=== HSMC Board Financial Vault Compiler ===\n');

  const report2026 = loadJson('published_2026_ytd.json');
  if (!report2026) {
    throw new Error('Fatal: published_2026_ytd.json is missing!');
  }

  const statement2026 = loadJson('statement_2026_08.json') || {};
  const drilldown2026 = loadJson('monthly_drilldown_2026.json');
  const checkingHistory = loadJson('checking_balance_2024_2026.json');
  const bankInOut2026 = loadJson('bank_in_out_2026.json');
  const bankInOut2025 = loadJson('bank_in_out_2025.json');
  const bankInOut2024 = loadJson('bank_in_out_2024.json');
  const report2025 = loadJson('published_2025_ytd.json');
  const drilldown2025 = loadJson('monthly_drilldown_2025.json');
  const report2024 = loadJson('published_2024_ytd.json');
  const drilldown2024 = loadJson('monthly_drilldown_2024.json');
  const donorDb = loadJson('donor_database.json');

  // Accounting Integrity Verification
  console.log('[1/4] Running mathematical accounting verification...');
  const assets = report2026.statement_of_position?.assets || {};
  const glCash = assets.operating_checking_first_merchants || 0;
  const bankCash = assets.operating_checking_bank_register || 0;
  const reconFloat = Math.round((bankCash - glCash) * 100) / 100;

  if (Math.abs(reconFloat - 1057.14) > 0.05) {
    throw new Error(`Bank reconciliation float mismatch: expected 1057.14, got ${reconFloat}`);
  }
  console.log(`  ✓ Bank reconciliation float verified at $${reconFloat.toFixed(2)}`);

  // Merge multi-year statements and drilldowns
  console.log('[2/4] Merging multi-year statement packs...');
  const yearData = [
    { year: 2026, statements: report2026.monthly_statements || [], drilldown: drilldown2026 },
    { year: 2025, statements: report2025 ? report2025.monthly_statements || [] : [], drilldown: drilldown2025 },
    { year: 2024, statements: report2024 ? report2024.monthly_statements || [] : [], drilldown: drilldown2024 },
  ].filter((y) => y.statements.length || y.drilldown);

  const idParts = (id) => {
    const m = /^month_(\d+)_(\d+)$/.exec(id || '');
    return m ? [Number(m[1]), Number(m[2])] : [0, 0];
  };

  const monthly_statements = yearData
    .flatMap((y) => y.statements)
    .sort((a, b) => {
      const [ay, am] = idParts(a.id);
      const [by, bm] = idParts(b.id);
      return ay - by || am - bm;
    });

  const drilldownMonths = {};
  for (const y of yearData) {
    if (y.drilldown && y.drilldown.months) {
      Object.assign(drilldownMonths, y.drilldown.months);
    }
  }

  // Merge bank statement packs
  const bankPacks = { 2024: bankInOut2024, 2025: bankInOut2025, 2026: bankInOut2026 };
  const bankMonths = {};
  const ytdByYear = {};
  const years = [];
  [2024, 2025, 2026].forEach((year) => {
    const pack = bankPacks[year];
    if (!pack || !pack.months) return;
    years.push(String(year));
    Object.assign(bankMonths, pack.months);
    if (pack.meta && pack.meta.ytd) ytdByYear[String(year)] = pack.meta.ytd;
  });

  const baseBank = bankInOut2026 && typeof bankInOut2026 === 'object' ? bankInOut2026 : { meta: {}, months: {} };
  const mergedBankStatements = {
    ...baseBank,
    months: bankMonths,
    meta: Object.assign({}, baseBank.meta || {}, {
      years,
      default_year: '2026',
      ytd_by_year: ytdByYear,
    }),
  };

  // Build unified payload matching FinancialPayloadSchema
  const payload = {
    ...report2026,
    bank_statement: statement2026,
    bank_statements: mergedBankStatements,
    monthly_statements,
    monthly_drilldown: { months: drilldownMonths },
    checking_balance_history: checkingHistory,
    donors: donorDb?.donors || [],
    donor_meta: donorDb?.meta || null,
  };

  const serialized = JSON.stringify(payload);
  const rawBytes = Buffer.from(serialized, 'utf-8');
  console.log(`  ✓ Unified payload assembled: ${(rawBytes.length / 1024).toFixed(1)} KB`);

  // Envelope Encryption
  console.log('[3/4] Generating AES-256-GCM Master Vault Key & Encrypting...');
  const mvk = crypto.randomBytes(32); // 256-bit Master Key
  const payloadIv = crypto.randomBytes(12); // 96-bit IV
  const cipher = crypto.createCipheriv('aes-256-gcm', mvk, payloadIv);
  let ciphertext = cipher.update(rawBytes);
  ciphertext = Buffer.concat([ciphertext, cipher.final(), cipher.getAuthTag()]);

  // Wrap Master Key for each authorized passkey
  console.log('[4/4] Wrapping Master Vault Key for authorized shelter passkeys...');
  const wrappedKeys = {};

  for (const passkey of PASSKEYS) {
    const slotId = computePasskeySlotId(passkey);
    const salt = crypto.randomBytes(16);
    const derivedKey = crypto.pbkdf2Sync(passkey, salt, 100000, 32, 'sha256');
    const wrapIv = crypto.randomBytes(12);
    const wrapCipher = crypto.createCipheriv('aes-256-gcm', derivedKey, wrapIv);
    let wrapped = wrapCipher.update(mvk);
    wrapped = Buffer.concat([wrapped, wrapCipher.final(), wrapCipher.getAuthTag()]);

    wrappedKeys[slotId] = {
      salt: salt.toString('base64'),
      iv: wrapIv.toString('base64'),
      wrappedKey: wrapped.toString('base64'),
    };
  }

  const vaultBundle = {
    version: 1,
    algorithm: 'AES-256-GCM',
    kdf: 'PBKDF2-HMAC-SHA256',
    iterations: 100000,
    created_at: new Date().toISOString(),
    keys: wrappedKeys,
    payload: {
      iv: payloadIv.toString('base64'),
      ciphertext: ciphertext.toString('base64'),
    },
  };

  fs.mkdirSync(VAULT_DIR, { recursive: true });
  fs.writeFileSync(VAULT_FILE, JSON.stringify(vaultBundle, null, 2), 'utf-8');

  console.log(`\n==============================================`);
  console.log(`✓ Vault successfully published to:`);
  console.log(`  ${VAULT_FILE}`);
  console.log(`  File size: ${(fs.statSync(VAULT_FILE).size / 1024).toFixed(1)} KB`);
  console.log(`  Supported passkey slots: ${Object.keys(wrappedKeys).length}`);
  console.log(`==============================================\n`);
}

if (require.main === module) {
  main();
}

module.exports = { main, computePasskeySlotId };
