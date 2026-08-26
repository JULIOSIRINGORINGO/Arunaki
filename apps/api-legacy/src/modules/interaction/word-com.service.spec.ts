import { describe, it, expect } from 'vitest';
import { WordComService } from './word-com.service.js';

describe('WordComService', () => {
  const service = new WordComService();

  it('detects Windows platform availability', () => {
    expect(typeof service.isAvailable).toBe('boolean');
    if (process.platform === 'win32') {
      expect(service.isAvailable).toBe(true);
    }
  });

  it('builds valid PowerShell script for replace_text and append_paragraph', () => {
    const script = (service as any).buildPowerShellScript('C:\\docs\\kontrak.docx', [
      {
        action: 'replace_text',
        findText: '{{NAMA_KLIEN}}',
        replaceText: 'PT Berkah Mandiri',
        matchCase: true,
      },
      {
        action: 'append_paragraph',
        text: 'Pasal 1: Ketentuan Umum',
        style: 'Heading 1',
        bold: true,
      },
      {
        action: 'export_pdf',
        exportPdfPath: 'C:\\docs\\kontrak.pdf',
      },
    ]);

    expect(script).toContain('Word.Application');
    expect(script).toContain('{{NAMA_KLIEN}}');
    expect(script).toContain('PT Berkah Mandiri');
    expect(script).toContain('Heading 1');
    expect(script).toContain('ExportAsFixedFormat');
    expect(script).toContain('kontrak.pdf');
    expect(script).toContain('ReleaseComObject');
  });

  it('builds table insertion PowerShell script', () => {
    const script = (service as any).buildPowerShellScript('C:\\docs\\table.docx', [
      {
        action: 'insert_table',
        headers: ['No', 'Item', 'Harga'],
        tableRows: [
          ['1', 'Laptop', '15000000'],
          ['2', 'Mouse', '250000'],
        ],
      },
    ]);

    expect(script).toContain('Tables.Add');
    expect(script).toContain('Laptop');
    expect(script).toContain('Harga');
  });
});
