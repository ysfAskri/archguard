import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import chalk from 'chalk';
import { loadConfig } from '../../core/config-loader.js';
import { buildContext } from '../../core/context.js';
import { runPipeline } from '../../core/pipeline.js';
import { getExitCode } from '../../core/severity.js';
import { isGitRepo, getGitRoot, getAllTrackedFiles } from '../../utils/git.js';
import { formatSummary } from '../output/terminal.js';
import { formatJson } from '../output/json.js';
import { formatSarif } from '../output/sarif.js';
import { createAnalyzers } from '../analyzer-factory.js';
import { ExitCode, type FileInfo } from '../../core/types.js';
import { detectLanguage } from '../../core/diff-parser.js';
import { recordMetrics } from '../../metrics/tracker.js';
import { handleBaseline } from '../../core/baseline.js';
import { evaluateQualityGate } from '../../core/quality-gate.js';

export interface ScanOptions {
  format?: 'terminal' | 'json' | 'sarif';
  updateBaseline?: boolean;
  baseline?: string;
  qualityGate?: boolean;
  ci?: 'github';
  postToPr?: boolean;
}

export async function scanCommand(options: ScanOptions = {}): Promise<number> {
  const format = options.format ?? 'terminal';
  const cwd = process.cwd();

  if (!await isGitRepo(cwd)) {
    console.error(chalk.red('Not a git repository.'));
    return ExitCode.ConfigError;
  }

  const projectRoot = await getGitRoot(cwd);

  // Load config
  let config;
  try {
    config = await loadConfig(projectRoot);
  } catch (err) {
    console.error(chalk.red((err as Error).message));
    return ExitCode.ConfigError;
  }

  console.log(chalk.gray('  Scanning project...'));

  // Get all tracked files
  const allFiles = await getAllTrackedFiles(projectRoot);

  // Build FileInfo for each file (treating all lines as "added" for full scan)
  const files: FileInfo[] = [];
  for (const filePath of allFiles) {
    const language = detectLanguage(filePath);
    if (!language) continue;

    try {
      const content = await readFile(join(projectRoot, filePath), 'utf-8');
      const lines = content.split('\n');
      const addedLines = lines.map((line, i) => ({
        lineNumber: i + 1,
        content: line,
        type: 'added' as const,
      }));

      files.push({
        path: filePath,
        language,
        status: 'added',
        hunks: [],
        addedLines,
        removedLines: [],
        content,
      });
    } catch {
      // Skip unreadable files
    }
  }

  if (files.length === 0) {
    console.log(chalk.gray('  No analyzable files found.'));
    return ExitCode.Success;
  }

  console.log(chalk.gray(`  Found ${files.length} files to analyze...`));

  // Build context
  const context = await buildContext(files, config, projectRoot);

  // Run pipeline
  const analyzers = await createAnalyzers(config);
  const summary = await runPipeline(context, analyzers);

  // Handle baseline (save or filter)
  const baselineResult = await handleBaseline(summary, projectRoot, 'scan', {
    updateBaseline: options.updateBaseline,
    baseline: options.baseline,
  });
  if (baselineResult.saved) {
    console.log(chalk.green(`  Baseline saved to ${baselineResult.savedPath}`));
  }

  // Record metrics
  await recordMetrics(projectRoot, summary, 'scan');

  // Evaluate quality gate if enabled
  let gateExitCode: number | null = null;
  if (options.qualityGate && config.qualityGate) {
    const gateResult = evaluateQualityGate(summary, config.qualityGate);
    if (!gateResult.passed) {
      gateExitCode = ExitCode.QualityGateFailure;
      for (const failure of gateResult.failures) {
        console.log(chalk.red(`  Quality gate failed: ${failure.message}`));
      }
    }
  }

  // Determine exit code
  const exitCode = gateExitCode ?? getExitCode(summary, config.severity);

  // Post to PR if requested
  if (options.postToPr) {
    const { postPrReview, parsePrContext } = await import('../../ci/github-pr-commenter.js');
    const prContext = parsePrContext();
    if (prContext) {
      const allFindings = summary.analyzerResults.flatMap(r => r.findings);
      await postPrReview(allFindings, prContext);
    }
  }

  // Print CI annotations
  if (options.ci === 'github') {
    const { formatAnnotations } = await import('../../ci/github-annotator.js');
    const annotations = formatAnnotations(summary);
    if (annotations) process.stdout.write(annotations);
  }

  // Print results
  if (format === 'json') {
    console.log(formatJson(summary));
  } else if (format === 'sarif') {
    console.log(formatSarif(summary));
  } else {
    console.log(formatSummary(summary, exitCode));
  }

  return exitCode;
}
