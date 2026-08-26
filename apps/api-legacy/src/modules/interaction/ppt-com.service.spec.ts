import { describe, it, expect } from 'vitest';
import { PptComService } from './ppt-com.service.js';

describe('PptComService', () => {
  const service = new PptComService();

  it('detects Windows platform availability', () => {
    expect(typeof service.isAvailable).toBe('boolean');
    if (process.platform === 'win32') {
      expect(service.isAvailable).toBe(true);
    }
  });

  it('builds valid PowerShell script for PowerPoint actions', () => {
    const script = (service as any).buildPowerShellScript('C:\\docs\\presentation.pptx', [
      {
        action: 'replace_text',
        findText: '2025',
        replaceText: '2026',
      },
      {
        action: 'add_slide',
        title: 'Roadmap 2026',
        content: ['Q1: Launching', 'Q2: Scale up'],
      },
      {
        action: 'export_pdf',
        exportPdfPath: 'C:\\docs\\presentation.pdf',
      },
    ]);

    expect(script).toContain('PowerPoint.Application');
    expect(script).toContain('2025');
    expect(script).toContain('2026');
    expect(script).toContain('Roadmap 2026');
    expect(script).toContain('Launching');
    expect(script).toContain('SaveAs');
    expect(script).toContain('presentation.pdf');
    expect(script).toContain('ReleaseComObject');
  });
});
