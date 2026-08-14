// Test: check if Kenari API key can be decrypted correctly
const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const p = new PrismaClient();

function getEncryptionKey() {
  const envKey = process.env.ENCRYPTION_KEY || process.env.SECRET_KEY || '';
  if (envKey) return crypto.createHash('sha256').update(envKey).digest();
  // Default key derivation from SecretsVaultService
  return crypto.createHash('sha256').update('arunaki-default-key').digest();
}

async function main() {
  const row = await p.provider.findFirst({
    where: { name: 'Kenari' },
    select: { apiKey: true }
  });
  
  if (!row || !row.apiKey) {
    console.log('No Kenari provider found');
    await p.$disconnect();
    return;
  }

  console.log('Raw apiKey (first 80 chars):', row.apiKey.substring(0, 80));
  
  try {
    const payload = JSON.parse(row.apiKey);
    console.log('Parsed payload keys:', Object.keys(payload));
    
    if (payload.cipherText && payload.iv) {
      const key = getEncryptionKey();
      const decipher = crypto.createDecipheriv(
        'aes-256-gcm',
        key,
        Buffer.from(payload.iv, 'hex')
      );
      if (payload.tag) {
        decipher.setAuthTag(Buffer.from(payload.tag, 'hex'));
      }
      const decrypted = Buffer.concat([
        decipher.update(Buffer.from(payload.cipherText, 'hex')),
        decipher.final()
      ]).toString('utf-8');
      
      console.log('Decrypted key (first 20 chars):', decrypted.substring(0, 20) + '...');
      console.log('Decrypted key length:', decrypted.length);
      console.log('Looks like a valid key:', !decrypted.startsWith('{'));
    }
  } catch (e) {
    console.log('Decryption FAILED:', e.message);
  }

  await p.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
