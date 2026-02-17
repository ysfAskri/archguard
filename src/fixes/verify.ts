import { readFile } from 'node:fs/promises';
import type { Finding, ArchGuardConfig } from '../core/types.js';
import { buildContext } from '../core/context.js';
import { runPipeline } from '../core/pipeline.js';
import { createAnalyzers } from '../cli/analyzer-factory.js';
import { detectLanguage } from '../core/diff-parser.js';

export interface VerifyResult {
  passed: boolean;
  findingStillPresent: boolean;
  newFindingsIntroduced: number;
}

export async function verifyFix(
  filePath: string,
  finding: Finding,
  config: ArchGuardConfig,
  projectRoot: string,
): Promise<VerifyResult> {
  try {
    const content = await readFile(filePath, 'utf-8');
    const language = detectLanguage(filePath);
    if (!language) {
      return { passed: false, findingStillPresent: true, newFindingsIntroduced: 0 };
    }

    const lines = content.split('\n');
    const addedLines = lines.map((line, i) => ({
      lineNumber: i + 1,
      content: line,
      type: 'added' as const,
    }));

    const fileInfo = {
      path: finding.file,
      language,
      status: 'added' as const,
      hunks: [],
      addedLines,
      removedLines: [],
      content,
    };

    const context = await buildContext([fileInfo], config, projectRoot);
    const analyzers = await createAnalyzers(config);
    const summary = await runPipeline(context, analyzers);

    const allFindings = summary.analyzerResults.flatMap(r => r.findings);

    // Check if the original finding is still present
    const findingStillPresent = allFindings.some(
      f => f.ruleId === finding.ruleId && f.file === finding.file && f.line === finding.line,
    );

    // Count new findings that weren't there before
    const newFindingsIntroduced = allFindings.filter(
      f => f.file === finding.file && f.ruleId !== finding.ruleId,
    ).length;

    return {
      passed: !findingStillPresent && newFindingsIntroduced === 0,
      findingStillPresent,
      newFindingsIntroduced,
    };
  } catch {
    return { passed: false, findingStillPresent: true, newFindingsIntroduced: 0 };
  }
}
