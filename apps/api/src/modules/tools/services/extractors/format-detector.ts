export type DocumentFormat =
  | 'invoice'
  | 'receipt'
  | 'purchase_order'
  | 'tabular'
  | 'list'
  | 'unknown';

export interface DetectedFormat {
  type: DocumentFormat;
  confidence: number;
  signals: string[];
}

export function detectFormat(text: string): DetectedFormat {
  const lower = text.toLowerCase();
  const signals: string[] = [];
  let score = 0;

  const invoiceSignals = [
    /\b(invoice|faktur|nota|bon)\b/,
    /\b(due date|jatuh tempo|tanggal jatuh tempo)\b/,
    /\b(ship to|bill to|kirim ke|tagih ke)\b/,
    /\b(subtotal|total amount|grand total|jumlah)\b/,
    /\b(ppn|vat|pajak)\b/,
    /\b(item|barang|produk)\b.*\b(qty|jumlah|kuantitas)\b/,
  ];

  const receiptSignals = [
    /\b(receipt|struk|bukti bayar|payment proof)\b/,
    /\b(cash|tunai|card|kartu)\b/,
    /\b(change|kembalian|kembali)\b/,
    /\b(thank you|terima kasih)\b/,
  ];

  const poSignals = [
    /\b(purchase order|po number|nomor po)\b/,
    /\b(delivery date|tanggal pengiriman)\b/,
    /\b(supplier|vendor|pemasok)\b/,
    /\b(ship to|deliver to|kirim ke)\b/,
  ];

  for (const pattern of invoiceSignals) {
    if (pattern.test(lower)) {
      signals.push(`invoice:${pattern.source}`);
      score += 2;
    }
  }

  for (const pattern of receiptSignals) {
    if (pattern.test(lower)) {
      signals.push(`receipt:${pattern.source}`);
      score += 2;
    }
  }

  for (const pattern of poSignals) {
    if (pattern.test(lower)) {
      signals.push(`po:${pattern.source}`);
      score += 2;
    }
  }

  const hasTable = /\|.*\|.*\|/.test(text) || /\t.*\t/.test(text);
  if (hasTable) {
    signals.push('tabular:delimiters');
    score += 1;
  }

  const hasBullets = /^\s*[-*•]\s+/m.test(text) || /^\s*\d+[.)]\s+/m.test(text);
  if (hasBullets) {
    signals.push('list:bullets');
    score += 1;
  }

  if (score >= 4) {
    if (signals.some((s) => s.startsWith('invoice:'))) {
      return { type: 'invoice', confidence: Math.min(score / 8, 1), signals };
    }
    if (signals.some((s) => s.startsWith('receipt:'))) {
      return { type: 'receipt', confidence: Math.min(score / 6, 1), signals };
    }
    if (signals.some((s) => s.startsWith('po:'))) {
      return { type: 'purchase_order', confidence: Math.min(score / 6, 1), signals };
    }
  }

  if (hasTable) {
    return { type: 'tabular', confidence: 0.6, signals };
  }

  if (hasBullets) {
    return { type: 'list', confidence: 0.5, signals };
  }

  return { type: 'unknown', confidence: 0.2, signals: ['no_pattern_matched'] };
}
