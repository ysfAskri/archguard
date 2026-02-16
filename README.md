<p align="center">
  <img src=".github/banner.svg" alt="archguardian" width="600">
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/archguardian"><img src="https://img.shields.io/npm/v/archguardian?style=flat-square&color=6366f1&label=npm" alt="npm"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="license"></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/node-%E2%89%A518-339933?style=flat-square" alt="node"></a>
</p>

---

**archguardian** is a pre-commit hook and CLI that catches security issues, AI-generated code smells, and naming convention violations in TypeScript and JavaScript — before they reach your repo.

```bash
npx archguardian init    # adds config + git hook
npx archguardian scan    # scans full project
git commit               # hook runs automatically
```

<br>

<p align="center">
  <img src=".github/demo.svg" alt="archguardian demo" width="780">
</p>

<br>

## Why

AI coding tools generate code fast but introduce patterns that compound into debt:

- **Hardcoded secrets** that slip through review
- **Excessive comments** that restate what the code already says
- **Unused imports** from autocomplete suggestions that were never cleaned up
- **`as any` casts** and non-null assertions used to silence the type checker
- **SQL injection and XSS vectors** in generated snippets
- **Inconsistent naming** across files written by different tools

archguardian runs in <1 second on typical diffs. It uses [tree-sitter](https://tree-sitter.github.io/) WASM for real AST parsing — not regex.

## What it checks

<table>
<tr>
<td valign="top" width="33%">

**Security**
- Hardcoded secrets (11 patterns: AWS, GitHub, Slack, Stripe, Google, JWTs, DB URLs)
- SQL injection via template literals and string concat
- XSS: `innerHTML`, `dangerouslySetInnerHTML`, `document.write`
- `eval()` / `Function()` usage
- ReDoS-prone regex
- Custom patterns via config

</td>
<td valign="top" width="33%">

**AI smells**
- Comment-to-code ratio above threshold
- Unused imports (AST-verified)
- Catch blocks larger than try blocks
- Duplicate code blocks in the same diff
- `as any` type assertions
- Excessive `!` non-null operators

</td>
<td valign="top" width="33%">

**Conventions**
- Functions: `camelCase`
- Classes / interfaces: `PascalCase`
- Constants: `UPPER_SNAKE`
- Files: `kebab-case`
- All configurable per project

</td>
</tr>
</table>

## Configuration

`archguardian init` creates `.archguard.yml` in your project root:

```yaml
version: 1
languages: [typescript, javascript, tsx, jsx]
include: ["src/**"]
exclude: ["**/*.test.ts", "**/node_modules/**"]

severity:
  failOn: error       # error | warning | info
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
    naming:
      functions: camelCase
      classes: PascalCase
      constants: UPPER_SNAKE
      files: kebab-case
```

## CLI

```
archguardian init       Create .archguard.yml + install git hook
archguardian check      Analyze staged changes (pre-commit mode)
archguardian scan       Analyze full project
archguardian learn      Infer conventions from codebase (v0.2.0)
```

Exit codes: `0` pass, `1` errors, `2` warnings exceeded, `3` config error, `5` timeout.

## How it works

```
git commit
    |
    v
 Parse staged diff ──> Filter files ──> AST parse (tree-sitter WASM)
                                              |
                                              v
                                    Run analyzers in parallel
                                     (5s timeout per analyzer)
                                              |
                                              v
                                    Aggregate + deduplicate
                                              |
                                    ┌─────────┴─────────┐
                                    v                     v
                               0 findings            findings > 0
                               commit OK             commit blocked
```

Only **changed lines** are checked in pre-commit mode — no noise from existing code.

## Roadmap

| Version | What's coming |
|:--------|:--------------|
| **v0.2.0** | Duplicate detection, layer violation checks, Python support, `archguardian learn`, JSON output |
| **v0.3.0** | Plugin system, LLM-powered suggestions, SARIF output, GitHub Action |
| **v1.0.0** | VS Code extension, auto-fix, Go/Rust/Java support |

## Contributing

```bash
git clone https://github.com/ysfAskri/archguard.git
cd archguard && npm install
npm test           # 38 tests
npm run build      # builds to dist/
```

<details>
<summary>Project structure</summary>

```
src/
├── cli/          Commander.js entry + init, check, scan commands
├── core/         Pipeline, config loader, diff parser, types
├── parsers/      Tree-sitter WASM manager + AST utilities
├── analyzers/    Security scanner, AI smell detector, convention enforcer
├── hooks/        Git hook installer (direct + Husky)
└── utils/        Git operations, logging, perf timing
```

</details>

## License

[MIT](LICENSE)

---

<p align="center">
  <sub>Built by <a href="https://github.com/ysfAskri">Youssef ASKRI</a></sub>
</p>
