import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { StockLookupTool } from './stock-lookup.tool.js';

let fixture: string;
let fixturePath: string;

beforeAll(() => {
  fixturePath = path.join(os.tmpdir(), 'arunaki-stock-fixture.html');
  fixture = `file:///${fixturePath.replace(/\\/g, '/')}`;
  fs.writeFileSync(
    fixturePath,
    `<html><body>
      <script>window.__DATA__={"variants":[{"color":"Red","size":"S","stock":65,"price1":42000},{"color":"White","size":"L","stock":3,"price1":39000}]}</script>
      <h1>Kaos Premium</h1>
      <div>Stok: Red S tersisa 65 pcs</div>
      <div>Stok: White L habis</div>
    </body></html>`,
  );
});

afterAll(() => {
  fs.rmSync(fixturePath, { force: true });
});

describe('StockLookupTool browser read path (no hardcoded sites)', () => {
  it('reads stock from a generic product page without any per-site config', async () => {
    const tool = new StockLookupTool();
    const res = await tool.execute({ url: fixture, city: 'Jakarta', color: 'Red', size: 'S' });

    expect(res.status).toBe('success');
    const rows = (res.data as any).rows as string[];
    expect(rows.length).toBeGreaterThan(0);
expect(rows.some((r) => r.includes('65'))).toBe(true);
    expect(rows.every((r) => r.toLowerCase().includes('red'))).toBe(true);
  }, 60000);

  it('returns NO_STOCK_FOUND for a page without stock data', async () => {
    const emptyPath = path.join(os.tmpdir(), 'arunaki-empty-fixture.html');
    fs.writeFileSync(emptyPath, '<html><body><h1>Halo</h1></body></html>');
    const tool = new StockLookupTool();
    const res = await tool.execute({ url: `file:///${emptyPath.replace(/\\/g, '/')}`, city: 'Jakarta' });
    fs.rmSync(emptyPath, { force: true });

    expect(res.status).toBe('error');
    expect((res.error as any)?.code).toBe('NO_STOCK_FOUND');
  }, 60000);
});

