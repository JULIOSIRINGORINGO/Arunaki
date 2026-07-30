import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';

/**
 * Encrypted secret payload representation.
 */
export interface EncryptedPayload {
  cipherText: string;
  iv: string;
  tag: string;
  algorithm: string;
}

/**
 * SecretsVaultService — Enterprise AES-256-GCM Encrypted Local Key Store.
 *
 * Provides hardware/environment-backed secret encryption & decryption
 * for API keys, database credentials, and provider tokens.
 *
 * Security Characteristics:
 * - Cipher: AES-256-GCM (Galois/Counter Mode)
 * - Key Length: 256 bits (32 bytes)
 * - IV: 96 bits (12 bytes) cryptographically random per encryption
 * - Auth Tag: 128 bits (16 bytes) for authenticated encryption & integrity protection
 */
@Injectable()
export class SecretsVaultService {
  private readonly logger = new Logger(SecretsVaultService.name);
  private readonly masterKey: Buffer;
  private readonly vault = new Map<string, EncryptedPayload>();

  constructor() {
    const secretSource =
      process.env.ARUNAKI_VAULT_KEY ||
      process.env.APP_SECRET ||
      'arunaki-enterprise-secrets-vault-master-key-2026';

    // Derive a consistent 256-bit key via SHA-256
    this.masterKey = crypto.createHash('sha256').update(secretSource).digest();
  }

  /**
   * Encrypt a plain-text secret using AES-256-GCM.
   */
  encryptSecret(plainText: string): EncryptedPayload {
    if (!plainText) {
      throw new Error('Tidak dapat mengenskripsi string kosong');
    }

    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.masterKey, iv);

    let encrypted = cipher.update(plainText, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const tag = cipher.getAuthTag().toString('hex');

    return {
      cipherText: encrypted,
      iv: iv.toString('hex'),
      tag,
      algorithm: 'aes-256-gcm',
    };
  }

  /**
   * Decrypt an AES-256-GCM encrypted payload.
   */
  decryptSecret(payload: EncryptedPayload): string {
    if (!payload || !payload.cipherText || !payload.iv || !payload.tag) {
      throw new Error('Payload terenkripsi tidak valid');
    }

    try {
      const decipher = crypto.createDecipheriv(
        'aes-256-gcm',
        this.masterKey,
        Buffer.from(payload.iv, 'hex'),
      );
      decipher.setAuthTag(Buffer.from(payload.tag, 'hex'));

      let decrypted = decipher.update(payload.cipherText, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (err: any) {
      this.logger.error(`Gagal mengembalikan rahasia: integrity check failed (${err.message})`);
      throw new Error('Gagal mendekripsi rahasia: data telah diubah atau kunci master salah.');
    }
  }

  /**
   * Store an encrypted secret in the local vault by key name.
   */
  storeSecret(keyName: string, plainText: string): void {
    const encrypted = this.encryptSecret(plainText);
    this.vault.set(keyName, encrypted);
    this.logger.log(`Rahasia [${keyName}] telah disimpan secara terenkripsi di vault.`);
  }

  /**
   * Retrieve and decrypt a secret from the vault.
   */
  getSecret(keyName: string): string | null {
    const encrypted = this.vault.get(keyName);
    if (!encrypted) return null;
    return this.decryptSecret(encrypted);
  }

  /**
   * Check if a secret exists in the vault.
   */
  hasSecret(keyName: string): boolean {
    return this.vault.has(keyName);
  }

  /**
   * Remove a secret from the vault.
   */
  deleteSecret(keyName: string): boolean {
    return this.vault.delete(keyName);
  }
}
