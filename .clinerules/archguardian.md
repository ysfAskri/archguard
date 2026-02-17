# archguardian

Pre-commit hook and CLI that catches security issues, AI-generated code smells, naming convention violations, code duplication, and architecture layer breaches. Works with TypeScript, JavaScript, Python, Go, Rust, and Java.

## Project structure

```
src/
├── cli/          Commander.js entry, 8 commands, output formatters (terminal, JSON, SARIF)
├── core/         Pipeline orchestrator, config loader, diff parser, suppression directives, baseline mode, types
├── parsers/      ast-grep NAPI parser (TS/JS/Python/Go/Rust/Java) + AST utilities
├── analyzers/    Security, AI smells, conventions, duplicates, layer violations
├── plugins/      Dynamic plugin loader for external analyzers
├── llm/          LLM client (OpenAI, Anthropic, Gemini), prompt builder, file-based cache
├── fixers/       Auto-fix engine (remove unused imports, rename conventions)
├── metrics/      Run history tracker (.archguard/metrics.json)
├── hooks/        Git hook installer (direct + Husky)
└── utils/        Git operations, logging, perf timing
```

## Build & test

- `npm run build` — tsup → dist/
- `npm test` — vitest (165 tests across unit, integration, e2e)
- `npm run typecheck` — tsc --noEmit

## Key conventions

- ESM-only (`"type": "module"`), all imports use `.js` extensions
- Node >= 18 required
- AST parsing via ast-grep NAPI (native tree-sitter bindings, not WASM)
- Tests in `tests/unit/`, `tests/integration/`, `tests/e2e/` using vitest
- Config file: `.archguard.yml` validated with Zod schemas
- Pipeline: analyzers run in parallel → deduplicate → suppress inline → filter baseline → optional LLM enhance

## CLI commands

```
archguardian init                                                          Create config + install git hook
archguardian check [--format] [--update-baseline] [--quality-gate] [--ci github]  Analyze staged changes
archguardian scan  [--format] [--update-baseline] [--quality-gate] [--ci github]  Analyze full project
archguardian fix   [--dry-run] [--ai] [--verify]                           Auto-fix simple findings
archguardian learn [--apply]                                               Infer conventions from codebase
archguardian rules [--json]                                                List all built-in rules
archguardian metrics [--json]                                              Show findings trend
archguardian dashboard [--port]                                            Open web dashboard
archguardian dismiss <ruleId> [--pattern] [--file]                         Dismiss finding pattern from future scans
archguardian summarize [--format mermaid|text]                             Generate visual change summary
archguardian diagram  [--format mermaid|text] [--scope]                    Generate architecture diagram
```

## Common workflows

### Scan project
Run `npx archguardian scan --format json`, parse findings by severity, explain each finding and suggest a fix.

### Check staged changes
Run `npx archguardian check --format json` before committing. If findings exist, offer fixes or suppression.

### Auto-fix
Preview with `npx archguardian fix --dry-run`, confirm, then apply with `npx archguardian fix`.

### Baseline for incremental adoption
Create: `npx archguardian scan --update-baseline`. Future scans only show new findings.
Matching uses `ruleId + file + message` (not line numbers) — survives code edits.

### Suppress false positives
```js
// archguard-ignore                    — suppress all rules on next line
// archguard-ignore security/xss       — suppress specific rule on next line
doSomething(); // archguard-ignore-line — suppress all rules on same line
```
Python uses `#`, block comments `/* */` also work. Prefer rule-specific over blanket suppression.

## New workflows

### Dismiss findings
Run `npx archguardian dismiss <ruleId> --pattern "message"` or `--file "src/**/*.ts"`. Dismissed patterns stored in `.archguard/memory.json`.

### Quality gates
Run `npx archguardian scan --quality-gate`. Enforces thresholds: `maxNewErrors`, `maxNewWarnings`, `maxTotal` from `.archguard.yml`.

### Impact analysis
Run scan to see `impact/downstream-consumers` findings showing which files are affected by changes.

### Visual summaries
Run `npx archguardian summarize --format mermaid` for staged change impact diagrams.
Run `npx archguardian diagram --format mermaid --scope src/` for architecture diagrams.

### Dependency scanning
Scan detects `dependency/known-vulnerability` findings using the OSV database for package.json/go.mod/Cargo.toml/pom.xml.

### AI-powered fixes
Run `npx archguardian fix --ai --verify` to use LLM for fixing any finding, with automatic verification.

## Additional capabilities

### New analyzers

- **Complexity** — Analyzes cyclomatic and cognitive complexity of functions. Enable with `analyzers.complexity.enabled: true`. Default thresholds: cyclomatic 15, cognitive 20. Findings use `complexity/*` rule IDs.
- **Dead code** — Detects unused exports that may indicate dead code. Enable with `analyzers.deadCode.enabled: true`. Configure `entryPoints` for legitimate entry files. Findings use `dead-code/*` rule IDs.
- **IaC** — Scans Dockerfiles, Kubernetes manifests, and GitHub Actions for security misconfigurations. Enable with `analyzers.iac.enabled: true`. Findings use `iac/*` rule IDs.
- **Coverage** — Integrates existing test coverage reports (lcov, Istanbul JSON) to flag uncovered code. Enable with `analyzers.coverage.enabled: true`. Configure `reportPath` and `minCoverage` (default 80%). Findings use `coverage/*` rule IDs.
- **Licenses** — Checks dependency licenses against allowed/denied lists with glob pattern matching. Enable with `analyzers.licenses.enabled: true`. Fetches license data from npm registry and crates.io. Findings use `license/*` rule IDs.

### New commands

- **SBOM** — Generate a Software Bill of Materials. Run `npx archguardian sbom --format cyclonedx` (or `--format spdx`). Supports npm, Go, Rust, and Java dependency manifests. Outputs CycloneDX 1.5 or SPDX 2.3 with PURLs.

### New flags

- `--post-to-pr` — Available on `check`, `scan`, and `summarize` commands. Posts findings as inline review comments on a GitHub PR. Requires `GITHUB_TOKEN` environment variable.

### Workspace config support

- Monorepo support via `workspaces` config with glob-based overrides in `.archguard.yml`. Each workspace can have its own analyzer settings and thresholds.
