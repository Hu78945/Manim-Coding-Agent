import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveSafePath } from './sandbox.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const VENV_PYTHON = path.join(PROJECT_ROOT, '.venv', 'bin', 'python3');

// Prefer the project's venv (where manim is installed) over whatever
// "python3" resolves to on PATH, so this works regardless of whether the
// venv is activated in the shell that launched node.
const PYTHON_BIN = process.env.PYTHON_BIN || (fs.existsSync(VENV_PYTHON) ? VENV_PYTHON : 'python3');

const DEFAULT_TIMEOUT_MS = 3 * 60 * 1000; // manim renders can be slow
const MAX_OUTPUT_CHARS = 20000; // keep huge manim logs from blowing up the context

function truncate(text) {
  if (text.length <= MAX_OUTPUT_CHARS) return text;
  return `${text.slice(0, MAX_OUTPUT_CHARS)}\n...[truncated ${text.length - MAX_OUTPUT_CHARS} chars]`;
}

export async function executePython(workspaceDir, { path: relPath, args = [] }) {
  const target = resolveSafePath(workspaceDir, relPath);

  return new Promise((resolve) => {
    const child = spawn(PYTHON_BIN, [target, ...args], {
      cwd: workspaceDir,
      env: process.env,
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, DEFAULT_TIMEOUT_MS);

    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });

    child.on('error', (err) => {
      clearTimeout(timer);
      resolve({ ok: false, error: `failed to start ${PYTHON_BIN}: ${err.message}` });
    });

    child.on('close', (exitCode) => {
      clearTimeout(timer);
      resolve({
        ok: exitCode === 0 && !timedOut,
        exitCode,
        timedOut,
        stdout: truncate(stdout),
        stderr: truncate(stderr),
      });
    });
  });
}
