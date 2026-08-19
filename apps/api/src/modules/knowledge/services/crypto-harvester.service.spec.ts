import { describe, it, expect } from 'vitest';
import { CryptoHarvesterService } from './crypto-harvester.service.js';

const SECRET = { secret: 'some-client-secret-abcdef', iterations: 1000, keySize: 12 };

describe('CryptoHarvesterService.learnFromCaptures', () => {
  it('registers a learned stock API from encrypted request + stock payload + secret', () => {
    const svc = new CryptoHarvesterService();
    const ok = svc.learnFromCaptures(
      'shop.example.com',
      'https://shop.example.com/p/kaos-premium-7200-99',
      {
        encrypted: [{ url: '/api/userapi/category/stock/99/Medan?isWholesale=true', body: '{"encrypt":"..."}' }],
        decrypted: [
          '[{"name":"Cabang A","products":[{"color":"Red","size":"S","stock":5,"price1":42000}]}]',
        ],
      },
      SECRET,
    );

    expect(ok).toBe(true);
    const site = svc.getLearnedSite('shop.example.com');
    expect(site?.apiUrlTemplate).toBe(
      'https://shop.example.com/api/userapi/category/stock/{productId}/{city}?isWholesale=true',
    );
    expect(site?.secret).toBe(SECRET.secret);
    expect(site?.keySizeBytes).toBe(48);
    expect(site?.iterations).toBe(1000);
  });

  it('does not learn without a secret', () => {
    const svc = new CryptoHarvesterService();
    const ok = svc.learnFromCaptures('shop.example.com', 'https://shop.example.com/p/x-1', {
      encrypted: [{ url: '/api/stock/1/Jakarta', body: '{"encrypt":"..."}' }],
      decrypted: ['[{"products":[{"color":"Red","size":"S","stock":5}]}]'],
    });
    expect(ok).toBe(false);
    expect(svc.getLearnedSite('shop.example.com')).toBeUndefined();
  });

  it('does not learn when payload is not stock-shaped', () => {
    const svc = new CryptoHarvesterService();
    const ok = svc.learnFromCaptures('shop.example.com', 'https://shop.example.com/p/x-1', {
      encrypted: [{ url: '/api/stock/1/Jakarta', body: '{"encrypt":"..."}' }],
      decrypted: ['{"page":"home","items":[]}'],
    }, SECRET);
    expect(ok).toBe(false);
  });

  it('does not learn when no /stock/{id}/{city} request was captured', () => {
    const svc = new CryptoHarvesterService();
    const ok = svc.learnFromCaptures('shop.example.com', 'https://shop.example.com/p/x-1', {
      encrypted: [{ url: '/api/cart', body: '{"encrypt":"..."}' }],
      decrypted: ['[{"products":[{"color":"Red","size":"S","stock":5}]}]'],
    }, SECRET);
    expect(ok).toBe(false);
  });

  it('learns only once per host', () => {
    const svc = new CryptoHarvesterService();
    const captures = {
      encrypted: [{ url: '/api/stock/1/Jakarta', body: '{"encrypt":"..."}' }],
      decrypted: ['[{"products":[{"color":"Red","size":"S","stock":5}]}]'],
    };
    expect(svc.learnFromCaptures('shop.example.com', 'u', captures, SECRET)).toBe(true);
    expect(svc.learnFromCaptures('shop.example.com', 'u', captures, SECRET)).toBe(false);
  });
});