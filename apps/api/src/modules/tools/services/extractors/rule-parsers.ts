export interface ExtractedItem {
  name: string;
  qty: number | null;
  unitPrice: number | null;
  total: number | null;
  raw: string;
}

export interface ParsedDocument {
  format: string;
  title: string;
  items: ExtractedItem[];
  totals: {
    subtotal: number | null;
    tax: number | null;
    total: number | null;
  };
  metadata: Record<string, string>;
  rawText: string;
}

function parseIndonesianNumber(str: string): number | null {
  if (!str) return null;
  const cleaned = str.replace(/[Rp\s]/g, '').replace(/\./g, '').replace(',', '.');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

function extractNumbers(text: string): number[] {
  const matches = text.match(/[\d.,]+(?:\.\d{3})*(?:,\d{1,2})?/g);
  if (!matches) return [];
  return matches
    .map((m) => {
      const cleaned = m.replace(/\./g, '').replace(',', '.');
      const num = parseFloat(cleaned);
      return isNaN(num) ? null : num;
    })
    .filter((n): n is number => n !== null);
}

export function parseInvoice(text: string): ParsedDocument {
  const lines = text.split('\n').filter((l) => l.trim().length > 0);
  const items: ExtractedItem[] = [];
  const metadata: Record<string, string> = {};

  const itemPatterns = [
    /^(.+?)\s+(\d+)\s+(?:pcs|pc|unit|barang|item|lembar|kg|liter|meter|roll|box|pack|set|pair|lusin|rim|batang|slop|karton|sachet|botol|kaleng|tube|bag|roll|keping|buah|ekor|buah|karung|tangkai|ikat| bundel|rim)\s*[@x×]\s*(?:Rp\.?\s*)?([\d.,]+)/i,
    /^(.+?)\s+(\d+)\s*[@x×]\s*(?:Rp\.?\s*)?([\d.,]+)/i,
    /^(.+?)\s+(?:Rp\.?\s*)?([\d.,]+)\s*[@x×]\s*(\d+)/i,
    /^(\d+[.)]\s*.+?)\s+(?:Rp\.?\s*)?([\d.,]+)/,
  ];

  for (const line of lines) {
    const trimmed = line.trim();

    if (/^(invoice|faktur|nota|bon)/i.test(trimmed)) {
      metadata['documentType'] = 'invoice';
      continue;
    }

    if (/(invoice|faktur|nota)\s*(?:no|number|nomor|#)\s*:?\s*(.+)/i.test(trimmed)) {
      const match = trimmed.match(/(?:no|number|nomor|#)\s*:?\s*(.+)/i);
      if (match) metadata['invoiceNumber'] = match[1].trim();
      continue;
    }

    if (/(date|tanggal)\s*:?\s*(.+)/i.test(trimmed)) {
      const match = trimmed.match(/(?:date|tanggal)\s*:?\s*(.+)/i);
      if (match) metadata['date'] = match[1].trim();
      continue;
    }

    if (/(due date|jatuh tempo)\s*:?\s*(.+)/i.test(trimmed)) {
      const match = trimmed.match(/(?:due date|jatuh tempo)\s*:?\s*(.+)/i);
      if (match) metadata['dueDate'] = match[1].trim();
      continue;
    }

    if (/(subtotal|sub total|jumlah sebelum pajak)\s*:?\s*(?:Rp\.?\s*)?([\d.,]+)/i.test(trimmed)) {
      const match = trimmed.match(/([\d.,]+)/);
      if (match) metadata['subtotal'] = match[1];
      continue;
    }

    if (/(ppn|vat|pajak|tax)\s*(?:\(?\d+%?\)?)?\s*:?\s*(?:Rp\.?\s*)?([\d.,]+)/i.test(trimmed)) {
      const match = trimmed.match(/([\d.,]+)/);
      if (match) metadata['tax'] = match[1];
      continue;
    }

    if (/(grand total|total amount|total tagihan|jumlah total)\s*:?\s*(?:Rp\.?\s*)?([\d.,]+)/i.test(trimmed)) {
      const match = trimmed.match(/([\d.,]+)/);
      if (match) metadata['total'] = match[1];
      continue;
    }

    let matched = false;
    for (const pattern of itemPatterns) {
      const itemMatch = trimmed.match(pattern);
      if (itemMatch) {
        const name = (itemMatch[1] || '').replace(/^\d+[.)]\s*/, '').trim();
        const numbers = extractNumbers(trimmed);

        if (name.length > 1 && numbers.length >= 1) {
          items.push({
            name,
            qty: numbers.length >= 2 ? numbers[0] : null,
            unitPrice: numbers.length >= 2 ? numbers[1] : numbers[0],
            total: numbers.length >= 3 ? numbers[2] : numbers.length >= 2 ? numbers[0] * numbers[1] : null,
            raw: trimmed,
          });
          matched = true;
          break;
        }
      }
    }

    if (!matched && items.length > 0 && /^(\d+)/.test(trimmed)) {
      const numbers = extractNumbers(trimmed);
      if (numbers.length >= 2) {
        const lastItem = items[items.length - 1];
        if (lastItem.total === null) {
          lastItem.total = numbers[numbers.length - 1];
        }
      }
    }
  }

  const subtotal = metadata['subtotal'] ? parseIndonesianNumber(metadata['subtotal']) : null;
  const tax = metadata['tax'] ? parseIndonesianNumber(metadata['tax']) : null;
  const total = metadata['total'] ? parseIndonesianNumber(metadata['total']) : null;

  const calculatedSubtotal = items.reduce(
    (sum, item) => sum + (item.total || (item.qty && item.unitPrice ? item.qty * item.unitPrice : 0)),
    0,
  );

  return {
    format: 'invoice',
    title: metadata['invoiceNumber'] || 'Invoice',
    items,
    totals: {
      subtotal: subtotal || (calculatedSubtotal > 0 ? calculatedSubtotal : null),
      tax,
      total: total || (calculatedSubtotal > 0 && tax ? calculatedSubtotal + tax : null),
    },
    metadata,
    rawText: text,
  };
}

export function parseReceipt(text: string): ParsedDocument {
  const lines = text.split('\n').filter((l) => l.trim().length > 0);
  const items: ExtractedItem[] = [];
  const metadata: Record<string, string> = {};

  for (const line of lines) {
    const trimmed = line.trim();

    if (/(receipt|struk|bukti bayar)/i.test(trimmed)) {
      metadata['documentType'] = 'receipt';
      continue;
    }

    if (/(store|toko|merchant)\s*:?\s*(.+)/i.test(trimmed)) {
      const match = trimmed.match(/(?:store|toko|merchant)\s*:?\s*(.+)/i);
      if (match) metadata['store'] = match[1].trim();
      continue;
    }

    if (/(date|tanggal)\s*:?\s*(.+)/i.test(trimmed)) {
      const match = trimmed.match(/(?:date|tanggal)\s*:?\s*(.+)/i);
      if (match) metadata['date'] = match[1].trim();
      continue;
    }

    const itemMatch = trimmed.match(/^(.+?)\s+(?:Rp\.?\s*)?([\d.,]+)\s*$/);
    if (itemMatch && itemMatch[1].length > 1) {
      const name = itemMatch[1].trim();
      const price = parseIndonesianNumber(itemMatch[2]);
      if (price !== null && price > 0) {
        items.push({
          name,
          qty: 1,
          unitPrice: price,
          total: price,
          raw: trimmed,
        });
      }
    }
  }

  const totalLine = lines.find((l) => /total/i.test(l));
  const total = totalLine ? parseIndonesianNumber(totalLine.replace(/total.*?:?\s*/i, '')) : null;

  return {
    format: 'receipt',
    title: metadata['store'] || 'Struk',
    items,
    totals: { subtotal: null, tax: null, total },
    metadata,
    rawText: text,
  };
}

export function parsePurchaseOrder(text: string): ParsedDocument {
  const lines = text.split('\n').filter((l) => l.trim().length > 0);
  const items: ExtractedItem[] = [];
  const metadata: Record<string, string> = {};

  for (const line of lines) {
    const trimmed = line.trim();

    if (/(purchase order|po)\s*(?:no|number|nomor|#)\s*:?\s*(.+)/i.test(trimmed)) {
      const match = trimmed.match(/(?:no|number|nomor|#)\s*:?\s*(.+)/i);
      if (match) metadata['poNumber'] = match[1].trim();
      continue;
    }

    if (/(supplier|vendor|pemasok)\s*:?\s*(.+)/i.test(trimmed)) {
      const match = trimmed.match(/(?:supplier|vendor|pemasok)\s*:?\s*(.+)/i);
      if (match) metadata['supplier'] = match[1].trim();
      continue;
    }

    if (/(delivery date|tanggal pengiriman)\s*:?\s*(.+)/i.test(trimmed)) {
      const match = trimmed.match(/(?:delivery date|tanggal pengiriman)\s*:?\s*(.+)/i);
      if (match) metadata['deliveryDate'] = match[1].trim();
      continue;
    }

    const itemMatch = trimmed.match(/^(.+?)\s+(\d+)\s*(?:pcs|pc|unit|barang|lembar|kg|liter|meter)?\s*$/i);
    if (itemMatch && itemMatch[1].length > 1) {
      const name = itemMatch[1].trim().replace(/^\d+[.)]\s*/, '');
      const qty = parseInt(itemMatch[2]);
      if (!isNaN(qty) && qty > 0) {
        items.push({
          name,
          qty,
          unitPrice: null,
          total: null,
          raw: trimmed,
        });
      }
    }
  }

  return {
    format: 'purchase_order',
    title: metadata['poNumber'] || 'Purchase Order',
    items,
    totals: { subtotal: null, tax: null, total: null },
    metadata,
    rawText: text,
  };
}

export function parseGeneric(text: string): ParsedDocument {
  const lines = text.split('\n').filter((l) => l.trim().length > 0);
  const items: ExtractedItem[] = [];
  const metadata: Record<string, string> = {};

  for (const line of lines) {
    const trimmed = line.trim();
    const numbers = extractNumbers(trimmed);

    if (numbers.length >= 1 && trimmed.length > 3) {
      const name = trimmed
        .replace(/[\d.,]+(?:\.\d{3})*(?:,\d{1,2})?/g, '')
        .replace(/[@x×]/g, '')
        .replace(/\s+/g, ' ')
        .trim();

      if (name.length > 1) {
        items.push({
          name,
          qty: numbers.length >= 2 ? numbers[0] : null,
          unitPrice: numbers.length >= 2 ? numbers[1] : numbers[0],
          total: numbers.length >= 3 ? numbers[2] : null,
          raw: trimmed,
        });
      }
    }
  }

  return {
    format: 'generic',
    title: 'Data',
    items,
    totals: { subtotal: null, tax: null, total: null },
    metadata,
    rawText: text,
  };
}
