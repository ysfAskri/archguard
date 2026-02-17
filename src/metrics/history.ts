import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { AnalysisSummary, Finding } from '../core/types.js';
import { logger } from '../utils/logger.js';

const HISTORY_DIR = '.archguard/history';

export interface DetailedFinding {
  ruleId: string;
  analyzer: string;
  severity: string;
  file: string;
  line: number;
  message: string;
}

export interface DetailedRunEntry {
  id: string;
  timestamp: string;
  command: string;
  findings: DetailedFinding[];
  byAnalyzer: Record<string, number>;
  byRule: Record<string, number>;
  byFile: Record<string, number>;
  duration: number;
  totalFiles: number;
  totalFindings: number;
}

function buildRunId(timestamp: string, command: string): string {
  return `${timestamp.replace(/[:.]/g, '-')}-${command}`;
}

export async function saveDetailedRun(
  projectRoot: string,
  summary: AnalysisSummary,
  command: string,
): Promise<string> {
  const timestamp = new Date().toISOString();
  const id = buildRunId(timestamp, command);
  const dirPath = join(projectRoot, HISTORY_DIR);
  await mkdir(dirPath, { recursive: true });

  const allFindings: DetailedFinding[] = summary.analyzerResults.flatMap(r =>
    r.findings.map(f => ({
      ruleId: f.ruleId,
      analyzer: f.analyzer,
      severity: f.severity,
      file: f.file,
      line: f.line,
      message: f.message,
    })),
  );

  const byAnalyzer: Record<string, number> = {};
  const byRule: Record<string, number> = {};
  const byFile: Record<string, number> = {};

  for (const f of allFindings) {
    byAnalyzer[f.analyzer] = (byAnalyzer[f.analyzer] ?? 0) + 1;
    byRule[f.ruleId] = (byRule[f.ruleId] ?? 0) + 1;
    byFile[f.file] = (byFile[f.file] ?? 0) + 1;
  }

  const entry: DetailedRunEntry = {
    id,
    timestamp,
    command,
    findings: allFindings,
    byAnalyzer,
    byRule,
    byFile,
    duration: Math.round(summary.duration),
    totalFiles: summary.totalFiles,
    totalFindings: summary.totalFindings,
  };

  const filePath = join(dirPath, `${id}.json`);
  await writeFile(filePath, JSON.stringify(entry, null, 2) + '\n', 'utf-8');
  logger.debug(`Detailed run saved to ${filePath}`);
  return id;
}

export async function loadDetailedRun(
  projectRoot: string,
  runId: string,
): Promise<DetailedRunEntry | null> {
  const filePath = join(projectRoot, HISTORY_DIR, `${runId}.json`);
  try {
    const raw = await readFile(filePath, 'utf-8');
    return JSON.parse(raw) as DetailedRunEntry;
  } catch {
    return null;
  }
}

export async function listRuns(projectRoot: string): Promise<Array<{ id: string; timestamp: string; command: string }>> {
  const dirPath = join(projectRoot, HISTORY_DIR);
  try {
    const files = await readdir(dirPath);
    const runs: Array<{ id: string; timestamp: string; command: string }> = [];

    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      try {
        const raw = await readFile(join(dirPath, file), 'utf-8');
        const entry = JSON.parse(raw) as DetailedRunEntry;
        runs.push({ id: entry.id, timestamp: entry.timestamp, command: entry.command });
      } catch {
        // Skip corrupt files
      }
    }

    return runs.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  } catch {
    return [];
  }
}
