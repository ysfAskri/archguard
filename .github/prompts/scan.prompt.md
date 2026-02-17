---
description: Run a full archguardian code quality scan
agent: agent
tools:
  - terminal
---

Run `npx archguardian scan --format json` and analyze the results.

1. Parse findings grouped by severity (errors > warnings > info)
2. For each finding: explain the rule, show the code, suggest a fix
3. If many findings, summarize top issues first
4. Offer to auto-fix or suppress false positives
