/**
 * Humane Society of Monroe County (HSMC)
 * Cryptographic Financial Vault Integrity Verification Test
 *
 * Verifies that:
 * 1. The compiled vault (financials.enc.json) exists and is valid AES-256-GCM format.
 * 2. Every authorized passkey slot successfully unwraps the MVK and decrypts the payload.
 * 3. The decrypted financial figures match the certified bank reconciliation:
 *    - Physical Bank Statement (First Merchants ••••2187): $24,526.34
 *    - Reconciled Uncleared Checks Float: $1,057.14
 *    - Net Operating Checking Cash: $23,469.20
 *    - Fidelity Liquid Reserve: $205,144.00
 * 4. Multi-year drilldowns and donor registries are intact.
 *
 * Usage: node scripts/verify_financial_vault.cjs
 */

const fs = require('fs');
const path = require('path');
const { webcrypto } = require('crypto');
globalThis.crypto = webcrypto;

if (typeof atob === 'undefined') {
  globalThis.atob = (str) => Buffer.from(str, 'base64').toString('binary');
}

const ROOT = path.resolve(__dirname, '..');
const VAULT_FILE = path.join(ROOT, 'frontend', 'public', 'internal', 'vault', 'financials.enc.json');

const PASSKEYS = [
  'Shelt3r2025!',
  'MonroeStaff2026!',
  'monroestaff2026!',
  'MonroeShelter2026!',
  'monroeshelter2026!',
  'MonroeCare2026!',
  'monroecare2026!',
];

const base64ToUint8Array = (base64) => {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
};

async function testPasskeyDecryption(vault, passkey) {
  const enc = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest('SHA-256', enc.encode(passkey.trim()));
  const hashHex = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  const slotId = hashHex.substring(0, 16);

  const keySlot = vault.keys[slotId];
  if (!keySlot) {
    throw new Error(`Slot ID "${slotId}" not found for passkey "${passkey}"`);
  }

  const passkeyKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(passkey.trim()),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  const unwrapKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: base64ToUint8Array(keySlot.salt),
      iterations: vault.iterations,
      hash: 'SHA-256',
    },
    passkeyKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );

  const mvkBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64ToUint8Array(keySlot.iv) },
    unwrapKey,
    base64ToUint8Array(keySlot.wrappedKey)
  );

  const mvkKey = await crypto.subtle.importKey(
    'raw',
    mvkBuffer,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  );

  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64ToUint8Array(vault.payload.iv) },
    mvkKey,
    base64ToUint8Array(vault.payload.ciphertext)
  );

  const decStr = new TextDecoder('utf-8').decode(decryptedBuffer);
  return JSON.parse(decStr);
}

async function main() {
  console.log('=== HSMC Cryptographic Financial Vault Verification ===\n');

  if (!fs.existsSync(VAULT_FILE)) {
    console.error(`FAIL: Vault file not found at ${VAULT_FILE}`);
    process.exit(1);
  }

  const stats = fs.statSync(VAULT_FILE);
  console.log(`[1/4] Vault file located (${(stats.size / 1024).toFixed(1)} KB)`);

  const vault = JSON.parse(fs.readFileSync(VAULT_FILE, 'utf-8'));
  if (!vault.algorithm || vault.algorithm !== 'AES-256-GCM') {
    console.error(`FAIL: Unexpected vault algorithm: ${vault.algorithm}`);
    process.exit(1);
  }

  const slotCount = Object.keys(vault.keys || {}).length;
  console.log(`[2/4] Validated vault structure: ${slotCount} passkey slots, ${vault.iterations.toLocaleString()} PBKDF2 iterations`);

  // Verify all passkeys
  let payload = null;
  console.log('[3/4] Testing cryptographic unwrapping & decryption for all authorized passkeys:');
  for (const passkey of PASSKEYS) {
    try {
      payload = await testPasskeyDecryption(vault, passkey);
      console.log(`  ✓ Passkey slot verified: "${passkey.substring(0, 6)}..."`);
    } catch (err) {
      console.error(`  ✗ FAIL for passkey "${passkey}":`, err.message);
      process.exit(1);
    }
  }

  // Verify financial integrity of decrypted payload
  console.log('\n[4/4] Verifying certified financial balances against physical bank statement:');
  const assets = payload.statement_of_position?.assets;
  const bankMeta = payload.bank_statement?.metadata;

  if (!assets) {
    console.error('FAIL: Missing statement_of_position.assets in decrypted payload');
    process.exit(1);
  }

  const bankEnd = bankMeta?.statement_ending_balance || assets?.operating_checking_bank_register;
  const checkingCash = assets?.operating_checking_first_merchants;
  const float = Math.round(Math.abs(bankEnd - checkingCash) * 100) / 100;
  const fidelityReserve = assets?.fidelity_board_designated_reserve || payload.headline_kpis?.fidelity_reserve;

  console.log(`  • Physical Bank Statement (First Merchants ••••2187): $${Number(bankEnd)?.toFixed(2)}`);
  console.log(`  • Reconciled Uncleared Checks Float:                  $${Number(float)?.toFixed(2)}`);
  console.log(`  • Net Operating Checking Cash:                       $${Number(checkingCash)?.toFixed(2)}`);
  console.log(`  • Fidelity Liquid Reserve (Account 1150040027):       $${Number(fidelityReserve)?.toFixed(2)}`);

  if (Math.abs((Number(bankEnd) || 0) - 24526.34) > 0.01) {
    console.error(`FAIL: Bank statement ending balance mismatch! Expected 24526.34, got ${bankEnd}`);
    process.exit(1);
  }

  if (Math.abs((Number(float) || 0) - 1057.14) > 0.02) {
    console.error(`FAIL: Reconciled uncleared float mismatch! Expected 1057.14, got ${float}`);
    process.exit(1);
  }

  if (Math.abs((Number(checkingCash) || 0) - 23469.20) > 0.01) {
    console.error(`FAIL: Net operating checking cash mismatch! Expected 23469.20, got ${checkingCash}`);
    process.exit(1);
  }

  if (Math.abs((Number(fidelityReserve) || 0) - 205144.00) > 0.01) {
    console.error(`FAIL: Fidelity reserve mismatch! Expected 205144.00, got ${fidelityReserve}`);
    process.exit(1);
  }

  // Check multi-year bank statements
  const years = payload.bank_statements?.meta?.years || [];
  console.log(`  • Multi-year drilldowns:                              ${years.join(', ')}`);
  if (!years.includes('2026') || !years.includes('2025') || !years.includes('2024')) {
    console.error('FAIL: Missing required years in bank_statements.meta.years');
    process.exit(1);
  }

  // Check donor roster
  const donorCount = (payload.donors || []).length;
  console.log(`  • Donor database roster:                             ${donorCount} donors`);
  if (donorCount < 400) {
    console.error(`FAIL: Expected at least 400 donors in roster, got ${donorCount}`);
    process.exit(1);
  }

  console.log('\n======================================================');
  console.log('✓ ALL CRYPTOGRAPHIC & ACCOUNTING CHECKS PASSED (100%)');
  console.log('======================================================\n');
  process.exit(0);
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
