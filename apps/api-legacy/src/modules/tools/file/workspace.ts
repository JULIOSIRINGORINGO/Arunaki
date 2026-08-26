import * as path from 'path';

/**
 * Resolve file path against workspace root.
 * Blocks path traversal attacks.
 */
export function resolvePath(filePath: string, rootPath: string): string {
  const resolved = path.isAbsolute(filePath)
    ? path.resolve(filePath)
    : path.resolve(rootPath, filePath);

  const normalizedRoot = rootPath.toLowerCase();
  if (!resolved.toLowerCase().startsWith(normalizedRoot + path.sep)) {
    throw new Error('Security violation: Path traversal blocked');
  }

  return resolved;
}
