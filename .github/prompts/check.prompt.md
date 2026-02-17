---
description: Check staged changes with archguardian before committing
agent: agent
tools:
  - terminal
---

1. Verify staged changes: `git diff --cached --stat`
2. Run `npx archguardian check --format json`
3. Present findings for staged files
4. For each finding: file, line, rule, explanation, fix
5. If clean, confirm ready to commit
