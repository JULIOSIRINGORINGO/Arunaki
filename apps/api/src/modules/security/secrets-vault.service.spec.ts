import { describe, it, expect, beforeAll } from 'vitest';
import { SecretsVaultService } from './secrets-vault.service.js';

describe('SecretsVaultService — AES-256-GCM Encryption', () => {
  let vaultService: SecretsVaultService;

  beforeAll(() => {
    process.env.ARUNAKI_VAULT_KEY =
      'test-vault-key-0123456789abcdef0123456789abcdef';
  });

  beforeEach(() => {
    vaultService = new SecretsVaultService();
  });

  it('should encrypt and decrypt a secret correctly', () => {
    const plainApiKey = 'sk-or-v1-abc123xyz456789enterprisekey';

    const encrypted = vaultService.encryptSecret(plainApiKey);

    expect(encrypted.cipherText).toBeDefined();
    expect(encrypted.cipherText).not.toBe(plainApiKey);
    expect(encrypted.iv).toHaveLength(24); // 12 bytes in hex
    expect(encrypted.tag).toHaveLength(32); // 16 bytes in hex
    expect(encrypted.algorithm).toBe('aes-256-gcm');

    const decrypted = vaultService.decryptSecret(encrypted);
    expect(decrypted).toBe(plainApiKey);
  });

  it('should store and retrieve secrets by key name', () => {
    vaultService.storeSecret('OPENROUTER_API_KEY', 'sk-or-secret-key-999');

    expect(vaultService.hasSecret('OPENROUTER_API_KEY')).toBe(true);

    const retrieved = vaultService.getSecret('OPENROUTER_API_KEY');
    expect(retrieved).toBe('sk-or-secret-key-999');
  });

  it('should return null for non-existent secret keys', () => {
    const value = vaultService.getSecret('NON_EXISTENT_KEY');
    expect(value).toBeNull();
  });

  it('should throw an error if tampered auth tag is passed to decrypt', () => {
    const encrypted = vaultService.encryptSecret('my-secret-token');

    const tamperedPayload = {
      ...encrypted,
      tag: '00000000000000000000000000000000', // invalid auth tag
    };

    expect(() => vaultService.decryptSecret(tamperedPayload)).toThrow(
      'Failed to decrypt secret',
    );
  });

  it('should delete secret cleanly', () => {
    vaultService.storeSecret('TEMP_KEY', 'value-123');
    expect(vaultService.hasSecret('TEMP_KEY')).toBe(true);

    const deleted = vaultService.deleteSecret('TEMP_KEY');
    expect(deleted).toBe(true);
    expect(vaultService.hasSecret('TEMP_KEY')).toBe(false);
  });
});
