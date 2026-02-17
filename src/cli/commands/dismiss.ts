import chalk from 'chalk';
import { ExitCode } from '../../core/types.js';
import { isGitRepo, getGitRoot } from '../../utils/git.js';
import { loadMemory, saveMemory, addMemoryEntry } from '../../core/memory.js';

export interface DismissOptions {
  pattern?: string;
  file?: string;
}

export async function dismissCommand(ruleId: string, options: DismissOptions = {}): Promise<number> {
  const cwd = process.cwd();

  if (!await isGitRepo(cwd)) {
    console.error(chalk.red('Not a git repository.'));
    return ExitCode.ConfigError;
  }

  const projectRoot = await getGitRoot(cwd);

  if (!options.pattern && !options.file) {
    console.error(chalk.red('Provide --pattern or --file to specify what to dismiss.'));
    return ExitCode.ConfigError;
  }

  const memory = await loadMemory(projectRoot);

  if (options.pattern) {
    addMemoryEntry(memory, ruleId, options.pattern, 'message');
    console.log(chalk.green(`  Dismissed ${ruleId} findings matching message pattern: "${options.pattern}"`));
  }

  if (options.file) {
    addMemoryEntry(memory, ruleId, options.file, 'file');
    console.log(chalk.green(`  Dismissed ${ruleId} findings in files matching: "${options.file}"`));
  }

  await saveMemory(projectRoot, memory);
  console.log(chalk.gray('  Memory updated. These findings will be suppressed in future runs.'));

  return ExitCode.Success;
}
