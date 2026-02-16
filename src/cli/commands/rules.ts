import chalk from 'chalk';
import { loadConfig } from '../../core/config-loader.js';
import { isGitRepo, getGitRoot } from '../../utils/git.js';
import { Severity, ExitCode } from '../../core/types.js';
import type { ArchGuardConfig } from '../../core/types.js';

export interface RuleEntry {
  ruleId: string;
  analyzer: string;
  severity: string;
  enabled: boolean;
}

export interface RulesOptions {
  json?: boolean;
}

const BUILT_IN_RULES: Array<{ ruleId: string; analyzer: string; defaultSeverity: Severity; configKey: keyof ArchGuardConfig['analyzers'] }> = [
  // Security rules
  { ruleId: 'security/hardcoded-secret', analyzer: 'security', defaultSeverity: Severity.Error, configKey: 'security' },
  { ruleId: 'security/sql-injection', analyzer: 'security', defaultSeverity: Severity.Error, configKey: 'security' },
  { ruleId: 'security/xss', analyzer: 'security', defaultSeverity: Severity.Error, configKey: 'security' },
  { ruleId: 'security/eval', analyzer: 'security', defaultSeverity: Severity.Error, configKey: 'security' },
  { ruleId: 'security/unsafe-regex', analyzer: 'security', defaultSeverity: Severity.Error, configKey: 'security' },

  // AI smell rules
  { ruleId: 'ai-smell/excessive-comments', analyzer: 'ai-smells', defaultSeverity: Severity.Warning, configKey: 'aiSmells' },
  { ruleId: 'ai-smell/unused-import', analyzer: 'ai-smells', defaultSeverity: Severity.Warning, configKey: 'aiSmells' },
  { ruleId: 'ai-smell/verbose-error-handling', analyzer: 'ai-smells', defaultSeverity: Severity.Warning, configKey: 'aiSmells' },
  { ruleId: 'ai-smell/copy-paste', analyzer: 'ai-smells', defaultSeverity: Severity.Warning, configKey: 'aiSmells' },
  { ruleId: 'ai-smell/unnecessary-type-assertion', analyzer: 'ai-smells', defaultSeverity: Severity.Warning, configKey: 'aiSmells' },
  { ruleId: 'ai-smell/excessive-non-null-assertions', analyzer: 'ai-smells', defaultSeverity: Severity.Warning, configKey: 'aiSmells' },

  // Convention rules
  { ruleId: 'convention/function-naming', analyzer: 'conventions', defaultSeverity: Severity.Warning, configKey: 'conventions' },
  { ruleId: 'convention/class-naming', analyzer: 'conventions', defaultSeverity: Severity.Warning, configKey: 'conventions' },
  { ruleId: 'convention/constant-naming', analyzer: 'conventions', defaultSeverity: Severity.Warning, configKey: 'conventions' },
  { ruleId: 'convention/file-naming', analyzer: 'conventions', defaultSeverity: Severity.Warning, configKey: 'conventions' },

  // Duplicate rules
  { ruleId: 'duplicate/structural-clone', analyzer: 'duplicates', defaultSeverity: Severity.Warning, configKey: 'duplicates' },
  { ruleId: 'duplicate/similar-block', analyzer: 'duplicates', defaultSeverity: Severity.Warning, configKey: 'duplicates' },

  // Architecture rules
  { ruleId: 'architecture/layer-violation', analyzer: 'architecture', defaultSeverity: Severity.Error, configKey: 'architecture' },
];

function resolveRules(config: ArchGuardConfig): RuleEntry[] {
  return BUILT_IN_RULES.map((rule) => {
    const analyzerConfig = config.analyzers[rule.configKey];
    return {
      ruleId: rule.ruleId,
      analyzer: rule.analyzer,
      severity: analyzerConfig.severity ?? rule.defaultSeverity,
      enabled: analyzerConfig.enabled,
    };
  });
}

function formatRulesTable(rules: RuleEntry[]): string {
  const lines: string[] = [];
  const divider = chalk.gray('─'.repeat(72));

  lines.push('');
  lines.push(chalk.bold(' Architecture Guardian — Rules'));
  lines.push(divider);

  // Table header
  const header = `  ${pad('Rule ID', 44)} ${pad('Analyzer', 14)} ${pad('Severity', 10)} ${pad('Enabled', 7)}`;
  lines.push(chalk.bold(header));
  lines.push(divider);

  for (const rule of rules) {
    const enabledStr = rule.enabled
      ? chalk.green('yes')
      : chalk.gray('no');

    lines.push(`  ${pad(rule.ruleId, 44)} ${pad(rule.analyzer, 14)} ${pad(rule.severity, 10)} ${enabledStr}`);
  }

  lines.push(divider);
  const enabledCount = rules.filter(r => r.enabled).length;
  lines.push(`  ${enabledCount} of ${rules.length} rules enabled`);
  lines.push('');

  return lines.join('\n');
}

function pad(str: string, len: number): string {
  return str.padEnd(len);
}

export async function rulesCommand(options: RulesOptions = {}): Promise<number> {
  const cwd = process.cwd();

  let config;
  if (await isGitRepo(cwd)) {
    const projectRoot = await getGitRoot(cwd);
    try {
      config = await loadConfig(projectRoot);
    } catch (err) {
      console.error(chalk.red((err as Error).message));
      return ExitCode.ConfigError;
    }
  } else {
    // Use default config when not in a git repo
    const { DEFAULT_CONFIG } = await import('../../core/config-loader.js');
    config = DEFAULT_CONFIG;
  }

  const rules = resolveRules(config);

  if (options.json) {
    console.log(JSON.stringify(rules, null, 2));
  } else {
    console.log(formatRulesTable(rules));
  }

  return ExitCode.Success;
}
