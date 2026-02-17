import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { AnalysisContext, Finding } from '../core/types.js';
import { Severity } from '../core/types.js';
import { BaseAnalyzer } from './base-analyzer.js';
import { logger } from '../utils/logger.js';

interface FileCoverage {
  file: string;
  totalLines: number;
  coveredLines: number;
  uncoveredLines: number[];
}

export class CoverageAnalyzer extends BaseAnalyzer {
  name = 'coverage';

  protected defaultSeverity(): Severity {
    return Severity.Warning;
  }

  async analyze(context: AnalysisContext): Promise<Finding[]> {
    const findings: Finding[] = [];
    const coverageConfig = context.config.analyzers.coverage;
    if (!coverageConfig?.enabled) return findings;

    const severity = coverageConfig.severity;
    const reportPath = join(context.projectRoot, coverageConfig.reportPath);

    let coverageData: FileCoverage[];
    try {
      const content = await readFile(reportPath, 'utf-8');
      if (reportPath.endsWith('.json')) {
        coverageData = this.parseIstanbul(content);
      } else {
        coverageData = this.parseLcov(content);
      }
    } catch {
      logger.debug(`Coverage report not found at ${reportPath}`);
      return findings;
    }

    if (coverageData.length === 0) return findings;

    // Check per-file coverage against threshold
    for (const fileCov of coverageData) {
      const coverage = fileCov.totalLines > 0
        ? (fileCov.coveredLines / fileCov.totalLines) * 100
        : 100;

      if (coverage < coverageConfig.minCoverage) {
        findings.push(this.createFinding(
          'coverage/below-threshold',
          fileCov.file,
          1,
          `File coverage ${coverage.toFixed(1)}% is below threshold ${coverageConfig.minCoverage}%`,
          { severity },
        ));
      }
    }

    // Check new/changed code coverage
    for (const file of context.files) {
      const changedLines = this.getChangedLines(context, file.path);
      if (changedLines.size === 0) continue;

      const fileCov = coverageData.find(c => file.path.endsWith(c.file) || c.file.endsWith(file.path));
      if (!fileCov) continue;

      const uncoveredNewLines = [...changedLines].filter(line => fileCov.uncoveredLines.includes(line));
      const newCodeCoverage = changedLines.size > 0
        ? ((changedLines.size - uncoveredNewLines.length) / changedLines.size) * 100
        : 100;

      if (newCodeCoverage < coverageConfig.minNewCodeCoverage) {
        for (const line of uncoveredNewLines.slice(0, 5)) { // limit to 5 findings per file
          findings.push(this.createFinding(
            'coverage/uncovered-new-code',
            file.path,
            line,
            `New/changed code at line ${line} is not covered by tests`,
            { severity },
          ));
        }
      }
    }

    return findings;
  }

  private parseLcov(content: string): FileCoverage[] {
    const results: FileCoverage[] = [];
    const blocks = content.split('end_of_record');

    for (const block of blocks) {
      const lines = block.trim().split('\n');
      let file = '';
      let totalLines = 0;
      let coveredLines = 0;
      const uncovered: number[] = [];

      for (const line of lines) {
        if (line.startsWith('SF:')) {
          file = line.substring(3).trim();
        } else if (line.startsWith('DA:')) {
          const parts = line.substring(3).split(',');
          const lineNum = parseInt(parts[0], 10);
          const hitCount = parseInt(parts[1], 10);
          totalLines++;
          if (hitCount > 0) {
            coveredLines++;
          } else {
            uncovered.push(lineNum);
          }
        }
      }

      if (file) {
        results.push({ file, totalLines, coveredLines, uncoveredLines: uncovered });
      }
    }

    return results;
  }

  private parseIstanbul(content: string): FileCoverage[] {
    const results: FileCoverage[] = [];

    try {
      const data = JSON.parse(content) as Record<string, {
        statementMap: Record<string, { start: { line: number }; end: { line: number } }>;
        s: Record<string, number>;
      }>;

      for (const [file, coverage] of Object.entries(data)) {
        const statementMap = coverage.statementMap ?? {};
        const statements = coverage.s ?? {};
        let totalLines = 0;
        let coveredLines = 0;
        const uncovered: number[] = [];

        for (const [key, map] of Object.entries(statementMap)) {
          totalLines++;
          const count = statements[key] ?? 0;
          if (count > 0) {
            coveredLines++;
          } else {
            uncovered.push(map.start.line);
          }
        }

        results.push({ file, totalLines, coveredLines, uncoveredLines: uncovered });
      }
    } catch {
      // Invalid JSON
    }

    return results;
  }
}
