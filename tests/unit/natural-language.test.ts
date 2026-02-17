import { describe, it, expect } from 'vitest';
import { parseRulesFile, NaturalLanguageAnalyzer } from '../../src/rules/natural-language.js';
import { DEFAULT_CONFIG } from '../../src/core/config-loader.js';
import type { AnalysisContext, ArchGuardConfig } from '../../src/core/types.js';

describe('parseRulesFile', () => {
  it('parses markdown headings as rules', () => {
    const markdown = `# Project Rules

## No hardcoded URLs
All URLs should come from configuration

## Use parameterized queries
Database queries must use parameterized statements
`;
    const rules = parseRulesFile(markdown);
    expect(rules).toHaveLength(2);
    expect(rules[0].name).toBe('No hardcoded URLs');
    expect(rules[0].description).toContain('URLs should come from configuration');
    expect(rules[1].name).toBe('Use parameterized queries');
  });

  it('handles empty markdown', () => {
    const rules = parseRulesFile('');
    expect(rules).toHaveLength(0);
  });

  it('handles markdown with no headings', () => {
    const rules = parseRulesFile('Just some text without any rules');
    expect(rules).toHaveLength(0);
  });

  it('handles single rule', () => {
    const markdown = `## Always validate input
Validate all user input before processing`;
    const rules = parseRulesFile(markdown);
    expect(rules).toHaveLength(1);
    expect(rules[0].name).toBe('Always validate input');
  });
});

describe('NaturalLanguageAnalyzer', () => {
  it('has correct name', () => {
    const analyzer = new NaturalLanguageAnalyzer();
    expect(analyzer.name).toBe('natural-language');
  });

  it('returns empty when no rules configured', async () => {
    const config: ArchGuardConfig = { ...DEFAULT_CONFIG };
    const context: AnalysisContext = { files: [], parsedFiles: [], config, projectRoot: '/project' };
    const analyzer = new NaturalLanguageAnalyzer();
    const findings = await analyzer.analyze(context);
    expect(findings).toHaveLength(0);
  });

  it('returns empty when LLM not enabled', async () => {
    const config: ArchGuardConfig = {
      ...DEFAULT_CONFIG,
      rules: { inline: ['Always validate input'] },
    };
    const context: AnalysisContext = { files: [], parsedFiles: [], config, projectRoot: '/project' };
    const analyzer = new NaturalLanguageAnalyzer();
    const findings = await analyzer.analyze(context);
    expect(findings).toHaveLength(0);
  });
});
