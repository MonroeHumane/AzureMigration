/**
 * Client-Side Authenticated Financial Vault Decryptor
 * Humane Society of Monroe County
 *
 * Uses the native Web Crypto API (window.crypto.subtle) to decrypt
 * the AES-256-GCM encrypted board financials vault in memory.
 * No sensitive data is ever stored unencrypted on disk or CDN.
 */

export interface VaultKeySlot {
  salt: string;
  iv: string;
  wrappedKey: string;
}

export interface EncryptedVaultBundle {
  version: number;
  algorithm: string;
  kdf: string;
  iterations: number;
  created_at: string;
  keys: Record<string, VaultKeySlot>;
  payload: {
    iv: string;
    ciphertext: string;
  };
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export async function computePasskeySlotId(passkey: string): Promise<string> {
  const clean = (passkey || '').trim();
  const enc = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest('SHA-256', enc.encode(clean));
  const hashHex = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return hashHex.substring(0, 16);
}

/**
 * Decrypts an encrypted vault bundle using the authorized shelter passkey.
 * Returns the parsed JSON payload.
 */
export async function decryptFinancialVault(
  vault: EncryptedVaultBundle,
  passkey: string
): Promise<any> {
  if (!vault || !vault.keys || !vault.payload) {
    throw new Error('Invalid vault bundle structure');
  }

  const slotId = await computePasskeySlotId(passkey);
  const keySlot = vault.keys[slotId];
  if (!keySlot) {
    throw new Error('Provided passkey is not authorized for this financial vault.');
  }

  const subtle = crypto.subtle;
  const enc = new TextEncoder();

  // 1. Import passkey as raw key material for PBKDF2
  const passkeyKey = await subtle.importKey(
    'raw',
    enc.encode(passkey.trim()),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  // 2. Derive AES-GCM 256-bit unwrap key
  const saltBytes = base64ToUint8Array(keySlot.salt);
  const unwrapKey = await subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBytes as unknown as BufferSource,
      iterations: vault.iterations || 100000,
      hash: 'SHA-256',
    },
    passkeyKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );

  // 3. Unwrap the Master Vault Key (MVK)
  const wrapIvBytes = base64ToUint8Array(keySlot.iv);
  const wrappedKeyBytes = base64ToUint8Array(keySlot.wrappedKey);

  const mvkBuffer = await subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: wrapIvBytes as unknown as BufferSource,
    },
    unwrapKey,
    wrappedKeyBytes as unknown as BufferSource
  );

  // 4. Import the Master Vault Key for payload decryption
  const mvkKey = await subtle.importKey(
    'raw',
    mvkBuffer,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  );

  // 5. Decrypt the main payload
  const payloadIvBytes = base64ToUint8Array(vault.payload.iv);
  const ciphertextBytes = base64ToUint8Array(vault.payload.ciphertext);

  const decryptedBuffer = await subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: payloadIvBytes as unknown as BufferSource,
    },
    mvkKey,
    ciphertextBytes as unknown as BufferSource
  );

  const decStr = new TextDecoder('utf-8').decode(decryptedBuffer);
  return JSON.parse(decStr);
}
