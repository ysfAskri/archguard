import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { z } from 'zod';
import { Severity, type ArchGuardConfig } from './types.js';

const SeverityEnum = z.nativeEnum(Severity);
const NamingConventionEnum = z.enum(['camelCase', 'PascalCase', 'snake_case', 'UPPER_SNAKE', 'kebab-case']);
const LanguageEnum = z.enum(['typescript', 'javascript', 'tsx', 'jsx', 'python', 'go', 'rust', 'java']);

const PerLanguageNamingSchema = z.object({
  functions: NamingConventionEnum.optional(),
  classes: NamingConventionEnum.optional(),
  constants: NamingConventionEnum.optional(),
  files: NamingConventionEnum.optional(),
});

const ConfigSchema = z.object({
  version: z.number().default(1),
  languages: z.array(LanguageEnum).default(['typescript', 'javascript', 'tsx', 'jsx']),
  include: z.array(z.string()).default(['**/*']),
  exclude: z.array(z.string()).default(['**/node_modules/**', '**/dist/**', '**/*.test.ts', '**/*.spec.ts']),
  plugins: z.array(z.string()).default([]),
  severity: z.object({
    failOn: SeverityEnum.default(Severity.Error),
    maxWarnings: z.number().default(20),
  }).default({}),
  analyzers: z.object({
    security: z.object({
      enabled: z.boolean().default(true),
      severity: SeverityEnum.default(Severity.Error),
      customPatterns: z.array(z.object({
        name: z.string(),
        pattern: z.string(),
        severity: SeverityEnum,
      })).optional(),
    }).default({}),
    aiSmells: z.object({
      enabled: z.boolean().default(true),
      severity: SeverityEnum.default(Severity.Warning),
      commentRatio: z.number().min(0).max(1).default(0.4),
    }).default({}),
    conventions: z.object({
      enabled: z.boolean().default(true),
      severity: SeverityEnum.default(Severity.Warning),
      naming: z.object({
        functions: NamingConventionEnum.default('camelCase'),
        classes: NamingConventionEnum.default('PascalCase'),
        constants: NamingConventionEnum.default('UPPER_SNAKE'),
        files: NamingConventionEnum.default('kebab-case'),
      }).default({}),
      autoLearn: z.boolean().default(false),
      perLanguage: z.record(z.string(), PerLanguageNamingSchema).optional(),
    }).default({}),
    duplicates: z.object({
      enabled: z.boolean().default(false),
      severity: SeverityEnum.default(Severity.Warning),
      similarity: z.number().min(0).max(1).default(0.85),
    }).default({}),
    architecture: z.object({
      enabled: z.boolean().default(false),
      severity: SeverityEnum.default(Severity.Error),
      layers: z.array(z.object({
        name: z.string(),
        patterns: z.array(z.string()),
      })).default([]),
      rules: z.array(z.object({
        from: z.string(),
        allow: z.array(z.string()).optional(),
        deny: z.array(z.string()).optional(),
      })).default([]),
    }).default({}),
    impact: z.object({
      enabled: z.boolean().default(false),
      severity: SeverityEnum.default(Severity.Info),
      depth: z.number().min(1).max(10).default(2),
    }).optional(),
    taint: z.object({
      enabled: z.boolean().default(false),
      severity: SeverityEnum.default(Severity.Error),
      crossFile: z.boolean().default(false),
    }).optional(),
    dependencies: z.object({
      enabled: z.boolean().default(false),
      severity: SeverityEnum.default(Severity.Error),
    }).optional(),
    complexity: z.object({
      enabled: z.boolean().default(false),
      severity: SeverityEnum.default(Severity.Warning),
      maxCyclomatic: z.number().default(15),
      maxCognitive: z.number().default(20),
    }).optional(),
    iac: z.object({
      enabled: z.boolean().default(false),
      severity: SeverityEnum.default(Severity.Warning),
      dockerfile: z.boolean().default(true),
      kubernetes: z.boolean().default(true),
      actions: z.boolean().default(true),
    }).optional(),
    deadCode: z.object({
      enabled: z.boolean().default(false),
      severity: SeverityEnum.default(Severity.Warning),
      entryPoints: z.array(z.string()).optional(),
    }).optional(),
    coverage: z.object({
      enabled: z.boolean().default(false),
      severity: SeverityEnum.default(Severity.Warning),
      reportPath: z.string().default('coverage/lcov.info'),
      minCoverage: z.number().min(0).max(100).default(80),
      minNewCodeCoverage: z.number().min(0).max(100).default(90),
    }).optional(),
    licenses: z.object({
      enabled: z.boolean().default(false),
      severity: SeverityEnum.default(Severity.Warning),
      allowed: z.array(z.string()).default(['MIT', 'Apache-2.0', 'ISC', 'BSD-2-Clause', 'BSD-3-Clause']),
      denied: z.array(z.string()).default([]),
    }).optional(),
  }).default({}),
  llm: z.object({
    enabled: z.boolean().default(false),
    provider: z.enum(['openai', 'anthropic', 'gemini']).default('openai'),
    model: z.string().optional(),
    apiKey: z.string().optional(),
  }).default({}),
  qualityGate: z.object({
    maxNewErrors: z.number().default(0),
    maxNewWarnings: z.number().default(5),
    maxTotal: z.number().default(100),
  }).optional(),
  memory: z.object({
    enabled: z.boolean().default(false),
    autoLearn: z.boolean().default(false),
  }).optional(),
  fixes: z.object({
    ai: z.object({
      enabled: z.boolean().default(false),
      verify: z.boolean().default(true),
    }).optional(),
  }).optional(),
  rules: z.object({
    file: z.string().optional(),
    inline: z.array(z.string()).optional(),
    astgrep: z.string().optional(),
  }).optional(),
  dashboard: z.object({
    detailedHistory: z.boolean().default(false),
  }).optional(),
  workspaces: z.record(z.string(), z.any()).optional(),
});

export const DEFAULT_CONFIG: ArchGuardConfig = ConfigSchema.parse({});

export async function loadConfig(projectRoot: string): Promise<ArchGuardConfig> {
  const configPath = join(projectRoot, '.archguard.yml');

  try {
    const raw = await readFile(configPath, 'utf-8');
    const parsed = parseYaml(raw);
    return ConfigSchema.parse(parsed);
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return DEFAULT_CONFIG;
    }
    if (err instanceof z.ZodError) {
      const issues = err.issues.map(i => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
      throw new Error(`Invalid .archguard.yml:\n${issues}`);
    }
    throw err;
  }
}

export function generateDefaultConfig(): string {
  return `# Architecture Guardian configuration
version: 1
languages: [typescript, javascript, tsx, jsx]
include: ["src/**"]
exclude: ["**/*.test.ts", "**/*.spec.ts", "**/node_modules/**", "**/dist/**"]

severity:
  failOn: error
  maxWarnings: 20

analyzers:
  security:
    enabled: true
    severity: error
  aiSmells:
    enabled: true
    severity: warning
    commentRatio: 0.4
  conventions:
    enabled: true
    severity: warning
    naming:
      functions: camelCase
      classes: PascalCase
      constants: UPPER_SNAKE
      files: kebab-case
    autoLearn: false
  duplicates:
    enabled: false
    similarity: 0.85
  architecture:
    enabled: false
    layers: []
    rules: []
`;
}
