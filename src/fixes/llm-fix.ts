import { readFile, writeFile } from 'node:fs/promises';
import type { Finding } from '../core/types.js';
import type { Fix, FixResult } from './index.js';
import { createLlmClient } from '../llm/client.js';
import { buildFixPrompt } from '../llm/prompts.js';
import { logger } from '../utils/logger.js';

export class LlmFix implements Fix {
  ruleId = '*'; // Fallback for any rule without built-in fix

  async apply(filePath: string, finding: Finding): Promise<FixResult> {
    try {
      const content = await readFile(filePath, 'utf-8');
      const patch = await this.generateFix(finding, content);

      if (!patch) {
        return { applied: false, description: 'LLM could not generate a fix' };
      }

      await writeFile(filePath, patch, 'utf-8');
      return { applied: true, description: `AI fix applied for ${finding.ruleId}` };
    } catch (err) {
      logger.warn(`LLM fix failed: ${(err as Error).message}`);
      return { applied: false, description: `LLM fix error: ${(err as Error).message}` };
    }
  }

  async preview(filePath: string, finding: Finding): Promise<string> {
    try {
      const content = await readFile(filePath, 'utf-8');
      const patch = await this.generateFix(finding, content);
      if (!patch) return 'LLM could not generate a fix preview';
      return this.createDiff(content, patch, filePath);
    } catch {
      return 'LLM fix preview unavailable';
    }
  }

  private async generateFix(finding: Finding, fullFileContent: string): Promise<string | null> {
    const config = {
      enabled: true,
      provider: 'openai' as const,
      apiKey: process.env['OPENAI_API_KEY'] ?? process.env['ANTHROPIC_API_KEY'],
    };

    const client = createLlmClient(config);
    const prompt = buildFixPrompt(finding, fullFileContent);

    const response = await (client as { suggest(f: Finding, s: string): Promise<string | null> }).suggest(
      { ...finding, message: prompt },
      fullFileContent,
    );

    if (!response) return null;

    // Extract code from markdown code blocks if present
    const codeBlockMatch = response.match(/```[\w]*\n([\s\S]*?)```/);
    return codeBlockMatch ? codeBlockMatch[1].trimEnd() + '\n' : null;
  }

  private createDiff(original: string, modified: string, filePath: string): string {
    const origLines = original.split('\n');
    const modLines = modified.split('\n');
    const lines: string[] = [`--- a/${filePath}`, `+++ b/${filePath}`];

    let i = 0;
    let j = 0;
    while (i < origLines.length || j < modLines.length) {
      if (i < origLines.length && j < modLines.length && origLines[i] === modLines[j]) {
        i++;
        j++;
      } else {
        const start = Math.max(0, i - 2);
        lines.push(`@@ -${start + 1} +${start + 1} @@`);
        if (i < origLines.length) lines.push(`-${origLines[i]}`);
        if (j < modLines.length) lines.push(`+${modLines[j]}`);
        i++;
        j++;
      }
    }

    return lines.join('\n');
  }
}
