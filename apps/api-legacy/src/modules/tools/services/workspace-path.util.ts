import * as path from 'path';

/**
 * Resolve a model-provided filename against the workspace root.
 *
 * Small models frequently emit ABSOLUTE paths (they can see Workspace Root in
 * their system prompt). Sanitizing those blindly corrupts them into flat names
 * like "E__JS_Arunika_workspace-demo_file.txt". If the absolute path lives
 * INSIDE the workspace root, convert it to a safe relative path instead.
 * Anything else falls back to legacy character sanitization.
 */
export function resolveWorkspaceFilename(
  rawFilename: string,
  rootPath: string,
): string {
  const trimmed = rawFilename.replace(/^@+/, '').trim();
  if (!trimmed || !rootPath) {
    return trimmed.replace(/[/\\?%*:|"<>]/g, '_');
  }

  const resolved = path.isAbsolute(trimmed) ? path.resolve(trimmed) : null;
  const normalizedRoot = rootPath.toLowerCase();
  if (
    resolved &&
    resolved.toLowerCase().startsWith(normalizedRoot + path.sep)
  ) {
    return path.relative(rootPath, resolved);
  }
  if (!resolved) {
    // Relative path: preserve subfolders, but block ".." escape attempts.
    const joined = path.resolve(rootPath, trimmed);
    if (joined.toLowerCase().startsWith(normalizedRoot + path.sep)) {
      return path.relative(rootPath, joined);
    }
  }
  return trimmed.replace(/[/\\?%*:|"<>]/g, '_');
}
