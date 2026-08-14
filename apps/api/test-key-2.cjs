require('dotenv').config({ path: '.env' });
const crypto = require('crypto');
const payload = {"cipherText":"b5296f7983007414b9b056","iv":"135c5a94f2ff84e0cbd77d0c","tag":"7b2728b27bb327feba6031ac31d9a635","algorithm":"aes-256-gcm"};
const key = crypto.createHash('sha256').update(String(process.env.ARUNAKI_VAULT_KEY)).digest();
const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(payload.iv, 'hex'));
decipher.setAuthTag(Buffer.from(payload.tag, 'hex'));
const decrypted = Buffer.concat([decipher.update(Buffer.from(payload.cipherText, 'hex')), decipher.final()]).toString('utf-8');
console.log('EXACT:', decrypted);
