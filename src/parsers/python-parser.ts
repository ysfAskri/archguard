import type { ParsedFile, SupportedLanguage } from '../core/types.js';
import { parseSource } from './tree-sitter-manager.js';

export function isPython(lang: SupportedLanguage): boolean {
  return lang === 'python';
}

export async function parsePython(source: string, filePath: string): Promise<ParsedFile> {
  const tree = await parseSource('python', source);
  return {
    path: filePath,
    language: 'python',
    tree,
    content: source,
  };
}
