require('dotenv').config({ path: 'apps/api/.env' });
const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const p = new PrismaClient();

function getEncryptionKey() {
  const envKey = process.env.ARUNAKI_VAULT_KEY || process.env.APP_SECRET;
  if (!envKey) throw new Error('No Vault Key');
  return crypto.createHash('sha256').update(String(envKey)).digest();
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
      
      console.log('Decrypted key:', decrypted);
    }
  } catch (e) {
    console.log('Decryption FAILED:', e.message);
  }

  await p.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
