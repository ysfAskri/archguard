---
description: Auto-fix archguardian findings
agent: agent
tools:
  - terminal
---

1. Preview fixes: `npx archguardian fix --dry-run --format json`
2. Show what will change
3. Ask for confirmation
4. Apply: `npx archguardian fix`
5. Verify: `npx archguardian scan --format json`
6. Report before/after comparison
