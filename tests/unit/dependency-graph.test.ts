import { describe, it, expect } from 'vitest';
import { buildDependencyGraph, getConsumers, getImpactedFiles } from '../../src/core/dependency-graph.js';
import { parseSource } from '../../src/parsers/tree-sitter-manager.js';
import type { ParsedFile } from '../../src/core/types.js';

function makeParsedFile(path: string, content: string, language: 'typescript' | 'javascript' = 'typescript'): ParsedFile {
  return {
    path,
    language,
    tree: parseSource(language, content),
    content,
  };
}

describe('buildDependencyGraph', () => {
  it('builds graph from import relationships', () => {
    const files = [
      makeParsedFile('src/a.ts', `import { foo } from './b.js';\nconsole.log(foo);`),
      makeParsedFile('src/b.ts', `export const foo = 42;`),
    ];

    const graph = buildDependencyGraph(files, '/project');
    const nodeA = graph.nodes.get('src/a.ts');
    const nodeB = graph.nodes.get('src/b.ts');

    expect(nodeA).toBeDefined();
    expect(nodeB).toBeDefined();
    expect(nodeA!.imports).toContain('src/b.ts');
    expect(nodeB!.importedBy).toContain('src/a.ts');
  });

  it('ignores external packages', () => {
    const files = [
      makeParsedFile('src/a.ts', `import chalk from 'chalk';\nimport { foo } from './b.js';`),
      makeParsedFile('src/b.ts', `export const foo = 42;`),
    ];

    const graph = buildDependencyGraph(files, '/project');
    const nodeA = graph.nodes.get('src/a.ts')!;
    expect(nodeA.imports).toHaveLength(1);
    expect(nodeA.imports[0]).toBe('src/b.ts');
  });

  it('handles files with no imports', () => {
    const files = [
      makeParsedFile('src/a.ts', `const x = 42;`),
    ];
    const graph = buildDependencyGraph(files, '/project');
    expect(graph.nodes.get('src/a.ts')!.imports).toHaveLength(0);
  });
});

describe('getConsumers', () => {
  it('returns direct consumers', () => {
    const files = [
      makeParsedFile('src/a.ts', `import { b } from './b.js';`),
      makeParsedFile('src/b.ts', `export const b = 1;`),
      makeParsedFile('src/c.ts', `import { b } from './b.js';`),
    ];

    const graph = buildDependencyGraph(files, '/project');
    const consumers = getConsumers(graph, 'src/b.ts', 1);
    expect(consumers).toContain('src/a.ts');
    expect(consumers).toContain('src/c.ts');
    expect(consumers).toHaveLength(2);
  });

  it('follows transitive consumers with depth > 1', () => {
    const files = [
      makeParsedFile('src/a.ts', `import { b } from './b.js';`),
      makeParsedFile('src/b.ts', `import { c } from './c.js';\nexport const b = 1;`),
      makeParsedFile('src/c.ts', `export const c = 1;`),
    ];

    const graph = buildDependencyGraph(files, '/project');
    const consumers = getConsumers(graph, 'src/c.ts', 2);
    expect(consumers).toContain('src/b.ts');
    expect(consumers).toContain('src/a.ts');
  });

  it('returns empty for leaf files', () => {
    const files = [
      makeParsedFile('src/a.ts', `import { b } from './b.js';`),
      makeParsedFile('src/b.ts', `export const b = 1;`),
    ];

    const graph = buildDependencyGraph(files, '/project');
    const consumers = getConsumers(graph, 'src/a.ts', 1);
    expect(consumers).toHaveLength(0);
  });
});

describe('getImpactedFiles', () => {
  it('returns impacted files for changed files', () => {
    const files = [
      makeParsedFile('src/a.ts', `import { b } from './b.js';`),
      makeParsedFile('src/b.ts', `export const b = 1;`),
    ];

    const graph = buildDependencyGraph(files, '/project');
    const impact = getImpactedFiles(graph, ['src/b.ts'], 2);
    expect(impact.has('src/b.ts')).toBe(true);
    expect(impact.get('src/b.ts')).toContain('src/a.ts');
  });

  it('returns empty map for files with no consumers', () => {
    const files = [
      makeParsedFile('src/a.ts', `const x = 1;`),
    ];

    const graph = buildDependencyGraph(files, '/project');
    const impact = getImpactedFiles(graph, ['src/a.ts'], 2);
    expect(impact.size).toBe(0);
  });
});
