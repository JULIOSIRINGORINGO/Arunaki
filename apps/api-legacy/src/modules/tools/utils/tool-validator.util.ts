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

export function normalizeToolArgs(
  args: Record<string, any>,
): Record<string, any> {
  const normalized = { ...args };

  // File path mapping
  const pathVal =
    normalized.filePath ||
    normalized.path ||
    normalized.filename ||
    normalized.file ||
    normalized.sourcePath ||
    normalized.pdfPath;
  if (pathVal) {
    if (!normalized.filePath) normalized.filePath = pathVal;
    if (!normalized.path) normalized.path = pathVal;
    if (!normalized.filename) normalized.filename = pathVal;
    if (!normalized.sourcePath) normalized.sourcePath = pathVal;
    if (!normalized.pdfPath) normalized.pdfPath = pathVal;
  }

  // Edit find/replace mapping
  const findVal =
    normalized.oldString ||
    normalized.find ||
    normalized.findText ||
    normalized.old_str;
  if (findVal) {
    if (!normalized.oldString) normalized.oldString = findVal;
    if (!normalized.findText) normalized.findText = findVal;
  }

  const replaceVal =
    normalized.newString ||
    normalized.replace ||
    normalized.replaceText ||
    normalized.new_str;
  if (replaceVal !== undefined) {
    if (!normalized.newString) normalized.newString = replaceVal;
    if (!normalized.replaceText) normalized.replaceText = replaceVal;
  }

  // Diff text mapping
  if (Array.isArray(normalized.documents) && normalized.documents.length >= 2) {
    if (!normalized.sourceText)
      normalized.sourceText =
        normalized.documents[0]?.content ||
        normalized.documents[0]?.text ||
        JSON.stringify(normalized.documents[0]);
    if (!normalized.targetText)
      normalized.targetText =
        normalized.documents[1]?.content ||
        normalized.documents[1]?.text ||
        JSON.stringify(normalized.documents[1]);
  }
  if (!normalized.sourceText && normalized.textA)
    normalized.sourceText = normalized.textA;
  if (!normalized.targetText && normalized.textB)
    normalized.targetText = normalized.textB;

  // PII Redaction field mapping
  if (!normalized.fields && normalized.piiTypes)
    normalized.fields = normalized.piiTypes;
  if (!normalized.fields && normalized.types)
    normalized.fields = normalized.types;

  // PDF files array mapping
  if (!normalized.fileList && Array.isArray(normalized.files))
    normalized.fileList = normalized.files;

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
