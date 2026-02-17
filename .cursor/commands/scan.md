Run a full archguardian project scan and help the user understand findings.

1. Run `npx archguardian scan --format json`
2. Parse findings grouped by severity (errors > warnings > info)
3. For each finding: explain the rule, show the code, suggest a fix
4. If many findings, summarize top issues first
5. Offer `/fix` for auto-fixable issues, `/suppress` for false positives
6. If first-time adoption, suggest `/baseline` to snapshot current state
