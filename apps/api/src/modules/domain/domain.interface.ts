/**
 * Domain Plugin Interface
 *
 * Defines the contract for business-type-specific configuration.
 * Each business type (garment, restaurant, retail, etc.) provides
 * its own config that tools and prompts read from.
 *
 * Design: Config-driven (like Hermes), not code-driven.
 * Tools read from this config instead of hardcoding domain logic.
 */

export interface UnitDefinition {
  /** Unit name (e.g., "yard", "meter", "roll") */
  name: string;
  /** Conversion factor to base unit (e.g., meters for length) */
  toBase: number;
  /** Display label in Indonesian */
  label?: string;
}

export interface TemplateCategory {
  /** Category name (e.g., "Harga Kain", "Menu Makanan") */
  name: string;
  /** Column headers for table format */
  columns?: string[];
  /** Field names for key-value format */
  fields?: string[];
  /** Example data row */
  example?: string[];
}

export interface DomainConfig {
  /** Unique identifier (e.g., "garment", "restaurant", "retail", "generic") */
  id: string;

  /** Display name */
  name: string;

  /** Description in English */
  description: string;

  /** Unit conversion definitions */
  units: {
    length?: UnitDefinition[];
    mass?: UnitDefinition[];
    count?: UnitDefinition[];
    currency?: UnitDefinition[];
  };

  /** Knowledge template categories for this business type */
  templateCategories: TemplateCategory[];

  /** Domain-specific terminology (term → definition) */
  terminology: Record<string, string>;

  /** Catalog/product matching configuration */
  catalogMatch: {
    /** Common SKU patterns (regex) */
    skuPatterns: string[];
    /** Name aliases for fuzzy matching */
    nameAliases: Record<string, string[]>;
    /** Fuzzy match threshold (0-1) */
    threshold: number;
  };

  /** Communication style */
  communication: {
    /** Greeting template ({name} = recipient name, {topic} = subject) */
    greetingTemplate: string;
    /** Formality level */
    formality: 'casual' | 'formal' | 'mixed';
    /** Common phrases */
    phrases?: Record<string, string>;
  };

  /** Example categories for knowledge builder prompt */
  promptExamples: string;
}
