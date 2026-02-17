import { Command } from 'commander';
import { initCommand } from './commands/init.js';
import { checkCommand } from './commands/check.js';
import { scanCommand } from './commands/scan.js';
import { learnCommand } from './commands/learn.js';
import { rulesCommand } from './commands/rules.js';
import { metricsCommand } from './commands/metrics.js';
import { dashboardCommand } from './commands/dashboard.js';
import { fixCommand } from './commands/fix.js';
import { dismissCommand } from './commands/dismiss.js';
import { setLogLevel, LogLevel } from '../utils/logger.js';

const program = new Command();

program
  .name('archguardian')
  .description('Stop AI from slowly destroying your codebase.')
  .version('1.0.0')
  .option('--verbose', 'Enable debug logging')
  .hook('preAction', (thisCommand) => {
    if (thisCommand.opts().verbose) {
      setLogLevel(LogLevel.Debug);
    }
  });

program
  .command('init')
  .description('Initialize archguardian: create config + install git hook')
  .option('--force', 'Overwrite existing config')
  .action(async (options) => {
    const code = await initCommand(options);
    process.exitCode = code;
  });

program
  .command('check')
  .description('Analyze staged changes (pre-commit mode)')
  .option('--format <format>', 'Output format (terminal, json, or sarif)', 'terminal')
  .option('--update-baseline', 'Save current findings as the baseline')
  .option('--baseline <path>', 'Custom baseline file path')
  .option('--quality-gate', 'Enforce quality gate thresholds')
  .option('--ci <provider>', 'CI mode (github)')
  .option('--post-to-pr', 'Post findings as PR review comments')
  .action(async (options) => {
    const code = await checkCommand({
      format: options.format,
      updateBaseline: options.updateBaseline,
      baseline: options.baseline,
      qualityGate: options.qualityGate,
      ci: options.ci,
      postToPr: options.postToPr,
    });
    process.exitCode = code;
  });

program
  .command('scan')
  .description('Analyze the full project')
  .option('--format <format>', 'Output format (terminal, json, or sarif)', 'terminal')
  .option('--update-baseline', 'Save current findings as the baseline')
  .option('--baseline <path>', 'Custom baseline file path')
  .option('--quality-gate', 'Enforce quality gate thresholds')
  .option('--ci <provider>', 'CI mode (github)')
  .option('--post-to-pr', 'Post findings as PR review comments')
  .action(async (options) => {
    const code = await scanCommand({
      format: options.format,
      updateBaseline: options.updateBaseline,
      baseline: options.baseline,
      qualityGate: options.qualityGate,
      ci: options.ci,
      postToPr: options.postToPr,
    });
    process.exitCode = code;
  });

program
  .command('learn')
  .description('Scan codebase and infer naming conventions statistically')
  .option('--apply', 'Write inferred conventions to .archguard.yml')
  .action(async (options) => {
    const code = await learnCommand(options);
    process.exitCode = code;
  });

program
  .command('rules')
  .description('List all available rules and their status')
  .option('--json', 'Output rules as JSON')
  .action(async (options) => {
    const code = await rulesCommand({ json: options.json });
    process.exitCode = code;
  });

program
  .command('metrics')
  .description('Show metrics from recent scan/check runs')
  .option('--json', 'Output metrics as JSON')
  .action(async (options) => {
    const code = await metricsCommand({ json: options.json });
    process.exitCode = code;
  });

program
  .command('dashboard')
  .description('Open web dashboard for metrics')
  .option('--port <port>', 'Port number', '3000')
  .action(async (options) => {
    const code = await dashboardCommand({ port: Number(options.port) });
    process.exitCode = code;
  });

program
  .command('fix')
  .description('Auto-fix simple findings')
  .option('--dry-run', 'Preview changes without applying')
  .option('--format <format>', 'Output format', 'terminal')
  .option('--ai', 'Enable AI-powered fixes via LLM')
  .option('--verify', 'Re-analyze after fix to verify')
  .action(async (options) => {
    const code = await fixCommand({ dryRun: options.dryRun, format: options.format, ai: options.ai, verify: options.verify });
    process.exitCode = code;
  });

program
  .command('dismiss <ruleId>')
  .description('Dismiss a finding pattern from future scans')
  .option('--pattern <msg>', 'Message pattern to dismiss')
  .option('--file <glob>', 'File glob pattern to dismiss')
  .action(async (ruleId, options) => {
    const code = await dismissCommand(ruleId, { pattern: options.pattern, file: options.file });
    process.exitCode = code;
  });

program
  .command('summarize')
  .description('Generate visual change summary with impact diagram')
  .option('--format <format>', 'Output format (mermaid or text)', 'mermaid')
  .option('--post-to-pr', 'Post summary as PR comment')
  .action(async (options) => {
    const { summarizeCommand } = await import('./commands/summarize.js');
    const code = await summarizeCommand({ format: options.format, postToPr: options.postToPr });
    process.exitCode = code;
  });

program
  .command('diagram')
  .description('Generate architecture diagram')
  .option('--format <format>', 'Output format (mermaid or text)', 'mermaid')
  .option('--scope <glob>', 'Limit to files matching glob')
  .action(async (options) => {
    const { diagramCommand } = await import('./commands/summarize.js');
    const code = await diagramCommand({ format: options.format, scope: options.scope });
    process.exitCode = code;
  });

program
  .command('sbom')
  .description('Generate Software Bill of Materials')
  .option('--format <format>', 'Output format (cyclonedx or spdx)', 'cyclonedx')
  .action(async (options) => {
    const { sbomCommand } = await import('./commands/sbom.js');
    const code = await sbomCommand({ format: options.format });
    process.exitCode = code;
  });

program.parse();
