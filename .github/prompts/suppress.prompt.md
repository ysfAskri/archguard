---
description: Add archguard-ignore suppression comments
agent: agent
tools:
  - terminal
---

Add suppression comments for archguardian false positives:

- Same-line: `code(); // archguard-ignore-line security/xss`
- Next-line: `// archguard-ignore security/xss` above the line
- Python: `# archguard-ignore-line`

Prefer rule-specific over blanket suppression. Re-scan after to confirm.
