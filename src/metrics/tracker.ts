import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { logger } from '../utils/logger.js';
import type { AnalysisSummary } from '../core/types.js';

const METRICS_DIR = '.archguard';
const METRICS_FILE = 'metrics.json';
const MAX_ENTRIES = 500;

export interface MetricsEntry {
  timestamp: string;
  command: string;
  totalFiles: number;
  totalFindings: number;
  errors: number;
  warnings: number;
  infos: number;
  duration: number;
  byAnalyzer: Record<string, number>;
}

/**
 * Build a MetricsEntry from an AnalysisSummary and the command name.
 */
export function buildMetricsEntry(
  summary: AnalysisSummary,
  command: string,
): MetricsEntry {
  const byAnalyzer: Record<string, number> = {};
  for (const result of summary.analyzerResults) {
    byAnalyzer[result.analyzer] = result.findings.length;
  }

  return {
    timestamp: new Date().toISOString(),
    command,
    totalFiles: summary.totalFiles,
    totalFindings: summary.totalFindings,
    errors: summary.errors,
    warnings: summary.warnings,
    infos: summary.infos,
    duration: Math.round(summary.duration),
    byAnalyzer,
  };
}

/**
 * Read existing metrics entries from .archguard/metrics.json.
 * Returns an empty array if the file doesn't exist or is malformed.
 */
export async function readMetrics(projectRoot: string): Promise<MetricsEntry[]> {
  const filePath = join(projectRoot, METRICS_DIR, METRICS_FILE);
  try {
    const raw = await readFile(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    logger.warn('metrics.json is not an array, resetting');
    return [];
  } catch {
    // File doesn't exist or is not valid JSON
    return [];
  }
}

/**
 * Append a metrics entry to .archguard/metrics.json.
 * Creates the .archguard/ directory if it doesn't exist.
 * Keeps only the last MAX_ENTRIES entries.
 */
export async function recordMetrics(
  projectRoot: string,
  summary: AnalysisSummary,
  command: string,
): Promise<void> {
  const dirPath = join(projectRoot, METRICS_DIR);
  const filePath = join(dirPath, METRICS_FILE);

  try {
    // Ensure .archguard/ directory exists
    await mkdir(dirPath, { recursive: true });

    // Read existing entries
    const entries = await readMetrics(projectRoot);

    // Build and append new entry
    const entry = buildMetricsEntry(summary, command);
    entries.push(entry);

    // Keep only last MAX_ENTRIES
    const trimmed = entries.length > MAX_ENTRIES
      ? entries.slice(entries.length - MAX_ENTRIES)
      : entries;

    // Write back
    await writeFile(filePath, JSON.stringify(trimmed, null, 2) + '\n', 'utf-8');
    logger.debug(`Metrics recorded: ${entry.totalFindings} findings in ${entry.duration}ms`);

    // Save detailed run history if enabled
    try {
      const { saveDetailedRun } = await import('./history.js');
      await saveDetailedRun(projectRoot, summary, command);
    } catch {
      // Detailed history is optional
    }
  } catch (err) {
    // Metrics recording should never break the main flow
    logger.warn(`Failed to record metrics: ${(err as Error).message}`);
  }
}
