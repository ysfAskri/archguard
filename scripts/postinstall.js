#!/usr/bin/env node
// Copy tree-sitter WASM grammars from node_modules to wasm/ directory
import { copyFile, mkdir, access } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const wasmDir = join(root, 'wasm');

const GRAMMARS = [
  { pkg: 'tree-sitter-typescript', file: 'tree-sitter-typescript.wasm' },
  { pkg: 'tree-sitter-typescript', file: 'tree-sitter-tsx.wasm' },
  { pkg: 'tree-sitter-javascript', file: 'tree-sitter-javascript.wasm' },
];

async function main() {
  await mkdir(wasmDir, { recursive: true });

  for (const { pkg, file } of GRAMMARS) {
    const src = join(root, 'node_modules', pkg, file);
    const dest = join(wasmDir, file);
    try {
      await access(src);
      await copyFile(src, dest);
    } catch {
      // Grammar package not installed — skip silently
    }
  }
}

main().catch(() => {});
