import { describe, it, expect, beforeEach } from 'vitest';
import { DocumentReconciliationService } from './doc-reconciliation.service.js';

describe('DocumentReconciliationService', () => {
  let service: DocumentReconciliationService;

  beforeEach(() => {
    service = new DocumentReconciliationService();
  });

  it('should reconcile matching document datasets perfectly', () => {
    const sourceRows = [
      { id: 'INV-001', amount: 1000, customer: 'PT Abadi' },
      { id: 'INV-002', amount: 2500, customer: 'CV Jaya' },
    ];
    const targetRows = [
      { id: 'INV-001', amount: 1000, customer: 'PT Abadi' },
      { id: 'INV-002', amount: 2500, customer: 'CV Jaya' },
    ];

    const report = service.reconcileDocuments(
      'Invoices.xlsx',
      sourceRows,
      'Receipts.pdf',
      targetRows,
      'id',
    );

    expect(report.summary.totalItemsChecked).toBe(2);
    expect(report.summary.matchCount).toBe(2);
    expect(report.summary.mismatchCount).toBe(0);
    expect(report.summary.matchPercentage).toBe(100);
    expect(report.formattedTableMarkdown).toContain('Accuracy:** 100%');
    expect(report.formattedTableMarkdown).toContain('✅ MATCH');
  });

  it('should detect value mismatches and missing entries correctly', () => {
    const sourceRows = [
      { id: 'INV-001', amount: 1000 },
      { id: 'INV-002', amount: 2500 },
      { id: 'INV-003', amount: 500 },
    ];
    const targetRows = [
      { id: 'INV-001', amount: 1000 },
      { id: 'INV-002', amount: 3000 }, // Mismatch
      { id: 'INV-004', amount: 750 },  // Missing in source
    ];

    const report = service.reconcileDocuments(
      'Invoices.xlsx',
      sourceRows,
      'BankStatement.csv',
      targetRows,
      'id',
    );

    expect(report.summary.totalItemsChecked).toBe(4);
    expect(report.summary.matchCount).toBe(1);
    expect(report.summary.mismatchCount).toBe(1);
    expect(report.summary.missingCount).toBe(2);
    expect(report.summary.matchPercentage).toBe(25);
    expect(report.formattedTableMarkdown).toContain('⚠️ MISMATCH');
    expect(report.formattedTableMarkdown).toContain('❌ MISSING');
  });

  it('should cross-reference occurrences across text documents', () => {
    const docs = [
      { name: 'kontrak.docx', content: 'Pembayaran invoice INV-1002 harus dilakukan dalam 30 hari.' },
      { name: 'surat_jalan.pdf', content: 'Pengiriman barang sesuai PO-555 dan INV-1002 telah diterima.' },
      { name: 'memo.txt', content: 'Memo internal mengenai perpanjangan vendor PT Maju.' },
    ];

    const matches = service.crossReference('INV-1002', docs);

    expect(matches).toHaveLength(2);
    expect(matches[0].documentName).toBe('kontrak.docx');
    expect(matches[1].documentName).toBe('surat_jalan.pdf');
    expect(matches[0].occurrenceCount).toBe(1);
  });
});
