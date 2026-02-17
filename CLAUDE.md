# archguardian

Pre-commit hook and CLI that catches security issues, AI-generated code smells, naming convention violations, code duplication, architecture layer breaches, complexity metrics, dead code, IaC misconfigurations, and license compliance. Works with TypeScript, JavaScript, Python, Go, Rust, and Java.

## Project structure

```
src/
├── cli/          Commander.js entry, 12 commands (init, check, scan, fix, learn, rules, metrics, dashboard, dismiss, summarize, diagram, sbom), output formatters (terminal, JSON, SARIF)
├── core/         Pipeline orchestrator, config loader, diff parser, suppression directives, baseline mode, workspace resolver, dependency collector, types
├── parsers/      ast-grep NAPI parser (TS/JS/Python/Go/Rust/Java) + AST utilities
├── analyzers/    Security, AI smells, conventions, duplicates, layer violations, complexity, IaC, dead code, coverage, licenses, structural rules, taint (with cross-file)
├── plugins/      Dynamic plugin loader for external analyzers
├── llm/          LLM client (OpenAI, Anthropic, Gemini), prompt builder, file-based cache
├── fixes/        Auto-fix engine (remove unused imports, rename conventions)
├── metrics/      Run history tracker (.archguard/metrics.json)
├── hooks/        Git hook installer (direct + Husky)
├── ci/           GitHub annotator + PR review bot + PR summary commenter
└── utils/        Git operations, logging, perf timing
```

## Build & test

```bash
npm run build       # tsup → dist/
npm test            # vitest (273 tests)
npm run typecheck   # tsc --noEmit
```

## Key conventions

- ESM-only (`"type": "module"` in package.json), all imports use `.js` extensions
- Node >= 18 required
- AST parsing via ast-grep NAPI (native tree-sitter bindings, not WASM)
- Tests in `tests/unit/`, `tests/integration/`, `tests/e2e/` using vitest
- Config file: `.archguard.yml` validated with Zod schemas
- Pipeline: analyzers run in parallel with 5s timeout each, findings are deduplicated, then suppressed, then optionally enhanced by LLM
- Monorepo support via `workspaces` config with glob-based overrides

## Available skills

- `/scan` — Run full project scan and analyze results (supports `--post-to-pr`)
- `/check` — Analyze staged changes before committing (supports `--post-to-pr`)
- `/fix` — Auto-fix findings (unused imports, naming, or any finding with `--ai`)
- `/baseline` — Create/update baseline for incremental adoption
- `/suppress` — Add inline suppression comments for false positives
- `/setup` — Initialize archguardian in a new project
- `/dismiss` — Dismiss finding patterns from future scans (stored in `.archguard/memory.json`)
- `/summarize` — Generate visual change summary (supports mermaid and text formats, `--post-to-pr`)
- `/diagram` — Generate architecture diagram (supports mermaid and text formats, scoped by directory)
- `/gate` — Run quality gate checks enforcing `maxNewErrors`, `maxNewWarnings`, `maxTotal` thresholds
- `/impact` — Analyze downstream impact of changes (`impact/downstream-consumers` findings)
- `/deps` — Scan dependencies for known vulnerabilities via OSV database (package.json/go.mod/Cargo.toml/pom.xml)
- `/complexity` — Analyze cyclomatic and cognitive complexity of functions
- `/dead-code` — Detect unused exports and dead code
- `/sbom` — Generate Software Bill of Materials (CycloneDX 1.5 or SPDX 2.3)
- `/iac` — Scan Dockerfiles, Kubernetes manifests, and GitHub Actions for security issues
- `/licenses` — Check dependency licenses against allowed/denied lists
- `/coverage` — Integrate test coverage reports and flag uncovered code
