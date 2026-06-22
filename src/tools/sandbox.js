import path from 'node:path';

/**
 * Resolves a model-supplied relative path against the workspace root and
 * guarantees the result stays inside it. Throws on any attempt to escape
 * (via "..", absolute paths, symlinked-looking traversal, etc).
 */
export function resolveSafePath(workspaceDir, relPath) {
  if (typeof relPath !== 'string' || relPath.trim() === '') {
    throw new Error('path must be a non-empty relative path');
  }
  if (path.isAbsolute(relPath)) {
    throw new Error(`path must be relative to the workspace, got absolute path: ${relPath}`);
  }

  const resolved = path.resolve(workspaceDir, relPath);
  const root = path.resolve(workspaceDir);

  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    throw new Error(`path escapes the workspace: ${relPath}`);
  }

  return resolved;
}
