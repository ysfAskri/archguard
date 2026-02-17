import { describe, it, expect } from 'vitest';
import { evaluateQualityGate } from '../../src/core/quality-gate.js';
import type { AnalysisSummary, QualityGateConfig } from '../../src/core/types.js';

function makeSummary(overrides: Partial<AnalysisSummary> = {}): AnalysisSummary {
  return {
    totalFiles: 10,
    totalFindings: 5,
    errors: 2,
    warnings: 3,
    infos: 0,
    analyzerResults: [],
    duration: 100,
    ...overrides,
  };
}

const defaultGate: QualityGateConfig = {
  maxNewErrors: 0,
  maxNewWarnings: 5,
  maxTotal: 100,
};

describe('evaluateQualityGate', () => {
  it('passes when all thresholds are met', () => {
    const summary = makeSummary({ errors: 0, warnings: 3, totalFindings: 3 });
    const result = evaluateQualityGate(summary, defaultGate);
    expect(result.passed).toBe(true);
    expect(result.failures).toHaveLength(0);
  });

  it('fails when new errors exceed threshold', () => {
    const summary = makeSummary({ errors: 3, warnings: 0, totalFindings: 3 });
    const result = evaluateQualityGate(summary, { ...defaultGate, maxNewErrors: 0 });
    expect(result.passed).toBe(false);
    expect(result.failures.some(f => f.metric === 'newErrors')).toBe(true);
  });

  it('fails when new warnings exceed threshold', () => {
    const summary = makeSummary({ errors: 0, warnings: 10, totalFindings: 10 });
    const result = evaluateQualityGate(summary, { ...defaultGate, maxNewWarnings: 5 });
    expect(result.passed).toBe(false);
    expect(result.failures.some(f => f.metric === 'newWarnings')).toBe(true);
  });

  it('fails when total findings exceed threshold', () => {
    const summary = makeSummary({ errors: 0, warnings: 0, totalFindings: 150 });
    const result = evaluateQualityGate(summary, { ...defaultGate, maxTotal: 100 });
    expect(result.passed).toBe(false);
    expect(result.failures.some(f => f.metric === 'totalFindings')).toBe(true);
  });

  it('accounts for baseline when computing new findings', () => {
    const summary = makeSummary({ errors: 5, warnings: 8, totalFindings: 13 });
    const baseline = makeSummary({ errors: 5, warnings: 3, totalFindings: 8 });
    const result = evaluateQualityGate(summary, defaultGate, baseline);
    // New errors = 5-5=0 (ok), new warnings = 8-3=5 (ok), total=13<100 (ok)
    expect(result.passed).toBe(true);
  });

  it('returns multiple failures at once', () => {
    const summary = makeSummary({ errors: 5, warnings: 20, totalFindings: 200 });
    const result = evaluateQualityGate(summary, { maxNewErrors: 0, maxNewWarnings: 5, maxTotal: 100 });
    expect(result.passed).toBe(false);
    expect(result.failures.length).toBeGreaterThanOrEqual(2);
  });

  it('passes with zero findings', () => {
    const summary = makeSummary({ errors: 0, warnings: 0, totalFindings: 0 });
    const result = evaluateQualityGate(summary, defaultGate);
    expect(result.passed).toBe(true);
  });
});
