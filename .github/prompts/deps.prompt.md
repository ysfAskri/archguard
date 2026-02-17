---
description: Check dependencies for known vulnerabilities
agent: agent
tools:
  - terminal
---

1. Run `npx archguardian scan --format json` for dependency scan
2. Parse `dependency/known-vulnerability` findings
3. Show CVE details and suggest upgrades
