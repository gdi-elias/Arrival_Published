const crypto = require('crypto');

// AES-256-CBC helper. Output format: ENC:<ivHex>:<ciphertextHex>
const ALGORITHM = 'aes-256-cbc';

function deriveKey(secret) {
  // Ensure a 32-byte key (AES-256) by hashing the provided secret
  return crypto.createHash('sha256').update(secret, 'utf8').digest();
}

function encrypt(plain, secret) {
  if (!secret) throw new Error('SECRET_KEY is required for encryption');
  const key = deriveKey(secret);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  return `ENC:${iv.toString('hex')}:${encrypted.toString('hex')}`;
}

function decrypt(token, secret) {
  if (!secret) throw new Error('SECRET_KEY is required for decryption');
  if (typeof token !== 'string') return token;
  if (!token.startsWith('ENC:')) return token; // not encrypted
  const parts = token.split(':');
  if (parts.length !== 3) throw new Error('Invalid encrypted token format');
  const iv = Buffer.from(parts[1], 'hex');
  const encrypted = Buffer.from(parts[2], 'hex');
  const key = deriveKey(secret);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
}

module.exports = { encrypt, decrypt };
