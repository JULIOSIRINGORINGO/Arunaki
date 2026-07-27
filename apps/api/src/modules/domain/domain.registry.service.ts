import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { DomainConfig, UnitDefinition } from './domain.interface.js';

/**
 * DomainRegistryService — loads and provides domain configs.
 *
 * Config-driven approach (like Hermes): tools read from JSON configs
 * instead of hardcoding domain-specific logic.
 *
 * Usage:
 *   const config = domainRegistry.get('garment');
 *   const units = config.units.length; // garment length units
 */
@Injectable()
export class DomainRegistryService {
  private readonly logger = new Logger(DomainRegistryService.name);
  private readonly configs = new Map<string, DomainConfig>();
  private readonly configsDir: string;

  constructor() {
    // Resolve configs directory relative to compiled output
    // dist/src/modules/domain/configs (prod) or src/modules/domain/configs (dev)
    const distPath = path.join(__dirname, 'configs');
    const srcPath = path.join(__dirname, '..', 'domain', 'configs');
    this.configsDir = fs.existsSync(distPath) ? distPath : srcPath;

    this.loadAll();
  }

  /**
   * Load all domain configs from the configs directory.
   */
  private loadAll(): void {
    try {
      const files = fs.readdirSync(this.configsDir).filter((f) => f.endsWith('.json'));

      for (const file of files) {
        try {
          const filePath = path.join(this.configsDir, file);
          const raw = fs.readFileSync(filePath, 'utf-8');
          const config: DomainConfig = JSON.parse(raw);
          this.configs.set(config.id, config);
        } catch (err: any) {
          this.logger.error(`Failed to load domain config "${file}": ${err.message}`);
        }
      }

      this.logger.log(`Loaded ${this.configs.size} domain configs: ${[...this.configs.keys()].join(', ')}`);
    } catch (err: any) {
      this.logger.error(`Failed to read configs directory: ${err.message}`);
    }
  }

  /**
   * Get a domain config by ID.
   * Falls back to "generic" if not found.
   */
  get(domainId: string): DomainConfig {
    return this.configs.get(domainId) || this.configs.get('generic')!;
  }

  /**
   * Get all available domain configs (summary list).
   */
  listAll(): Array<{ id: string; name: string; description: string }> {
    return [...this.configs.values()].map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
    }));
  }

  /**
   * Get unit definitions for a specific category (length, mass, count, currency).
   */
  getUnits(domainId: string, category: 'length' | 'mass' | 'count' | 'currency'): DomainConfig['units'][typeof category] {
    const config = this.get(domainId);
    return config.units[category] || [];
  }

  /**
   * Find a unit definition by name within a domain.
   */
  findUnit(domainId: string, unitName: string): { definition: UnitDefinition; category: string } | null {
    const config = this.get(domainId);
    const categories = ['length', 'mass', 'count', 'currency'] as const;

    for (const cat of categories) {
      const units = config.units[cat] || [];
      const found = units.find((u) => u.name === unitName.toLowerCase());
      if (found) {
        return { definition: found, category: cat };
      }
    }

    return null;
  }

  /**
   * Get template categories for knowledge builder.
   */
  getTemplateCategories(domainId: string): DomainConfig['templateCategories'] {
    const config = this.get(domainId);
    return config.templateCategories || [];
  }

  /**
   * Get terminology for a domain.
   */
  getTerminology(domainId: string): Record<string, string> {
    const config = this.get(domainId);
    return config.terminology || {};
  }

  /**
   * Get catalog matching config.
   */
  getCatalogMatch(domainId: string): DomainConfig['catalogMatch'] {
    const config = this.get(domainId);
    return config.catalogMatch;
  }

  /**
   * Get communication style for a domain.
   */
  getCommunication(domainId: string): DomainConfig['communication'] {
    const config = this.get(domainId);
    return config.communication;
  }

  /**
   * Reload configs from disk (for development).
   */
  reload(): void {
    this.configs.clear();
    this.loadAll();
  }
}
