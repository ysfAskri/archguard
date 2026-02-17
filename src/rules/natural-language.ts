import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { AnalysisContext, Finding } from '../core/types.js';
import { Severity } from '../core/types.js';
import { BaseAnalyzer } from '../analyzers/base-analyzer.js';
import { createLlmClient } from '../llm/client.js';
import { buildNaturalLanguagePrompt } from '../llm/prompts.js';
import { LlmCache, buildCacheKey } from '../llm/cache.js';
import { createHash } from 'node:crypto';
import { logger } from '../utils/logger.js';

export interface NaturalLanguageRule {
  name: string;
  description: string;
}

/**
 * Parse a markdown rules file.
 * Each ## heading becomes a rule name, body becomes description.
 */
export function parseRulesFile(markdown: string): NaturalLanguageRule[] {
  const rules: NaturalLanguageRule[] = [];
  const lines = markdown.split('\n');
  let currentRule: NaturalLanguageRule | null = null;

  for (const line of lines) {
    const headingMatch = line.match(/^##\s+(.+)/);
    if (headingMatch) {
      if (currentRule) {
        rules.push(currentRule);
      }
      currentRule = { name: headingMatch[1].trim(), description: '' };
    } else if (currentRule) {
      currentRule.description += (currentRule.description ? '\n' : '') + line;
    }
  }

  if (currentRule) {
    rules.push(currentRule);
  }

  // Trim descriptions
  for (const rule of rules) {
    rule.description = rule.description.trim();
  }

  return rules;
}

export class NaturalLanguageAnalyzer extends BaseAnalyzer {
  name = 'natural-language';

  protected defaultSeverity(): Severity {
    return Severity.Warning;
  }

  async analyze(context: AnalysisContext): Promise<Finding[]> {
    const rulesConfig = context.config.rules;
    if (!rulesConfig) return [];

    // Collect rules
    const ruleTexts: string[] = [];

    if (rulesConfig.file) {
      try {
        const filePath = join(context.projectRoot, rulesConfig.file);
        const content = await readFile(filePath, 'utf-8');
        const parsed = parseRulesFile(content);
        for (const rule of parsed) {
          ruleTexts.push(`${rule.name}: ${rule.description}`);
        }
      } catch (err) {
        logger.warn(`Failed to load rules file: ${(err as Error).message}`);
      }
    }

    if (rulesConfig.inline) {
      ruleTexts.push(...rulesConfig.inline);
    }

    if (ruleTexts.length === 0) return [];

    // Check LLM availability
    if (!context.config.llm.enabled) {
      logger.warn('Natural language rules require LLM to be enabled');
      return [];
    }

    const client = createLlmClient(context.config.llm);
    const cache = new LlmCache();
    cache.loadFromDisk(context.projectRoot);

    const findings: Finding[] = [];
    const rulesHash = createHash('sha256').update(ruleTexts.join('\n')).digest('hex');

    for (const file of context.parsedFiles) {
      const contentHash = createHash('sha256').update(file.content).digest('hex');
      const cacheKey = buildCacheKey('nl-rules', rulesHash, 0, contentHash);

      const cached = cache.get(cacheKey);
      if (cached) {
        try {
          const parsed = JSON.parse(cached) as Array<{ ruleIndex: number; line: number; message: string }>;
          for (const item of parsed) {
            findings.push(this.createFinding(
              `nl-rule/${item.ruleIndex}`,
              file.path,
              item.line,
              item.message,
            ));
          }
        } catch {
          // Corrupt cache entry
        }
        continue;
      }

      const prompt = buildNaturalLanguagePrompt(ruleTexts, file.content, file.path);
      try {
        const response = await client.suggest(
          { ruleId: 'nl-rules', analyzer: 'natural-language', severity: Severity.Warning, message: prompt, file: file.path, line: 0 },
          file.content,
        );

        if (response) {
          // Extract JSON from response
          const jsonMatch = response.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]) as Array<{ ruleIndex: number; line: number; message: string }>;
            cache.set(cacheKey, JSON.stringify(parsed));
            for (const item of parsed) {
              findings.push(this.createFinding(
                `nl-rule/${item.ruleIndex}`,
                file.path,
                item.line,
                item.message,
              ));
            }
          }
        }
      } catch (err) {
        logger.warn(`NL rule evaluation failed for ${file.path}: ${(err as Error).message}`);
      }
    }

    cache.saveToDisk(context.projectRoot);
    return findings;
  }
}
