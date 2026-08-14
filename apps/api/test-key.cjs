require('dotenv').config({ path: '.env' });
const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const p = new PrismaClient();

async function main() {
  const row = await p.provider.findFirst({ where: { name: 'Kenari' }, select: { apiKey: true } });
  if (!row) return;
  const payload = JSON.parse(row.apiKey);
  const key = crypto.createHash('sha256').update(String(process.env.ARUNAKI_VAULT_KEY)).digest();
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(payload.iv, 'hex'));
  decipher.setAuthTag(Buffer.from(payload.tag, 'hex'));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(payload.cipherText, 'hex')), decipher.final()]).toString('utf-8');
  console.log('Decrypted FULL:', decrypted);
  await p.$disconnect();
}
main();
