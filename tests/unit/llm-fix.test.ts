import { describe, it, expect } from 'vitest';
import { LlmFix } from '../../src/fixes/llm-fix.js';

describe('LlmFix', () => {
  it('has wildcard ruleId', () => {
    const fix = new LlmFix();
    expect(fix.ruleId).toBe('*');
  });

  it('returns not-applied when no API key available', async () => {
    const fix = new LlmFix();
    const result = await fix.apply('/nonexistent/path.ts', {
      ruleId: 'test/rule',
      analyzer: 'test',
      severity: 'warning' as const,
      message: 'test message',
      file: 'test.ts',
      line: 1,
    });
    expect(result.applied).toBe(false);
  });
});
