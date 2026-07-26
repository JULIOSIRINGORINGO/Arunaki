import { Injectable, Logger } from '@nestjs/common';
import { ToolResult } from '../interfaces/tool-result.interface.js';

@Injectable()
export class UnitConverterTool {
  private readonly logger = new Logger(UnitConverterTool.name);

  async convert(params: {
    value: number;
    from: string;
    to: string;
  }): Promise<ToolResult> {
    const startTime = Date.now();
    const { value, from, to } = params;

    if (value === undefined || !from || !to) {
      return {
        status: 'error',
        data: {},
        preview: 'Parameter value, from, dan to harus diisi',
        metadata: {
          toolName: 'unit_converter',
          displayName: 'Konverter Satuan',
          executionTime: Date.now() - startTime,
        },
        error: { code: 'INVALID_PARAMS', message: 'Missing parameters' },
      };
    }

    const fromClean = from.trim().toLowerCase();
    const toClean = to.trim().toLowerCase();

    // Currency rates (USD, IDR, EUR, SGD, MYR)
    const currencyRates: Record<string, number> = {
      usd: 16200,
      idr: 1,
      eur: 17500,
      sgd: 12100,
      myr: 3650,
    };

    if (currencyRates[fromClean] !== undefined && currencyRates[toClean] !== undefined) {
      const valueInIdr = value * currencyRates[fromClean];
      const resultValue = valueInIdr / currencyRates[toClean];
      const formattedResult = resultValue.toLocaleString('id-ID', { maximumFractionDigits: 2 });
      const text = `${value} ${from.toUpperCase()} = ${formattedResult} ${to.toUpperCase()}`;

      return {
        status: 'success',
        data: { value, from: from.toUpperCase(), to: to.toUpperCase(), result: resultValue },
        preview: text,
        metadata: {
          toolName: 'unit_converter',
          displayName: 'Konverter Mata Uang',
          executionTime: Date.now() - startTime,
        },
      };
    }

    // Common Garment & Business Units (Yard, Meter, Roll, Kg, Gram, Pcs, Dozen)
    const lengthToMeters: Record<string, number> = {
      yard: 0.9144,
      yd: 0.9144,
      meter: 1,
      m: 1,
      cm: 0.01,
      inch: 0.0254,
      in: 0.0254,
      feet: 0.3048,
      ft: 0.3048,
      roll: 45.72, // 1 roll standard garment = 50 yards = 45.72 meters
    };

    const massToKg: Record<string, number> = {
      kg: 1,
      kilogram: 1,
      g: 0.001,
      gram: 0.001,
      lbs: 0.453592,
      pound: 0.453592,
      oz: 0.0283495,
    };

    const countToPcs: Record<string, number> = {
      pcs: 1,
      lusin: 12,
      dozen: 12,
      kodi: 20,
      gross: 144,
    };

    let resultValue: number | null = null;

    if (lengthToMeters[fromClean] && lengthToMeters[toClean]) {
      const meters = value * lengthToMeters[fromClean];
      resultValue = meters / lengthToMeters[toClean];
    } else if (massToKg[fromClean] && massToKg[toClean]) {
      const kgs = value * massToKg[fromClean];
      resultValue = kgs / massToKg[toClean];
    } else if (countToPcs[fromClean] && countToPcs[toClean]) {
      const pcs = value * countToPcs[fromClean];
      resultValue = pcs / countToPcs[toClean];
    }

    if (resultValue !== null) {
      const formattedResult = Number(resultValue.toFixed(4));
      const text = `${value} ${from} = ${formattedResult} ${to}`;

      return {
        status: 'success',
        data: { value, from, to, result: formattedResult },
        preview: text,
        metadata: {
          toolName: 'unit_converter',
          displayName: 'Konverter Satuan',
          executionTime: Date.now() - startTime,
        },
      };
    }

    return {
      status: 'error',
      data: {},
      preview: `Satuan '${from}' atau '${to}' tidak dikenali. Gunakan: yard, meter, cm, inch, roll, kg, gram, lusin, kodi, usd, idr.`,
      metadata: {
        toolName: 'unit_converter',
        displayName: 'Konverter Satuan',
        executionTime: Date.now() - startTime,
      },
      error: { code: 'UNKNOWN_UNIT', message: `Unknown unit: ${from} to ${to}` },
    };
  }
}
