import type { Finding } from '../core/types.js';

/**
 * Build a prompt tailored to the finding's analyzer type.
 * The LLM is asked for a concise fix suggestion (1-3 lines max).
 */
export function buildPrompt(finding: Finding, codeSnippet: string): string {
  const strategy = PROMPT_STRATEGIES[finding.analyzer] ?? PROMPT_STRATEGIES['default'];
  return strategy(finding, codeSnippet);
}

/**
 * Build a prompt for generating a complete fix for a finding.
 * Used by the LLM auto-fix feature.
 */
export function buildFixPrompt(finding: Finding, fullFileContent: string): string {
  return [
    'You are a code repair expert. Fix the following issue in the code.',
    '',
    `Issue: "${finding.message}" (rule: ${finding.ruleId}) at line ${finding.line}`,
    '',
    'Full file content:',
    '```',
    fullFileContent,
    '```',
    '',
    'Return ONLY the complete fixed file content in a code block.',
    'Do not add explanations. Do not change anything except what is needed to fix the issue.',
  ].join('\n');
}

/**
 * Build a prompt for natural language rule evaluation.
 */
export function buildNaturalLanguagePrompt(rules: string[], fileContent: string, filePath: string): string {
  const rulesText = rules.map((r, i) => `${i + 1}. ${r}`).join('\n');
  return [
    'You are a code reviewer evaluating custom rules. For each rule that is violated in the code below, report a finding.',
    '',
    'Rules:',
    rulesText,
    '',
    `File: ${filePath}`,
    '```',
    fileContent,
    '```',
    '',
    'Return a JSON array of findings. Each finding must have: { "ruleIndex": number, "line": number, "message": string }',
    'Return [] if no rules are violated. Return ONLY the JSON array, no explanation.',
  ].join('\n');
}

type PromptBuilder = (finding: Finding, codeSnippet: string) => string;

const aiSmellsPrompt: PromptBuilder = (finding, codeSnippet) => {
  return [
    'You are a code quality expert identifying AI-generated code smells.',
    `An AI code smell was detected: "${finding.message}" (rule: ${finding.ruleId}).`,
    '',
    'Code:',
    '```',
    codeSnippet,
    '```',
    '',
    'Suggest a concise improvement (1-3 lines of code max) that removes this AI-generated code smell.',
    'Respond ONLY with the improved code, no explanation.',
  ].join('\n');
};

const PROMPT_STRATEGIES: Record<string, PromptBuilder> = {
  'ai-smells': aiSmellsPrompt,

  security(finding, codeSnippet) {
    return [
      'You are a security expert reviewing code.',
      `A security issue was found: "${finding.message}" (rule: ${finding.ruleId}).`,
      '',
      'Code:',
      '```',
      codeSnippet,
      '```',
      '',
      'Suggest a concise fix (1-3 lines of code max) that resolves this security issue.',
      'Respond ONLY with the fix, no explanation.',
    ].join('\n');
  },

  conventions(finding, codeSnippet) {
    return [
      'You are a code style expert enforcing project conventions.',
      `A convention violation was found: "${finding.message}" (rule: ${finding.ruleId}).`,
      '',
      'Code:',
      '```',
      codeSnippet,
      '```',
      '',
      'Suggest a concise fix (1-3 lines of code max) that corrects this naming or style convention violation.',
      'Respond ONLY with the corrected code, no explanation.',
    ].join('\n');
  },

  architecture(finding, codeSnippet) {
    return [
      'You are a software architect reviewing layer dependencies.',
      `An architecture violation was found: "${finding.message}" (rule: ${finding.ruleId}).`,
      '',
      'Code:',
      '```',
      codeSnippet,
      '```',
      '',
      'Suggest a concise fix (1-3 lines of code max) that resolves this layer dependency violation.',
      'Respond ONLY with the fix, no explanation.',
    ].join('\n');
  },

  default(finding, codeSnippet) {
    return [
      'You are a code review expert.',
      `An issue was found: "${finding.message}" (rule: ${finding.ruleId}, analyzer: ${finding.analyzer}).`,
      '',
      'Code:',
      '```',
      codeSnippet,
      '```',
      '',
      'Suggest a concise fix (1-3 lines of code max) that resolves this issue.',
      'Respond ONLY with the fix, no explanation.',
    ].join('\n');
  },
};
