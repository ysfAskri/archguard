import type { AnalysisContext, Finding } from '../core/types.js';
import { Severity } from '../core/types.js';
import { BaseAnalyzer } from './base-analyzer.js';
import { findNodes, walk } from '../parsers/ast-utils.js';
import { getLanguageConventions } from '../parsers/language-conventions.js';
import type { SgNode } from '@ast-grep/napi';

// Node types that increase cyclomatic complexity (branching)
const BRANCH_TYPES = new Set([
  'if_statement', 'else_clause',
  'for_statement', 'for_in_statement', 'while_statement', 'do_statement',
  'switch_case', 'catch_clause',
  'ternary_expression', 'conditional_expression',
]);

// Node types that increase nesting depth
const NESTING_TYPES = new Set([
  'if_statement', 'for_statement', 'for_in_statement', 'while_statement',
  'do_statement', 'switch_statement', 'catch_clause',
  'arrow_function', 'function_declaration', 'method_definition',
]);

// Logical operators that add cyclomatic paths
const LOGICAL_OPERATORS = new Set(['&&', '||', '??']);

export class ComplexityAnalyzer extends BaseAnalyzer {
  name = 'complexity';

  protected defaultSeverity(): Severity {
    return Severity.Warning;
  }

  async analyze(context: AnalysisContext): Promise<Finding[]> {
    const findings: Finding[] = [];
    const complexityConfig = context.config.analyzers.complexity;
    if (!complexityConfig?.enabled) return findings;

    const maxCyclomatic = complexityConfig.maxCyclomatic;
    const maxCognitive = complexityConfig.maxCognitive;
    const severity = complexityConfig.severity;

    for (const file of context.parsedFiles) {
      const conventions = getLanguageConventions(file.language);
      const functions = findNodes(file.tree, conventions.functionNodeTypes);
      const changedLines = this.getChangedLines(context, file.path);

      for (const fn of functions) {
        const lineNum = fn.range().start.line + 1;
        if (changedLines.size > 0 && !changedLines.has(lineNum)) continue;

        const funcName = this.getFunctionName(fn);
        const cyclomatic = this.computeCyclomatic(fn);
        const cognitive = this.computeCognitive(fn);

        if (cyclomatic > maxCyclomatic) {
          findings.push(this.createFinding(
            'complexity/cyclomatic-too-high',
            file.path,
            lineNum,
            `Function '${funcName}' has cyclomatic complexity ${cyclomatic} (max: ${maxCyclomatic})`,
            { severity },
          ));
        }

        if (cognitive > maxCognitive) {
          findings.push(this.createFinding(
            'complexity/cognitive-too-high',
            file.path,
            lineNum,
            `Function '${funcName}' has cognitive complexity ${cognitive} (max: ${maxCognitive})`,
            { severity },
          ));
        }
      }
    }

    return findings;
  }

  private getFunctionName(node: SgNode): string {
    const nameNode = node.field('name');
    if (nameNode) return nameNode.text();

    // Arrow functions assigned to variables
    const parent = node.parent();
    if (parent?.kind() === 'variable_declarator') {
      const varName = parent.field('name');
      if (varName) return varName.text();
    }

    return '<anonymous>';
  }

  private computeCyclomatic(fn: SgNode): number {
    let complexity = 1; // base path

    walk(fn, (node) => {
      const kind = String(node.kind());
      if (BRANCH_TYPES.has(kind)) {
        complexity++;
      }
      // Count logical operators as branching points
      if (kind === 'binary_expression') {
        const operator = node.field('operator')?.text() ?? '';
        if (LOGICAL_OPERATORS.has(operator)) {
          complexity++;
        }
      }
    });

    return complexity;
  }

  private computeCognitive(fn: SgNode): number {
    let complexity = 0;

    const computeWithNesting = (node: SgNode, nestingLevel: number): void => {
      for (const child of node.children()) {
        const kind = String(child.kind());

        if (NESTING_TYPES.has(kind) && kind !== 'arrow_function' &&
            kind !== 'function_declaration' && kind !== 'method_definition') {
          // Increment by 1 + nesting level for structures that increase nesting
          complexity += 1 + nestingLevel;
          computeWithNesting(child, nestingLevel + 1);
        } else if (kind === 'else_clause') {
          complexity += 1;
          computeWithNesting(child, nestingLevel);
        } else if (kind === 'binary_expression') {
          const operator = child.field('operator')?.text() ?? '';
          if (LOGICAL_OPERATORS.has(operator)) {
            complexity += 1;
          }
          computeWithNesting(child, nestingLevel);
        } else {
          computeWithNesting(child, nestingLevel);
        }
      }
    };

    computeWithNesting(fn, 0);
    return complexity;
  }
}
