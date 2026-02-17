import { describe, it, expect } from 'vitest';
import { generateImpactDiagram, generateArchitectureDiagram } from '../../src/core/mermaid.js';
import { buildDependencyGraph } from '../../src/core/dependency-graph.js';
import { parseSource } from '../../src/parsers/tree-sitter-manager.js';
import type { ParsedFile } from '../../src/core/types.js';

function makeParsedFile(path: string, content: string): ParsedFile {
  return { path, language: 'typescript', tree: parseSource('typescript', content), content };
}

describe('generateImpactDiagram', () => {
  it('generates mermaid impact diagram', () => {
    const files = [
      makeParsedFile('src/a.ts', `import { b } from './b.js';`),
      makeParsedFile('src/b.ts', `export const b = 1;`),
      makeParsedFile('src/c.ts', `import { b } from './b.js';`),
    ];

    const graph = buildDependencyGraph(files, '/project');
    const diagram = generateImpactDiagram(['src/b.ts'], graph, 2);

    expect(diagram).toContain('graph LR');
    expect(diagram).toContain('changed');
    expect(diagram).toContain('b.ts');
    expect(diagram).toContain('a.ts');
  });

  it('handles file with no consumers', () => {
    const files = [
      makeParsedFile('src/a.ts', `const x = 1;`),
    ];

    const graph = buildDependencyGraph(files, '/project');
    const diagram = generateImpactDiagram(['src/a.ts'], graph, 2);

    expect(diagram).toContain('graph LR');
    expect(diagram).toContain('a.ts');
  });
});

describe('generateArchitectureDiagram', () => {
  it('generates mermaid architecture diagram with subgraphs', () => {
    const files = [
      makeParsedFile('src/a.ts', `import { b } from './b.js';`),
      makeParsedFile('src/b.ts', `export const b = 1;`),
    ];

    const graph = buildDependencyGraph(files, '/project');
    const diagram = generateArchitectureDiagram(graph);

    expect(diagram).toContain('graph TD');
    expect(diagram).toContain('subgraph');
    expect(diagram).toContain('a.ts');
    expect(diagram).toContain('b.ts');
    expect(diagram).toContain('-->');
  });

  it('filters by scope', () => {
    const files = [
      makeParsedFile('src/a.ts', `import { b } from './b.js';`),
      makeParsedFile('src/b.ts', `export const b = 1;`),
      makeParsedFile('lib/c.ts', `const x = 1;`),
    ];

    const graph = buildDependencyGraph(files, '/project');
    const diagram = generateArchitectureDiagram(graph, 'src');

    expect(diagram).toContain('a.ts');
    expect(diagram).not.toContain('c.ts');
  });
});
