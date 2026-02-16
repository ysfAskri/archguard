import chalk from 'chalk';
import { isGitRepo, getGitRoot } from '../../utils/git.js';
import { readMetrics } from '../../metrics/tracker.js';
import { ExitCode } from '../../core/types.js';
import type { MetricsEntry } from '../../metrics/tracker.js';

export interface MetricsOptions {
  json?: boolean;
}

/**
 * Determine trend direction from a list of metrics entries.
 * Compares the average findings of the first half to the second half.
 */
function computeTrend(entries: MetricsEntry[]): 'increasing' | 'decreasing' | 'stable' {
  if (entries.length < 2) {
    return 'stable';
  }

  const mid = Math.floor(entries.length / 2);
  const firstHalf = entries.slice(0, mid);
  const secondHalf = entries.slice(mid);

  const avgFirst = firstHalf.reduce((sum, e) => sum + e.totalFindings, 0) / firstHalf.length;
  const avgSecond = secondHalf.reduce((sum, e) => sum + e.totalFindings, 0) / secondHalf.length;

  const diff = avgSecond - avgFirst;
  // Use a threshold of 0.5 to avoid noise
  if (diff > 0.5) return 'increasing';
  if (diff < -0.5) return 'decreasing';
  return 'stable';
}

function formatTrend(trend: 'increasing' | 'decreasing' | 'stable'): string {
  switch (trend) {
    case 'increasing':
      return chalk.red('^ increasing');
    case 'decreasing':
      return chalk.green('v decreasing');
    case 'stable':
      return chalk.gray('= stable');
  }
}

function pad(str: string, len: number): string {
  return str.padEnd(len);
}

function formatMetricsTable(entries: MetricsEntry[], trend: string): string {
  const lines: string[] = [];
  const divider = chalk.gray('─'.repeat(90));

  lines.push('');
  lines.push(chalk.bold(' Architecture Guardian — Metrics'));
  lines.push(divider);

  // Table header
  const header = `  ${pad('Timestamp', 26)} ${pad('Command', 8)} ${pad('Files', 7)} ${pad('Findings', 10)} ${pad('Errors', 8)} ${pad('Warnings', 10)} ${pad('Duration', 10)}`;
  lines.push(chalk.bold(header));
  lines.push(divider);

  for (const entry of entries) {
    const ts = entry.timestamp.replace('T', ' ').replace(/\.\d+Z$/, 'Z').substring(0, 19);
    const findingsStr = entry.totalFindings > 0
      ? chalk.yellow(String(entry.totalFindings))
      : chalk.green(String(entry.totalFindings));
    const errorsStr = entry.errors > 0
      ? chalk.red(String(entry.errors))
      : String(entry.errors);
    const warningsStr = entry.warnings > 0
      ? chalk.yellow(String(entry.warnings))
      : String(entry.warnings);

    lines.push(
      `  ${pad(ts, 26)} ${pad(entry.command, 8)} ${pad(String(entry.totalFiles), 7)} ${pad(String(entry.totalFindings), 10)} ${pad(String(entry.errors), 8)} ${pad(String(entry.warnings), 10)} ${pad(entry.duration + 'ms', 10)}`
    );
  }

  lines.push(divider);
  lines.push(`  Trend: ${trend}`);
  lines.push('');

  return lines.join('\n');
}

export async function metricsCommand(options: MetricsOptions = {}): Promise<number> {
  const cwd = process.cwd();

  if (!await isGitRepo(cwd)) {
    console.error(chalk.red('Not a git repository.'));
    return ExitCode.ConfigError;
  }

  const projectRoot = await getGitRoot(cwd);
  const allEntries = await readMetrics(projectRoot);

  if (allEntries.length === 0) {
    console.log(chalk.gray('  No metrics recorded yet. Run a scan or check first.'));
    return ExitCode.Success;
  }

  const trend = computeTrend(allEntries);

  if (options.json) {
    const output = {
      entries: allEntries.slice(-10),
      totalRuns: allEntries.length,
      trend,
    };
    console.log(JSON.stringify(output, null, 2));
  } else {
    // Show last 10 runs
    const recentEntries = allEntries.slice(-10);
    console.log(formatMetricsTable(recentEntries, formatTrend(trend)));
  }

  return ExitCode.Success;
}
