import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import chalk from 'chalk';
import { loadConfig } from '../../core/config-loader.js';
import { buildContext } from '../../core/context.js';
import { isGitRepo, getGitRoot, getStagedDiff, getAllTrackedFiles } from '../../utils/git.js';
import { parseDiff, detectLanguage } from '../../core/diff-parser.js';
import { buildDependencyGraph, getImpactedFiles } from '../../core/dependency-graph.js';
import { generateImpactDiagram, generateArchitectureDiagram } from '../../core/mermaid.js';
import { ExitCode, type FileInfo } from '../../core/types.js';

export interface SummarizeOptions {
  format?: 'mermaid' | 'text';
  postToPr?: boolean;
}

export interface DiagramOptions {
  format?: 'mermaid' | 'text';
  scope?: string;
}

export async function summarizeCommand(options: SummarizeOptions = {}): Promise<number> {
  const format = options.format ?? 'mermaid';
  const cwd = process.cwd();

  if (!await isGitRepo(cwd)) {
    console.error(chalk.red('Not a git repository.'));
    return ExitCode.ConfigError;
  }

  const projectRoot = await getGitRoot(cwd);
  const config = await loadConfig(projectRoot);

  // Get staged changes
  const diffText = await getStagedDiff(projectRoot);
  if (!diffText.trim()) {
    console.log(chalk.gray('No staged changes to summarize.'));
    return ExitCode.Success;
  }

  const changedFileInfos = parseDiff(diffText);
  if (changedFileInfos.length === 0) {
    console.log(chalk.gray('No analyzable files in staged changes.'));
    return ExitCode.Success;
  }

  // Build full project context for dependency graph
  const allFiles = await getAllTrackedFiles(projectRoot);
  const allFileInfos: FileInfo[] = [];
  for (const filePath of allFiles) {
    const language = detectLanguage(filePath);
    if (!language) continue;
    try {
      const content = await readFile(join(projectRoot, filePath), 'utf-8');
      const lines = content.split('\n');
      allFileInfos.push({
        path: filePath,
        language,
        status: 'added',
        hunks: [],
        addedLines: lines.map((line, i) => ({ lineNumber: i + 1, content: line, type: 'added' as const })),
        removedLines: [],
        content,
      });
    } catch {
      // skip
    }
  }

  const context = await buildContext(allFileInfos, config, projectRoot);
  const graph = buildDependencyGraph(context.parsedFiles, projectRoot);
  const changedPaths = changedFileInfos.map(f => f.path);

  const diagram = generateImpactDiagram(changedPaths, graph, 2);

  if (format === 'mermaid') {
    console.log('```mermaid');
    console.log(diagram);
    console.log('```');
  } else {
    const impacted = getImpactedFiles(graph, changedPaths, 2);
    console.log(chalk.bold('\n  Change Impact Summary\n'));
    for (const [file, consumers] of impacted) {
      console.log(`  ${chalk.yellow(file)} impacts:`);
      for (const c of consumers) {
        console.log(`    → ${c}`);
      }
    }
    if (impacted.size === 0) {
      console.log(chalk.gray('  No downstream impact detected.'));
    }
    console.log('');
  }

  // Post to PR if requested
  if (options.postToPr) {
    const { postPrSummary, parsePrContext } = await import('../../ci/github-pr-commenter.js');
    const prContext = parsePrContext();
    if (prContext) {
      const { runPipeline } = await import('../../core/pipeline.js');
      const { createAnalyzers } = await import('../analyzer-factory.js');
      const analyzers = await createAnalyzers(config);
      const summary = await runPipeline(context, analyzers);
      await postPrSummary(summary, prContext, { diagram });
    }
  }

  return ExitCode.Success;
}

export async function diagramCommand(options: DiagramOptions = {}): Promise<number> {
  const format = options.format ?? 'mermaid';
  const cwd = process.cwd();

  if (!await isGitRepo(cwd)) {
    console.error(chalk.red('Not a git repository.'));
    return ExitCode.ConfigError;
  }

  const projectRoot = await getGitRoot(cwd);
  const config = await loadConfig(projectRoot);

  // Build full project context
  const allFiles = await getAllTrackedFiles(projectRoot);
  const allFileInfos: FileInfo[] = [];
  for (const filePath of allFiles) {
    const language = detectLanguage(filePath);
    if (!language) continue;
    try {
      const content = await readFile(join(projectRoot, filePath), 'utf-8');
      const lines = content.split('\n');
      allFileInfos.push({
        path: filePath,
        language,
        status: 'added',
        hunks: [],
        addedLines: lines.map((line, i) => ({ lineNumber: i + 1, content: line, type: 'added' as const })),
        removedLines: [],
        content,
      });
    } catch {
      // skip
    }
  }

  const context = await buildContext(allFileInfos, config, projectRoot);
  const graph = buildDependencyGraph(context.parsedFiles, projectRoot);

  if (format === 'mermaid') {
    const diagram = generateArchitectureDiagram(graph, options.scope);
    console.log('```mermaid');
    console.log(diagram);
    console.log('```');
  } else {
    console.log(chalk.bold('\n  Architecture Dependencies\n'));
    for (const [path, node] of graph.nodes) {
      if (options.scope && !path.includes(options.scope)) continue;
      if (node.imports.length === 0 && node.importedBy.length === 0) continue;
      console.log(`  ${chalk.cyan(path)}`);
      if (node.imports.length > 0) {
        console.log(`    imports: ${node.imports.join(', ')}`);
      }
      if (node.importedBy.length > 0) {
        console.log(`    used by: ${node.importedBy.join(', ')}`);
      }
    }
    console.log('');
  }

  return ExitCode.Success;
}
