import type { Finding, AnalysisSummary } from '../core/types.js';
import { Severity } from '../core/types.js';

function severityToAnnotationLevel(severity: Severity): 'error' | 'warning' | 'notice' {
  switch (severity) {
    case Severity.Error: return 'error';
    case Severity.Warning: return 'warning';
    case Severity.Info: return 'notice';
  }
}

export function formatGitHubAnnotation(finding: Finding): string {
  const level = severityToAnnotationLevel(finding.severity);
  const endLine = finding.endLine ? `,endLine=${finding.endLine}` : '';
  const col = finding.column ? `,col=${finding.column}` : '';
  const endCol = finding.endColumn ? `,endColumn=${finding.endColumn}` : '';
  return `::${level} file=${finding.file},line=${finding.line}${endLine}${col}${endCol},title=archguardian [${finding.ruleId}]::${finding.message}`;
}

export function formatAnnotations(summary: AnalysisSummary): string {
  const lines: string[] = [];
  for (const result of summary.analyzerResults) {
    for (const finding of result.findings) {
      lines.push(formatGitHubAnnotation(finding));
    }
  }
  return lines.length > 0 ? lines.join('\n') + '\n' : '';
}
