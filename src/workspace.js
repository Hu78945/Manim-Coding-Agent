import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(__dirname, '..', 'workspace');

function slugify(topic) {
  return topic
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'topic';
}

export async function createWorkspace(topic) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dir = path.join(WORKSPACE_ROOT, `${timestamp}-${slugify(topic)}`);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}
