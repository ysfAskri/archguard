---
description: Show downstream impact of file changes
agent: agent
tools:
  - terminal
---

1. Run `npx archguardian scan --format json` to get impact findings
2. Parse `impact/downstream-consumers` results
3. Show affected files and dependency chains
