import chalk from 'chalk';
import { loadConfig } from '../../core/config-loader.js';
import { parseDiff } from '../../core/diff-parser.js';
import { buildContext } from '../../core/context.js';
import { runPipeline } from '../../core/pipeline.js';
import { getExitCode } from '../../core/severity.js';
import { getStagedDiff } from '../../utils/git.js';
import { isGitRepo, getGitRoot } from '../../utils/git.js';
import { formatSummary } from '../output/terminal.js';
import { formatJson } from '../output/json.js';
import { formatSarif } from '../output/sarif.js';
import { createAnalyzers } from '../analyzer-factory.js';
import { ExitCode } from '../../core/types.js';
import { recordMetrics } from '../../metrics/tracker.js';

export interface CheckOptions {
  format?: 'terminal' | 'json' | 'sarif';
}

export async function checkCommand(options: CheckOptions = {}): Promise<number> {
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

  // Get staged diff
  const diffText = await getStagedDiff(projectRoot);
  if (!diffText.trim()) {
    console.log(chalk.gray('  No staged changes to check.'));
    return ExitCode.Success;
  }

  // Parse diff
  const files = parseDiff(diffText);
  if (files.length === 0) {
    console.log(chalk.gray('  No analyzable files in staged changes.'));
    return ExitCode.Success;
  }

  // Build context with ASTs
  const context = await buildContext(files, config, projectRoot);

  // Run pipeline
  const analyzers = await createAnalyzers(config);
  const summary = await runPipeline(context, analyzers);

  // Record metrics
  await recordMetrics(projectRoot, summary, 'check');

  // Determine exit code
  const exitCode = getExitCode(summary, config.severity);

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
