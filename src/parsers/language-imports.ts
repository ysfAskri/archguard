import type { SgNode, SgRoot } from '@ast-grep/napi';
import type { SupportedLanguage } from '../core/types.js';
import { walk } from './ast-utils.js';

export interface ImportInfo {
  source: string;
  specifiers: string[];
  node: SgNode;
  line: number;
}

export function collectLanguageImports(tree: SgRoot, language: SupportedLanguage): ImportInfo[] {
  switch (language) {
    case 'typescript':
    case 'javascript':
    case 'tsx':
    case 'jsx':
      return collectTsImports(tree);
    case 'python':
      return collectPythonImports(tree);
    case 'go':
      return collectGoImports(tree);
    case 'rust':
      return collectRustImports(tree);
    case 'java':
      return collectJavaImports(tree);
    default:
      return collectTsImports(tree);
  }
}

function collectTsImports(tree: SgRoot): ImportInfo[] {
  const imports: ImportInfo[] = [];
  walk(tree.root(), (node) => {
    if (node.kind() === 'import_statement') {
      const sourceNode = node.field('source');
      const source = sourceNode?.text().replace(/['"]/g, '') ?? '';
      const specifiers: string[] = [];
      walk(node, (child) => {
        if (child.kind() === 'import_specifier') {
          const alias = child.field('alias');
          const name = alias ?? child.field('name');
          if (name) specifiers.push(name.text());
        } else if (child.kind() === 'identifier' &&
          (child.parent()?.kind() === 'import_clause' || child.parent()?.kind() === 'namespace_import')) {
          specifiers.push(child.text());
        }
      });
      imports.push({ source, specifiers, node, line: node.range().start.line + 1 });
    }
  });
  return imports;
}

function collectPythonImports(tree: SgRoot): ImportInfo[] {
  const imports: ImportInfo[] = [];
  walk(tree.root(), (node) => {
    if (node.kind() === 'import_statement') {
      const specifiers: string[] = [];
      walk(node, (child) => {
        if (child.kind() === 'dotted_name') {
          specifiers.push(child.text());
        }
        if (child.kind() === 'aliased_import') {
          const alias = child.field('alias');
          specifiers.push(alias?.text() ?? child.field('name')?.text() ?? child.text());
        }
      });
      imports.push({ source: '', specifiers, node, line: node.range().start.line + 1 });
    }
    if (node.kind() === 'import_from_statement') {
      const moduleNode = node.field('module_name');
      const source = moduleNode?.text() ?? '';
      const specifiers: string[] = [];
      walk(node, (child) => {
        if (child.kind() === 'dotted_name' && child !== moduleNode) {
          specifiers.push(child.text());
        }
        if (child.kind() === 'aliased_import') {
          const alias = child.field('alias');
          specifiers.push(alias?.text() ?? child.field('name')?.text() ?? child.text());
        }
      });
      imports.push({ source, specifiers, node, line: node.range().start.line + 1 });
    }
  });
  return imports;
}

function collectGoImports(tree: SgRoot): ImportInfo[] {
  const imports: ImportInfo[] = [];
  walk(tree.root(), (node) => {
    if (node.kind() === 'import_declaration') {
      walk(node, (child) => {
        if (child.kind() === 'import_spec') {
          const pathNode = child.field('path');
          const source = pathNode?.text().replace(/"/g, '') ?? '';
          const nameNode = child.field('name');
          // Go imports: the local name is either the alias or the last segment of the path
          const localName = nameNode?.text() ?? source.split('/').pop() ?? '';
          imports.push({ source, specifiers: [localName], node: child, line: child.range().start.line + 1 });
        }
        // Single import (not in a group)
        if (child.kind() === 'interpreted_string_literal' && child.parent()?.kind() === 'import_declaration') {
          const source = child.text().replace(/"/g, '');
          const localName = source.split('/').pop() ?? '';
          imports.push({ source, specifiers: [localName], node: child, line: child.range().start.line + 1 });
        }
      });
    }
  });
  return imports;
}

function collectRustImports(tree: SgRoot): ImportInfo[] {
  const imports: ImportInfo[] = [];
  walk(tree.root(), (node) => {
    if (node.kind() === 'use_declaration') {
      const specifiers: string[] = [];
      walk(node, (child) => {
        if (child.kind() === 'identifier' && child.parent()?.kind() !== 'scoped_identifier') {
          specifiers.push(child.text());
        }
        if (child.kind() === 'use_as_clause') {
          const alias = child.field('alias');
          if (alias) specifiers.push(alias.text());
        }
      });
      const source = node.text().replace(/^use\s+/, '').replace(/;$/, '');
      imports.push({ source, specifiers, node, line: node.range().start.line + 1 });
    }
  });
  return imports;
}

function collectJavaImports(tree: SgRoot): ImportInfo[] {
  const imports: ImportInfo[] = [];
  walk(tree.root(), (node) => {
    if (node.kind() === 'import_declaration') {
      const text = node.text().replace(/^import\s+(static\s+)?/, '').replace(/;$/, '').trim();
      const parts = text.split('.');
      const lastPart = parts[parts.length - 1] ?? '';
      imports.push({ source: text, specifiers: [lastPart], node, line: node.range().start.line + 1 });
    }
  });
  return imports;
}

export function collectExports(tree: SgRoot, language: SupportedLanguage): string[] {
  const exports: string[] = [];
  walk(tree.root(), (node) => {
    if (language === 'typescript' || language === 'javascript' || language === 'tsx' || language === 'jsx') {
      if (node.kind() === 'export_statement') {
        walk(node, (child) => {
          if (child.kind() === 'identifier' || child.kind() === 'type_identifier') {
            exports.push(child.text());
          }
        });
      }
    }
    // Go exported names start with uppercase
    if (language === 'go') {
      if (node.kind() === 'function_declaration' || node.kind() === 'type_declaration') {
        const nameNode = node.field('name');
        if (nameNode && /^[A-Z]/.test(nameNode.text())) {
          exports.push(nameNode.text());
        }
      }
    }
    // Rust pub items
    if (language === 'rust') {
      if (node.kind() === 'visibility_modifier' && node.text() === 'pub') {
        const parent = node.parent();
        if (parent) {
          const nameNode = parent.field('name');
          if (nameNode) exports.push(nameNode.text());
        }
      }
    }
    // Java public classes
    if (language === 'java') {
      if (node.kind() === 'class_declaration' || node.kind() === 'interface_declaration') {
        const nameNode = node.field('name');
        if (nameNode) exports.push(nameNode.text());
      }
    }
  });
  return exports;
}
