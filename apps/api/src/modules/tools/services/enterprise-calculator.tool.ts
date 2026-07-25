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
      const itemTotal = item.qty * item.price;
      subtotal += itemTotal;
      details.push(
        `${item.name}: ${item.qty} x Rp ${item.price.toLocaleString('id-ID')} = Rp ${itemTotal.toLocaleString('id-ID')}`,
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
          total: item.qty * item.price,
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
