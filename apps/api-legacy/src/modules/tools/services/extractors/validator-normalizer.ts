export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface ExtractedDataInput {
  documentType?: string;
  title?: string;
  items?: Array<{
    name?: string;
    qty?: number | null;
    unitPrice?: number | null;
    total?: number | null;
    [key: string]: any;
  }>;
  totals?: {
    subtotal?: number | null;
    tax?: number | null;
    total?: number | null;
  };
  metadata?: Record<string, any>;
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

const VALID_DOC_TYPES = [
  'invoice',
  'receipt',
  'purchase_order',
  'quotation',
  'delivery_note',
  'inventory',
  'report',
  'list',
  'other',
];

export function validateExtractedData(
  input: ExtractedDataInput,
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (input.documentType) {
    const normalized = input.documentType.toLowerCase().replace(/[\s-]/g, '_');
    if (!VALID_DOC_TYPES.includes(normalized)) {
      warnings.push(
        `documentType "${input.documentType}" tidak dikenali, gunakan: ${VALID_DOC_TYPES.join(', ')}`,
      );
    }
  }

  if (!input.items || input.items.length === 0) {
    warnings.push('Tidak ada item yang diberikan');
  } else {
    for (let i = 0; i < input.items.length; i++) {
      const item = input.items[i];
      if (!item.name || item.name.trim().length === 0) {
        errors.push(`Item ${i + 1}: nama kosong`);
      }
      if (item.qty !== null && item.qty !== undefined && item.qty <= 0) {
        errors.push(`Item ${i + 1} (${item.name}): qty harus > 0`);
      }
      if (
        item.unitPrice !== null &&
        item.unitPrice !== undefined &&
        item.unitPrice < 0
      ) {
        errors.push(`Item ${i + 1} (${item.name}): harga tidak boleh negatif`);
      }
    }
  }

  if (input.totals) {
    if (
      input.totals.total !== null &&
      input.totals.total !== undefined &&
      input.totals.subtotal !== null &&
      input.totals.subtotal !== undefined
    ) {
      if (input.totals.total < input.totals.subtotal) {
        warnings.push(
          'Total kurang dari subtotal — mungkin ada diskon yang tidak terdeteksi',
        );
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

export function normalizeExtractedData(
  input: ExtractedDataInput,
): NormalizedDocument {
  const validation = validateExtractedData(input);

  const normalizedItems = (input.items || [])
    .filter((item) => item.name && item.name.trim().length > 0)
    .map((item) => ({
      name: item.name!.trim(),
      qty: item.qty ?? null,
      unitPrice: item.unitPrice ?? null,
      total:
        item.total ??
        (item.qty && item.unitPrice ? item.qty * item.unitPrice : null),
    }));

  const calculatedSubtotal = normalizedItems.reduce(
    (sum, item) => sum + (item.total || 0),
    0,
  );

  const format = (input.documentType || 'other')
    .toLowerCase()
    .replace(/[\s-]/g, '_');
  const title = input.title || 'Data';

  const normalizedMetadata: Record<string, string> = {};
  if (input.metadata) {
    for (const [key, value] of Object.entries(input.metadata)) {
      normalizedMetadata[key] = String(value);
    }
  }

  return {
    format,
    title,
    items: normalizedItems,
    summary: {
      itemCount: normalizedItems.length,
      subtotal:
        input.totals?.subtotal ??
        (calculatedSubtotal > 0 ? calculatedSubtotal : null),
      tax: input.totals?.tax ?? null,
      total:
        input.totals?.total ??
        (calculatedSubtotal > 0 && input.totals?.tax
          ? calculatedSubtotal + input.totals.tax
          : null),
    },
    metadata: normalizedMetadata,
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
      const priceStr = item.unitPrice
        ? `@ Rp ${item.unitPrice.toLocaleString('id-ID')}`
        : '';
      const totalStr = item.total
        ? ` = Rp ${item.total.toLocaleString('id-ID')}`
        : '';
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
