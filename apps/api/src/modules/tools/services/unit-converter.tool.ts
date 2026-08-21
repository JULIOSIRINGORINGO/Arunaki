import { Injectable, Logger, Optional } from '@nestjs/common';
import { DomainRegistryService } from '../../domain/domain.registry.service.js';
import { ToolResult } from '../interfaces/tool-result.interface.js';

/**
 * UnitConverterTool — converts units using domain-specific configs.
 *
 * Reads unit definitions from DomainRegistryService instead of hardcoding.
 * Each business type (garment, restaurant, retail) provides its own units.
 */
@Injectable()
export class UnitConverterTool {
  private readonly logger = new Logger(UnitConverterTool.name);
  private readonly domainRegistry: DomainRegistryService;

  constructor(@Optional() domainRegistry?: DomainRegistryService) {
    this.domainRegistry = domainRegistry || new DomainRegistryService();
  }

  async convert(params: {
    value: number;
    from: string;
    to: string;
    domain?: string;
  }): Promise<ToolResult> {
    const startTime = Date.now();
    const { value, from, to, domain } = params;

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
    const domainId = domain || 'generic';

    // Get unit definitions from domain config
    const categories = ['currency', 'length', 'mass', 'count'] as const;

    for (const category of categories) {
      const units = this.domainRegistry.getUnits(domainId, category) || [];
      const fromUnit = units.find((u) => u.name === fromClean);
      const toUnit = units.find((u) => u.name === toClean);

      if (fromUnit && toUnit) {
        // Convert: value * fromBase / toBase
        const baseValue = value * fromUnit.toBase;
        const resultValue = baseValue / toUnit.toBase;

        const formattedResult = Number(resultValue.toFixed(4));
        const text = `${value} ${from} = ${formattedResult} ${to}`;

        return {
          status: 'success',
          data: {
            value,
            from: from.toUpperCase(),
            to: to.toUpperCase(),
            result: formattedResult,
            domain: domainId,
          },
          preview: text,
          metadata: {
            toolName: 'unit_converter',
            displayName: 'Konverter Satuan',
            executionTime: Date.now() - startTime,
          },
        };
      }
    }

    // Try cross-category (e.g., length to length from different domains)
    // This handles cases where user doesn't specify domain
    for (const category of categories) {
      const allUnits = this.domainRegistry.getUnits('generic', category) || [];
      const fromUnit = allUnits.find((u) => u.name === fromClean);
      const toUnit = allUnits.find((u) => u.name === toClean);

      if (fromUnit && toUnit) {
        const baseValue = value * fromUnit.toBase;
        const resultValue = baseValue / toUnit.toBase;
        const formattedResult = Number(resultValue.toFixed(4));
        const text = `${value} ${from} = ${formattedResult} ${to}`;

        return {
          status: 'success',
          data: {
            value,
            from: from.toUpperCase(),
            to: to.toUpperCase(),
            result: formattedResult,
          },
          preview: text,
          metadata: {
            toolName: 'unit_converter',
            displayName: 'Konverter Satuan',
            executionTime: Date.now() - startTime,
          },
        };
      }
    }

    // Build available units list for error message
    const availableUnits: string[] = [];
    for (const category of categories) {
      const units = this.domainRegistry.getUnits(domainId, category) || [];
      availableUnits.push(...units.map((u) => u.name));
    }

    return {
      status: 'error',
      data: {},
      preview: `Satuan '${from}' atau '${to}' tidak dikenali. Gunakan: ${availableUnits.join(', ')}.`,
      metadata: {
        toolName: 'unit_converter',
        displayName: 'Konverter Satuan',
        executionTime: Date.now() - startTime,
      },
      error: {
        code: 'UNKNOWN_UNIT',
        message: `Unknown unit: ${from} to ${to}`,
      },
    };
  }
}
