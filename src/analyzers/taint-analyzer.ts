import type { AnalysisContext, Finding, ParsedFile } from '../core/types.js';
import { Severity } from '../core/types.js';
import { BaseAnalyzer } from './base-analyzer.js';
import { walk } from '../parsers/ast-utils.js';
import { buildDependencyGraph, type DependencyGraph } from '../core/dependency-graph.js';
import { collectExports } from '../parsers/language-imports.js';
import type { SgNode } from '@ast-grep/napi';

// Taint sources: user input that could be malicious
const TAINT_SOURCES = new Set([
  'req.params', 'req.body', 'req.query', 'req.headers',
  'process.argv', 'process.env',
  'URLSearchParams', 'location.search', 'location.hash',
  'document.cookie', 'window.location',
]);

// Taint sinks: dangerous functions that should not receive untrusted input
interface SinkDefinition {
  pattern: string;
  ruleId: string;
  message: string;
}

const TAINT_SINKS: SinkDefinition[] = [
  { pattern: 'eval', ruleId: 'taint/command-injection', message: 'Tainted data flows to eval()' },
  { pattern: 'Function', ruleId: 'taint/command-injection', message: 'Tainted data flows to Function constructor' },
  { pattern: 'exec', ruleId: 'taint/command-injection', message: 'Tainted data flows to exec()' },
  { pattern: 'execSync', ruleId: 'taint/command-injection', message: 'Tainted data flows to execSync()' },
  { pattern: 'spawn', ruleId: 'taint/command-injection', message: 'Tainted data flows to spawn()' },
  { pattern: 'innerHTML', ruleId: 'taint/xss', message: 'Tainted data assigned to innerHTML' },
  { pattern: 'outerHTML', ruleId: 'taint/xss', message: 'Tainted data assigned to outerHTML' },
  { pattern: 'document.write', ruleId: 'taint/xss', message: 'Tainted data flows to document.write()' },
  { pattern: 'query', ruleId: 'taint/sql-injection', message: 'Tainted data flows to query()' },
  { pattern: 'writeFile', ruleId: 'taint/path-traversal', message: 'Tainted data used in file path' },
  { pattern: 'readFile', ruleId: 'taint/path-traversal', message: 'Tainted data used in file path' },
  { pattern: 'createReadStream', ruleId: 'taint/path-traversal', message: 'Tainted data used in file path' },
  { pattern: 'createWriteStream', ruleId: 'taint/path-traversal', message: 'Tainted data used in file path' },
  { pattern: 'unlink', ruleId: 'taint/path-traversal', message: 'Tainted data used in file path' },
];

// Known sanitizers
const SANITIZERS = new Set([
  'escape', 'sanitize', 'encode', 'encodeURIComponent', 'encodeURI',
  'parseInt', 'parseFloat', 'Number', 'String',
  'validator', 'DOMPurify', 'xss',
]);

export class TaintAnalyzer extends BaseAnalyzer {
  name = 'taint';

  protected defaultSeverity(): Severity {
    return Severity.Error;
  }

  async analyze(context: AnalysisContext): Promise<Finding[]> {
    const findings: Finding[] = [];
    const taintConfig = context.config.analyzers.taint;
    if (!taintConfig?.enabled) return findings;

    for (const file of context.parsedFiles) {
      // Taint analysis is most relevant for JS/TS
      if (file.language !== 'typescript' && file.language !== 'javascript' &&
          file.language !== 'tsx' && file.language !== 'jsx') {
        continue;
      }

      const changedLines = this.getChangedLines(context, file.path);
      findings.push(...this.trackTaintFlows(file, changedLines, taintConfig.severity));
    }

    // Cross-file taint analysis (opt-in, more expensive)
    if (taintConfig.crossFile) {
      findings.push(...this.analyzeInterProcedural(context, taintConfig.severity));
    }

    return findings;
  }

  private trackTaintFlows(file: ParsedFile, changedLines: Set<number>, severity: Severity): Finding[] {
    const findings: Finding[] = [];
    const taintedVars = new Map<string, number>(); // variable name → line where tainted

    walk(file.tree.root(), (node) => {
      const lineNum = node.range().start.line + 1;

      // Track assignments from taint sources
      if (node.kind() === 'variable_declarator' || node.kind() === 'assignment_expression') {
        const nameNode = node.kind() === 'variable_declarator' ? node.field('name') : node.field('left');
        const valueNode = node.kind() === 'variable_declarator' ? node.field('value') : node.field('right');

        if (nameNode && valueNode) {
          const valueText = valueNode.text();
          const varName = nameNode.text();

          // Check if value comes from a taint source
          if (this.isTaintSource(valueText) || this.containsTaintedVar(valueText, taintedVars)) {
            // Check if it's been sanitized
            if (!this.isSanitized(valueText)) {
              taintedVars.set(varName, lineNum);
            }
          }
        }
      }

      // Check if tainted vars flow to sinks
      if (node.kind() === 'call_expression') {
        const funcText = node.field('function')?.text() ?? '';
        const argsNode = node.field('arguments');

        for (const sink of TAINT_SINKS) {
          if (funcText.includes(sink.pattern)) {
            if (argsNode) {
              const argsText = argsNode.text();
              if (this.containsTaintedVar(argsText, taintedVars) || this.isTaintSource(argsText)) {
                if (!this.isSanitized(argsText) && changedLines.has(lineNum)) {
                  findings.push(this.createFinding(
                    sink.ruleId,
                    file.path,
                    lineNum,
                    sink.message,
                    { severity, codeSnippet: node.text().substring(0, 100) },
                  ));
                }
              }
            }
          }
        }
      }

      // Check assignment to innerHTML/outerHTML
      if (node.kind() === 'assignment_expression') {
        const left = node.field('left')?.text() ?? '';
        const right = node.field('right')?.text() ?? '';
        if ((left.endsWith('.innerHTML') || left.endsWith('.outerHTML')) && changedLines.has(lineNum)) {
          if (this.containsTaintedVar(right, taintedVars) || this.isTaintSource(right)) {
            if (!this.isSanitized(right)) {
              findings.push(this.createFinding(
                'taint/xss',
                file.path,
                lineNum,
                'Tainted data assigned to innerHTML/outerHTML',
                { severity, codeSnippet: node.text().substring(0, 100) },
              ));
            }
          }
        }
      }
    });

    return findings;
  }

  /**
   * Cross-file taint analysis: builds function summaries for exported functions,
   * then checks if tainted args at call sites map to sink-reaching params.
   */
  private analyzeInterProcedural(context: AnalysisContext, severity: Severity): Finding[] {
    const findings: Finding[] = [];
    const graph = buildDependencyGraph(context.parsedFiles, context.projectRoot);

    // Pass 1: Build function summaries for exported functions
    // Maps: filePath → Map<functionName, Set<paramIndex that reaches a sink>>
    const functionSummaries = new Map<string, Map<string, Set<number>>>();

    for (const file of context.parsedFiles) {
      if (file.language !== 'typescript' && file.language !== 'javascript' &&
          file.language !== 'tsx' && file.language !== 'jsx') {
        continue;
      }

      const exports = collectExports(file.tree, file.language);
      if (exports.length === 0) continue;

      const fileSummaries = new Map<string, Set<number>>();

      walk(file.tree.root(), (node) => {
        if (node.kind() === 'function_declaration' || node.kind() === 'method_definition') {
          const nameNode = node.field('name');
          if (!nameNode) return;
          const funcName = nameNode.text();

          // Only summarize exported functions
          if (!exports.includes(funcName)) return;

          const params = this.extractParams(node);
          const sinkReachingParams = new Set<number>();

          // Check if any param flows to a sink
          walk(node, (inner) => {
            if (inner.kind() === 'call_expression') {
              const funcText = inner.field('function')?.text() ?? '';
              const argsText = inner.field('arguments')?.text() ?? '';

              for (const sink of TAINT_SINKS) {
                if (funcText.includes(sink.pattern)) {
                  // Check which params appear in the args
                  for (let i = 0; i < params.length; i++) {
                    if (argsText.includes(params[i])) {
                      sinkReachingParams.add(i);
                    }
                  }
                }
              }
            }
          });

          if (sinkReachingParams.size > 0) {
            fileSummaries.set(funcName, sinkReachingParams);
          }
        }
      });

      if (fileSummaries.size > 0) {
        functionSummaries.set(file.path, fileSummaries);
      }
    }

    // Pass 2: At call sites, check if tainted args map to sink-reaching params
    for (const file of context.parsedFiles) {
      if (file.language !== 'typescript' && file.language !== 'javascript' &&
          file.language !== 'tsx' && file.language !== 'jsx') {
        continue;
      }

      const changedLines = this.getChangedLines(context, file.path);
      const taintedVars = new Map<string, number>();

      // Collect tainted variables in this file
      walk(file.tree.root(), (node) => {
        if (node.kind() === 'variable_declarator' || node.kind() === 'assignment_expression') {
          const nameNode = node.kind() === 'variable_declarator' ? node.field('name') : node.field('left');
          const valueNode = node.kind() === 'variable_declarator' ? node.field('value') : node.field('right');
          if (nameNode && valueNode) {
            const valueText = valueNode.text();
            if (this.isTaintSource(valueText) && !this.isSanitized(valueText)) {
              taintedVars.set(nameNode.text(), node.range().start.line + 1);
            }
          }
        }
      });

      if (taintedVars.size === 0) continue;

      // Find call sites to imported functions with summaries
      const graphNode = graph.nodes.get(file.path);
      if (!graphNode) continue;

      walk(file.tree.root(), (node) => {
        if (node.kind() !== 'call_expression') return;
        const lineNum = node.range().start.line + 1;
        if (changedLines.size > 0 && !changedLines.has(lineNum)) return;

        const funcName = node.field('function')?.text() ?? '';
        const argsNode = node.field('arguments');
        if (!argsNode) return;

        // Check against summaries from imported files
        for (const importedFile of graphNode.imports) {
          const summaries = functionSummaries.get(importedFile);
          if (!summaries) continue;

          const summary = summaries.get(funcName);
          if (!summary) continue;

          // Parse call arguments
          const args = argsNode.children().filter(c => c.kind() !== '(' && c.kind() !== ')' && c.kind() !== ',');
          for (const paramIndex of summary) {
            if (paramIndex < args.length) {
              const argText = args[paramIndex].text();
              if (this.containsTaintedVar(argText, taintedVars) || this.isTaintSource(argText)) {
                if (!this.isSanitized(argText)) {
                  findings.push(this.createFinding(
                    'taint/cross-file-flow',
                    file.path,
                    lineNum,
                    `Tainted data flows to '${funcName}()' (from ${importedFile}) via parameter ${paramIndex}`,
                    { severity, codeSnippet: node.text().substring(0, 100) },
                  ));
                }
              }
            }
          }
        }
      });
    }

    return findings;
  }

  private extractParams(fn: SgNode): string[] {
    const params: string[] = [];
    const paramsNode = fn.field('parameters');
    if (!paramsNode) return params;

    for (const child of paramsNode.children()) {
      if (child.kind() === 'required_parameter' || child.kind() === 'optional_parameter' || child.kind() === 'identifier') {
        const nameNode = child.field('pattern') ?? child.field('name') ?? child;
        if (nameNode.kind() === 'identifier') {
          params.push(nameNode.text());
        }
      }
    }
    return params;
  }

  private isTaintSource(text: string): boolean {
    for (const source of TAINT_SOURCES) {
      if (text.includes(source)) return true;
    }
    return false;
  }

  private containsTaintedVar(text: string, taintedVars: Map<string, number>): boolean {
    for (const [varName] of taintedVars) {
      if (text.includes(varName)) return true;
    }
    return false;
  }

  private isSanitized(text: string): boolean {
    for (const sanitizer of SANITIZERS) {
      if (text.includes(sanitizer)) return true;
    }
    return false;
  }
}
