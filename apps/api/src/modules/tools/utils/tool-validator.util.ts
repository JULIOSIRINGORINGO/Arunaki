export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validates arguments against JSON schema parameters definition.
 */
export function validateToolArgs(
  args: Record<string, any>,
  parameters: Record<string, any>,
): ValidationResult {
  const errors: string[] = [];
  const required: string[] = parameters.required || [];
  const properties: Record<string, any> = parameters.properties || {};

  for (const field of required) {
    if (args[field] === undefined || args[field] === null) {
      errors.push(`Field "${field}" is required`);
    }
  }

  for (const [key, schema] of Object.entries(properties)) {
    const value = args[key];
    if (value === undefined || value === null) continue;

    const expectedType = schema.type;
    if (expectedType === 'string' && typeof value !== 'string') {
      errors.push(`Field "${key}" must be a string`);
    }
    if (expectedType === 'number' && typeof value !== 'number') {
      errors.push(`Field "${key}" must be a number`);
    }
    if (expectedType === 'array' && !Array.isArray(value)) {
      errors.push(`Field "${key}" must be an array`);
    }
    if (expectedType === 'boolean' && typeof value !== 'boolean') {
      errors.push(`Field "${key}" must be a boolean`);
    }
    if (
      expectedType === 'object' &&
      (Array.isArray(value) || typeof value !== 'object')
    ) {
      errors.push(`Field "${key}" must be an object`);
    }

    const enumValues = schema.enum;
    if (
      enumValues &&
      Array.isArray(enumValues) &&
      !enumValues.includes(value)
    ) {
      errors.push(`Field "${key}" must be one of: ${enumValues.join(', ')}`);
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Normalizes common argument aliases (path vs filePath vs filename).
 */
export function normalizeToolArgs(args: Record<string, any>): Record<string, any> {
  const normalized = { ...args };
  if (!normalized.filePath && normalized.path) normalized.filePath = normalized.path;
  if (!normalized.path && normalized.filePath) normalized.path = normalized.filePath;
  if (!normalized.filePath && normalized.filename) normalized.filePath = normalized.filename;
  if (!normalized.filename && normalized.filePath) normalized.filename = normalized.filePath;
  if (!normalized.query && normalized.q) normalized.query = normalized.q;
  return normalized;
}

/**
 * Builds compact parameter schema to optimize token usage in tool definitions.
 */
export function buildCompactParameterSchema(
  params: Record<string, any>,
): Record<string, any> {
  const compact: Record<string, any> = { type: 'object' };
  const props: Record<string, any> = {};
  for (const [key, val] of Object.entries(params.properties || {})) {
    props[key] = {
      type: (val as any).type,
      description: ((val as any).description || '').slice(0, 60),
    };
    if ((val as any).enum) props[key].enum = (val as any).enum;
  }
  if (Object.keys(props).length > 0) compact.properties = props;
  if (params.required) compact.required = params.required;
  return compact;
}
