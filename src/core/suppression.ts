import type { Finding, ParsedFile, SupportedLanguage } from './types.js';

export interface SuppressionDirective {
  targetLine: number;
  ruleId: string | null;
}

const IGNORE_NEXT_LINE = 'archguard-ignore';
const IGNORE_SAME_LINE = 'archguard-ignore-line';

/**
 * Extract suppression directives from file content.
 * Supports //, #, and block comments.
 */
export function parseSuppressionDirectives(
  content: string,
  language: SupportedLanguage,
): SuppressionDirective[] {
  const lines = content.split('\n');
  const directives: SuppressionDirective[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNumber = i + 1;

    // Check for same-line directive first (archguard-ignore-line)
    const sameLine = extractDirective(line, IGNORE_SAME_LINE, language);
    if (sameLine !== undefined) {
      directives.push({ targetLine: lineNumber, ruleId: sameLine });
    }

    // Check for next-line directive (archguard-ignore) — but NOT archguard-ignore-line
    const nextLine = extractDirective(line, IGNORE_NEXT_LINE, language, true);
    if (nextLine !== undefined) {
      directives.push({ targetLine: lineNumber + 1, ruleId: nextLine });
    }
  }

  return directives;
}

function extractDirective(
  line: string,
  keyword: string,
  language: SupportedLanguage,
  excludeSameLine = false,
): string | null | undefined {
  // Try each comment style
  const patterns = getCommentPatterns(language);

  for (const extract of patterns) {
    const commentBody = extract(line);
    if (commentBody === null) continue;

    const result = matchDirective(commentBody, keyword, excludeSameLine);
    if (result !== undefined) return result;
  }

  return undefined;
}

type CommentExtractor = (line: string) => string | null;

function getCommentPatterns(language: SupportedLanguage): CommentExtractor[] {
  const extractors: CommentExtractor[] = [];

  // // style comments (all languages except python)
  if (language !== 'python') {
    extractors.push((line: string) => {
      const match = line.match(/\/\/\s*(.*)/);
      return match ? match[1] : null;
    });
  }

  // # style comments (python only)
  if (language === 'python') {
    extractors.push((line: string) => {
      const match = line.match(/#\s*(.*)/);
      return match ? match[1] : null;
    });
  }

  // /* */ style block comments (all non-python languages)
  if (language !== 'python') {
    extractors.push((line: string) => {
      const match = line.match(/\/\*\s*(.*?)\s*\*\//);
      return match ? match[1] : null;
    });
  }

  return extractors;
}

function matchDirective(
  commentBody: string,
  keyword: string,
  excludeSameLine: boolean,
): string | null | undefined {
  const trimmed = commentBody.trim();

  if (excludeSameLine) {
    // For "archguard-ignore", we need to make sure it's NOT "archguard-ignore-line"
    if (!trimmed.startsWith(keyword)) return undefined;
    const after = trimmed.slice(keyword.length);
    if (after.startsWith('-line')) return undefined;
    // It's a match — extract optional rule ID
    const ruleId = after.trim() || null;
    return ruleId;
  }

  if (!trimmed.startsWith(keyword)) return undefined;
  const after = trimmed.slice(keyword.length).trim();
  return after || null;
}

/**
 * Filter findings by inline suppression directives.
 */
export function applySuppression(
  findings: Finding[],
  parsedFiles: ParsedFile[],
): { findings: Finding[]; suppressedCount: number } {
  // Build directive map: file -> line -> ruleIds (null means suppress all)
  const directiveMap = new Map<string, Map<number, (string | null)[]>>();

  for (const pf of parsedFiles) {
    const directives = parseSuppressionDirectives(pf.content, pf.language);
    if (directives.length === 0) continue;

    const lineMap = new Map<number, (string | null)[]>();
    for (const d of directives) {
      const existing = lineMap.get(d.targetLine) ?? [];
      existing.push(d.ruleId);
      lineMap.set(d.targetLine, existing);
    }
    directiveMap.set(pf.path, lineMap);
  }

  let suppressedCount = 0;
  const filtered = findings.filter(f => {
    const lineMap = directiveMap.get(f.file);
    if (!lineMap) return true;

    const rules = lineMap.get(f.line);
    if (!rules) return true;

    // Check if any directive suppresses this finding
    const suppressed = rules.some(ruleId => ruleId === null || ruleId === f.ruleId);
    if (suppressed) {
      suppressedCount++;
      return false;
    }
    return true;
  });

  return { findings: filtered, suppressedCount };
}
