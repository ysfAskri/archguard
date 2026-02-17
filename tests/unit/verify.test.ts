import { describe, it, expect } from 'vitest';
import { verifyFix } from '../../src/fixes/verify.js';
import { DEFAULT_CONFIG } from '../../src/core/config-loader.js';

describe('verifyFix', () => {
  it('returns failed for nonexistent file', async () => {
    const result = await verifyFix('/nonexistent/path.ts', {
      ruleId: 'test/rule',
      analyzer: 'test',
      severity: 'warning' as const,
      message: 'test',
      file: 'nonexistent.ts',
      line: 1,
    }, DEFAULT_CONFIG, '/tmp');

    expect(result.passed).toBe(false);
    expect(result.findingStillPresent).toBe(true);
  });
});
