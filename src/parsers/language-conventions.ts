import type { NamingConvention, SupportedLanguage } from '../core/types.js';

export interface LanguageConventionMap {
  functionNodeTypes: string[];
  classNodeTypes: string[];
  constantNodeTypes: string[];
  importNodeTypes: string[];
  exportNodeTypes: string[];
  defaultNaming: {
    functions: NamingConvention;
    classes: NamingConvention;
    constants: NamingConvention;
    files: NamingConvention;
  };
}

const TYPESCRIPT_CONVENTIONS: LanguageConventionMap = {
  functionNodeTypes: ['function_declaration', 'method_definition', 'arrow_function'],
  classNodeTypes: ['class_declaration', 'interface_declaration', 'type_alias_declaration'],
  constantNodeTypes: ['lexical_declaration'],
  importNodeTypes: ['import_statement'],
  exportNodeTypes: ['export_statement'],
  defaultNaming: { functions: 'camelCase', classes: 'PascalCase', constants: 'UPPER_SNAKE', files: 'kebab-case' },
};

const PYTHON_CONVENTIONS: LanguageConventionMap = {
  functionNodeTypes: ['function_definition'],
  classNodeTypes: ['class_definition'],
  constantNodeTypes: ['assignment', 'expression_statement'],
  importNodeTypes: ['import_statement', 'import_from_statement'],
  exportNodeTypes: [],
  defaultNaming: { functions: 'snake_case', classes: 'PascalCase', constants: 'UPPER_SNAKE', files: 'snake_case' },
};

const GO_CONVENTIONS: LanguageConventionMap = {
  functionNodeTypes: ['function_declaration', 'method_declaration'],
  classNodeTypes: ['type_declaration'],
  constantNodeTypes: ['const_declaration'],
  importNodeTypes: ['import_declaration'],
  exportNodeTypes: [],
  defaultNaming: { functions: 'camelCase', classes: 'PascalCase', constants: 'camelCase', files: 'snake_case' },
};

const RUST_CONVENTIONS: LanguageConventionMap = {
  functionNodeTypes: ['function_item'],
  classNodeTypes: ['struct_item', 'enum_item', 'trait_item'],
  constantNodeTypes: ['const_item', 'static_item'],
  importNodeTypes: ['use_declaration'],
  exportNodeTypes: [],
  defaultNaming: { functions: 'snake_case', classes: 'PascalCase', constants: 'UPPER_SNAKE', files: 'snake_case' },
};

const JAVA_CONVENTIONS: LanguageConventionMap = {
  functionNodeTypes: ['method_declaration', 'constructor_declaration'],
  classNodeTypes: ['class_declaration', 'interface_declaration', 'enum_declaration'],
  constantNodeTypes: ['field_declaration'],
  importNodeTypes: ['import_declaration'],
  exportNodeTypes: [],
  defaultNaming: { functions: 'camelCase', classes: 'PascalCase', constants: 'UPPER_SNAKE', files: 'PascalCase' },
};

const CONVENTION_MAP: Partial<Record<SupportedLanguage, LanguageConventionMap>> = {
  typescript: TYPESCRIPT_CONVENTIONS,
  javascript: TYPESCRIPT_CONVENTIONS,
  tsx: TYPESCRIPT_CONVENTIONS,
  jsx: TYPESCRIPT_CONVENTIONS,
  python: PYTHON_CONVENTIONS,
  go: GO_CONVENTIONS,
  rust: RUST_CONVENTIONS,
  java: JAVA_CONVENTIONS,
};

export function getLanguageConventions(language: SupportedLanguage): LanguageConventionMap {
  return CONVENTION_MAP[language] ?? TYPESCRIPT_CONVENTIONS;
}

export function isTypeScriptLike(language: SupportedLanguage): boolean {
  return language === 'typescript' || language === 'javascript' || language === 'tsx' || language === 'jsx';
}
