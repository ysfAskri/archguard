# Scan project with archguardian

Run a full code quality scan and help resolve findings.

## Steps

1. Run the scan: `npx archguardian scan --format json`
2. Parse findings grouped by severity (errors first, then warnings)
3. For each finding, explain the rule, show the offending code, and suggest a fix
4. If many findings exist, summarize top issues and ask which to dive into
5. Offer to auto-fix with `/fix` or suppress false positives with `/suppress`
6. For first-time adoption with many findings, suggest `/baseline`

## Additional options

- Add `--quality-gate` to enforce quality gate thresholds (see `/gate`)
- Add `--ci github` to output findings as GitHub Actions annotations
