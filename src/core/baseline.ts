import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import type { Finding, AnalysisSummary } from './types.js';
import { logger } from '../utils/logger.js';

const DEFAULT_BASELINE_FILENAME = '.archguard-baseline.json';

export interface BaselineEntry {
  ruleId: string;
  file: string;
  message: string;
  contentHash?: string;
}

export interface BaselineFile {
  version: number;
  generatedAt: string;
  generatedBy: string;
  findings: BaselineEntry[];
}

export function contentFingerprint(ruleId: string, file: string, codeSnippet?: string): string {
  const normalized = (codeSnippet ?? '').replace(/\s+/g, ' ').trim();
  return createHash('sha256').update(`${ruleId}\0${file}\0${normalized}`).digest('hex');
}

function fingerprint(f: { ruleId: string; file: string; message: string }): string {
  return `${f.ruleId}\0${f.file}\0${f.message}`;
}

export async function saveBaseline(
  projectRoot: string,
  findings: Finding[],
  command: string,
  path?: string,
): Promise<string> {
  const filePath = path ? join(projectRoot, path) : join(projectRoot, DEFAULT_BASELINE_FILENAME);

  const baseline: BaselineFile = {
    version: 1,
    generatedAt: new Date().toISOString(),
    generatedBy: command,
    findings: findings.map(f => ({
      ruleId: f.ruleId,
      file: f.file,
      message: f.message,
      contentHash: contentFingerprint(f.ruleId, f.file, f.codeSnippet),
    })),
  };

  await writeFile(filePath, JSON.stringify(baseline, null, 2) + '\n', 'utf-8');
  logger.debug(`Baseline saved to ${filePath} with ${findings.length} findings`);
  return filePath;
}

export async function loadBaseline(
  projectRoot: string,
  path?: string,
): Promise<BaselineFile | null> {
  const filePath = path ? join(projectRoot, path) : join(projectRoot, DEFAULT_BASELINE_FILENAME);

  try {
    const content = await readFile(filePath, 'utf-8');
    const data = JSON.parse(content) as BaselineFile;

    if (data.version !== 1) {
      logger.warn(`Unsupported baseline version: ${data.version}`);
      return null;
    }

    return data;
  } catch {
    return null;
  }
}

export function filterByBaseline(
  findings: Finding[],
  baseline: BaselineFile,
): { findings: Finding[]; baselineSuppressedCount: number } {
  const baselineMessageSet = new Set(baseline.findings.map(fingerprint));
  const baselineHashSet = new Set(
    baseline.findings
      .filter(b => b.contentHash)
      .map(b => b.contentHash!),
  );

  let baselineSuppressedCount = 0;
  const filtered = findings.filter(f => {
    // Try content hash match first (more robust across line changes)
    if (baselineHashSet.size > 0) {
      const hash = contentFingerprint(f.ruleId, f.file, f.codeSnippet);
      if (baselineHashSet.has(hash)) {
        baselineSuppressedCount++;
        return false;
      }
    }
    // Fall back to message-based match
    const fp = fingerprint({ ruleId: f.ruleId, file: f.file, message: f.message });
    if (baselineMessageSet.has(fp)) {
      baselineSuppressedCount++;
      return false;
    }
    return true;
  });

  return { findings: filtered, baselineSuppressedCount };
}

export interface HandleBaselineResult {
  saved: boolean;
  savedPath?: string;
  suppressedCount: number;
}

export async function handleBaseline(
  summary: AnalysisSummary,
  projectRoot: string,
  command: string,
  options: { updateBaseline?: boolean; baseline?: string },
): Promise<HandleBaselineResult> {
  // Collect all findings from analyzer results
  const allFindings = summary.analyzerResults.flatMap(r => r.findings);

  if (options.updateBaseline) {
    const savedPath = await saveBaseline(projectRoot, allFindings, command, options.baseline);
    return { saved: true, savedPath, suppressedCount: 0 };
  }

  // Try to load and apply baseline
  const baselineData = await loadBaseline(projectRoot, options.baseline);
  if (!baselineData) {
    return { saved: false, suppressedCount: 0 };
  }

  const { findings: filtered, baselineSuppressedCount } = filterByBaseline(allFindings, baselineData);

  // Update the summary in-place
  summary.baselineSuppressedCount = baselineSuppressedCount || undefined;
  summary.totalFindings = filtered.length;
  summary.errors = filtered.filter(f => f.severity === 'error').length;
  summary.warnings = filtered.filter(f => f.severity === 'warning').length;
  summary.infos = filtered.filter(f => f.severity === 'info').length;

  // Update analyzer results to only contain non-baseline findings
  for (const result of summary.analyzerResults) {
    result.findings = result.findings.filter(f => {
      const fp = fingerprint({ ruleId: f.ruleId, file: f.file, message: f.message });
      const baselineSet = new Set(baselineData.findings.map(fingerprint));
      return !baselineSet.has(fp);
    });
  }

  return { saved: false, suppressedCount: baselineSuppressedCount };
}
