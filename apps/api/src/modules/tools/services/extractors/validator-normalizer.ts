import { ParsedDocument, ExtractedItem } from './rule-parsers.js';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface NormalizedDocument {
  format: string;
  title: string;
  items: Array<{
    name: string;
    qty: number | null;
    unitPrice: number | null;
    total: number | null;
  }>;
  summary: {
    itemCount: number;
    subtotal: number | null;
    tax: number | null;
    total: number | null;
  };
  metadata: Record<string, string>;
  validation: ValidationResult;
}

export function validateDocument(doc: ParsedDocument): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!doc.title || doc.title.trim().length === 0) {
    warnings.push('Judul dokumen kosong');
  }

  if (doc.items.length === 0) {
    warnings.push('Tidak ada item yang berhasil diekstrak');
  }

  for (let i = 0; i < doc.items.length; i++) {
    const item = doc.items[i];
    if (!item.name || item.name.trim().length === 0) {
      errors.push(`Item ${i + 1}: nama kosong`);
    }
    if (item.qty !== null && item.qty <= 0) {
      errors.push(`Item ${i + 1} (${item.name}): qty harus > 0`);
    }
    if (item.unitPrice !== null && item.unitPrice < 0) {
      errors.push(`Item ${i + 1} (${item.name}): harga tidak boleh negatif`);
    }
  }

  if (doc.totals.total !== null && doc.totals.subtotal !== null) {
    if (doc.totals.total < doc.totals.subtotal) {
      warnings.push('Total kurang dari subtotal — mungkin ada diskon yang tidak terdeteksi');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

export function normalizeDocument(doc: ParsedDocument): NormalizedDocument {
  const validation = validateDocument(doc);

  const normalizedItems = doc.items
    .filter((item) => item.name && item.name.trim().length > 0)
    .map((item) => ({
      name: item.name.trim(),
      qty: item.qty,
      unitPrice: item.unitPrice,
      total: item.total || (item.qty && item.unitPrice ? item.qty * item.unitPrice : null),
    }));

  const calculatedSubtotal = normalizedItems.reduce(
    (sum, item) => sum + (item.total || 0),
    0,
  );

  return {
    format: doc.format,
    title: doc.title || 'Data',
    items: normalizedItems,
    summary: {
      itemCount: normalizedItems.length,
      subtotal: doc.totals.subtotal || (calculatedSubtotal > 0 ? calculatedSubtotal : null),
      tax: doc.totals.tax,
      total: doc.totals.total || (calculatedSubtotal > 0 && doc.totals.tax ? calculatedSubtotal + doc.totals.tax : null),
    },
    metadata: doc.metadata,
    validation,
  };
}

export function formatAsPreview(doc: NormalizedDocument): string {
  const lines: string[] = [];

  lines.push(`${doc.title} (${doc.format})`);
  lines.push('');

  if (doc.items.length > 0) {
    lines.push('Item:');
    for (const item of doc.items) {
      const qtyStr = item.qty ? `${item.qty} x ` : '';
      const priceStr = item.unitPrice ? `@ Rp ${item.unitPrice.toLocaleString('id-ID')}` : '';
      const totalStr = item.total ? ` = Rp ${item.total.toLocaleString('id-ID')}` : '';
      lines.push(`  ${item.name}: ${qtyStr}${priceStr}${totalStr}`);
    }
    lines.push('');
  }

  if (doc.summary.subtotal !== null) {
    lines.push(`Subtotal: Rp ${doc.summary.subtotal.toLocaleString('id-ID')}`);
  }
  if (doc.summary.tax !== null) {
    lines.push(`Pajak: Rp ${doc.summary.tax.toLocaleString('id-ID')}`);
  }
  if (doc.summary.total !== null) {
    lines.push(`Total: Rp ${doc.summary.total.toLocaleString('id-ID')}`);
  }

  if (doc.metadata && Object.keys(doc.metadata).length > 0) {
    lines.push('');
    lines.push('Metadata:');
    for (const [key, value] of Object.entries(doc.metadata)) {
      lines.push(`  ${key}: ${value}`);
    }
  }

  if (!doc.validation.valid) {
    lines.push('');
    lines.push(`Error validasi: ${doc.validation.errors.join(', ')}`);
  }

  if (doc.validation.warnings.length > 0) {
    lines.push('');
    lines.push(`Peringatan: ${doc.validation.warnings.join(', ')}`);
  }

  return lines.join('\n');
}
