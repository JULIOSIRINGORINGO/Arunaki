import { Injectable } from '@nestjs/common';

export interface CalculationResult {
  operation: string;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  finalTotal: number;
  breakdown: string;
}

@Injectable()
export class EnterpriseCalculatorTool {
  calculateFinancials(
    items: { name: string; qty: number; price: number }[],
    taxPercent: number = 0,
    discountPercent: number = 0,
  ): CalculationResult {
    let subtotal = 0;
    const details: string[] = [];

    for (const item of items) {
      const itemTotal = item.qty * item.price;
      subtotal += itemTotal;
      details.push(`${item.name}: ${item.qty} x Rp ${item.price.toLocaleString('id-ID')} = Rp ${itemTotal.toLocaleString('id-ID')}`);
    }

    const discountAmount = (subtotal * discountPercent) / 100;
    const taxableSubtotal = subtotal - discountAmount;
    const taxAmount = (taxableSubtotal * taxPercent) / 100;
    const finalTotal = taxableSubtotal + taxAmount;

    return {
      operation: 'Financial Calculation',
      subtotal,
      discountAmount,
      taxAmount,
      finalTotal,
      breakdown: `Subtotal: Rp ${subtotal.toLocaleString('id-ID')}\nDiskon (${discountPercent}%): Rp ${discountAmount.toLocaleString('id-ID')}\nPajak (${taxPercent}%): Rp ${taxAmount.toLocaleString('id-ID')}\nTotal Akhir: Rp ${finalTotal.toLocaleString('id-ID')}`,
    };
  }
}
