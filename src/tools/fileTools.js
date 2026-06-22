import fs from 'node:fs/promises';
import path from 'node:path';
import { resolveSafePath } from './sandbox.js';

export async function writeFile(workspaceDir, { path: relPath, content }) {
  const target = resolveSafePath(workspaceDir, relPath);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, content ?? '', 'utf8');
  return { ok: true, path: relPath, bytesWritten: Buffer.byteLength(content ?? '', 'utf8') };
}

export async function readFile(workspaceDir, { path: relPath }) {
  const target = resolveSafePath(workspaceDir, relPath);
  try {
    const content = await fs.readFile(target, 'utf8');
    return { ok: true, path: relPath, content };
  } catch (err) {
    if (err.code === 'ENOENT') {
      return { ok: false, path: relPath, error: `file not found: ${relPath}` };
    }
    throw err;
  }
}

export async function deleteFile(workspaceDir, { path: relPath }) {
  const target = resolveSafePath(workspaceDir, relPath);
  try {
    await fs.rm(target, { recursive: true, force: false });
    return { ok: true, path: relPath };
  } catch (err) {
    if (err.code === 'ENOENT') {
      return { ok: false, path: relPath, error: `file not found: ${relPath}` };
    }
    throw err;
  }
}

export async function listFiles(workspaceDir, { path: relPath = '.' } = {}) {
  const target = resolveSafePath(workspaceDir, relPath);
  const entries = await fs.readdir(target, { withFileTypes: true });
  return {
    ok: true,
    path: relPath,
    entries: entries.map((e) => ({ name: e.name, type: e.isDirectory() ? 'dir' : 'file' })),
  };
}
