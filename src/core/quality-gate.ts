import type { AnalysisSummary, QualityGateConfig } from './types.js';

export interface QualityGateFailure {
  metric: string;
  actual: number;
  threshold: number;
  message: string;
}

export interface QualityGateResult {
  passed: boolean;
  failures: QualityGateFailure[];
}

export function evaluateQualityGate(
  summary: AnalysisSummary,
  config: QualityGateConfig,
  baseline?: AnalysisSummary,
): QualityGateResult {
  const failures: QualityGateFailure[] = [];

  // Calculate new findings (delta from baseline)
  const baselineErrors = baseline?.errors ?? 0;
  const baselineWarnings = baseline?.warnings ?? 0;
  const newErrors = Math.max(0, summary.errors - baselineErrors);
  const newWarnings = Math.max(0, summary.warnings - baselineWarnings);

  if (newErrors > config.maxNewErrors) {
    failures.push({
      metric: 'newErrors',
      actual: newErrors,
      threshold: config.maxNewErrors,
      message: `New errors (${newErrors}) exceed threshold (${config.maxNewErrors})`,
    });
  }

  if (newWarnings > config.maxNewWarnings) {
    failures.push({
      metric: 'newWarnings',
      actual: newWarnings,
      threshold: config.maxNewWarnings,
      message: `New warnings (${newWarnings}) exceed threshold (${config.maxNewWarnings})`,
    });
  }

  if (summary.totalFindings > config.maxTotal) {
    failures.push({
      metric: 'totalFindings',
      actual: summary.totalFindings,
      threshold: config.maxTotal,
      message: `Total findings (${summary.totalFindings}) exceed threshold (${config.maxTotal})`,
    });
  }

  return {
    passed: failures.length === 0,
    failures,
  };
}
