import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { minimatch } from 'minimatch';
import type { Finding } from './types.js';
import { logger } from '../utils/logger.js';

const MEMORY_DIR = '.archguard';
const MEMORY_FILE = 'memory.json';

export interface MemoryEntry {
  ruleId: string;
  pattern: string;
  patternType: 'message' | 'file';
  dismissedAt: string;
  count: number;
}

export interface MemoryFile {
  version: number;
  entries: MemoryEntry[];
}

export async function loadMemory(projectRoot: string): Promise<MemoryFile> {
  const filePath = join(projectRoot, MEMORY_DIR, MEMORY_FILE);
  try {
    const raw = await readFile(filePath, 'utf-8');
    const data = JSON.parse(raw) as MemoryFile;
    if (data.version === 1 && Array.isArray(data.entries)) {
      return data;
    }
    return { version: 1, entries: [] };
  } catch {
    return { version: 1, entries: [] };
  }
}

export async function saveMemory(projectRoot: string, memory: MemoryFile): Promise<void> {
  const dirPath = join(projectRoot, MEMORY_DIR);
  await mkdir(dirPath, { recursive: true });
  const filePath = join(dirPath, MEMORY_FILE);
  await writeFile(filePath, JSON.stringify(memory, null, 2) + '\n', 'utf-8');
}

export function addMemoryEntry(
  memory: MemoryFile,
  ruleId: string,
  pattern: string,
  patternType: 'message' | 'file',
): MemoryFile {
  const existing = memory.entries.find(
    e => e.ruleId === ruleId && e.pattern === pattern && e.patternType === patternType,
  );
  if (existing) {
    existing.count++;
    existing.dismissedAt = new Date().toISOString();
    return memory;
  }
  memory.entries.push({
    ruleId,
    pattern,
    patternType,
    dismissedAt: new Date().toISOString(),
    count: 1,
  });
  return memory;
}

export function applyMemory(
  findings: Finding[],
  memory: MemoryFile,
): { findings: Finding[]; memorySuppressedCount: number } {
  if (memory.entries.length === 0) {
    return { findings, memorySuppressedCount: 0 };
  }

  let memorySuppressedCount = 0;

  const filtered = findings.filter(f => {
    for (const entry of memory.entries) {
      if (entry.ruleId !== '*' && entry.ruleId !== f.ruleId) continue;

      if (entry.patternType === 'message') {
        if (f.message.includes(entry.pattern)) {
          memorySuppressedCount++;
          return false;
        }
      } else if (entry.patternType === 'file') {
        if (minimatch(f.file, entry.pattern)) {
          memorySuppressedCount++;
          return false;
        }
      }
    }
    return true;
  });

  return { findings: filtered, memorySuppressedCount };
}
