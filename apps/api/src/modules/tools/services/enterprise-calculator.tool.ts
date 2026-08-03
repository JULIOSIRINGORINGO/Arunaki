import { Injectable } from '@nestjs/common';
import { ToolResult } from '../interfaces/tool-result.interface.js';

@Injectable()
export class EnterpriseCalculatorTool {
  calculateFinancials(
    items: { name: string; qty: number; price: number }[],
    taxPercent: number = 0,
    discountPercent: number = 0,
  ): ToolResult {
    const startTime = Date.now();
    let subtotal = 0;
    const details: string[] = [];

    for (const item of items) {
      const qty = Number(item.qty) || 0;
      const price = Number(item.price) || 0;
      const name = String(item.name ?? 'Item');
      const itemTotal = qty * price;
      subtotal += itemTotal;
      details.push(
        `${name}: ${qty} x Rp ${price.toLocaleString('id-ID')} = Rp ${itemTotal.toLocaleString('id-ID')}`,
      );
    }

    const discountAmount = (subtotal * discountPercent) / 100;
    const taxableSubtotal = subtotal - discountAmount;
    const taxAmount = (taxableSubtotal * taxPercent) / 100;
    const finalTotal = taxableSubtotal + taxAmount;

    const breakdown = [
      `Subtotal: Rp ${subtotal.toLocaleString('id-ID')}`,
      discountPercent > 0
        ? `Diskon (${discountPercent}%): Rp ${discountAmount.toLocaleString('id-ID')}`
        : null,
      taxPercent > 0
        ? `Pajak (${taxPercent}%): Rp ${taxAmount.toLocaleString('id-ID')}`
        : null,
      `Total Akhir: Rp ${finalTotal.toLocaleString('id-ID')}`,
    ]
      .filter(Boolean)
      .join('\n');

    return {
      status: 'success',
      data: {
        items: items.map((item, i) => ({
          ...item,
          total: (Number(item.qty) || 0) * (Number(item.price) || 0),
          detail: details[i],
        })),
        subtotal,
        discountPercent,
        discountAmount,
        taxPercent,
        taxAmount,
        finalTotal,
      },
      preview: breakdown,
      metadata: {
        toolName: 'calculate',
        displayName: 'Kalkulasi Harga',
        executionTime: Date.now() - startTime,
      },
    };
  }
}
