#!/usr/bin/env node
// Usage: set SECRET_KEY=yourkey && node scripts/enc.js "plaintextPassword"
const { encrypt } = require('../utils/crypto');

const secret = process.env.SECRET_KEY;
const arg = process.argv[2];

if (!arg) {
  console.error('Usage: set SECRET_KEY=yourkey && node scripts/enc.js "plaintextPassword"');
  process.exit(2);
}
if (!secret) {
  console.error('SECRET_KEY environment variable is required to encrypt.');
  process.exit(2);
}

try {
  const cipher = encrypt(arg, secret);
  console.log(cipher);
} catch (err) {
  console.error('Encryption error:', err.message);
  process.exit(1);
}
