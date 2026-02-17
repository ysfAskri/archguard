---
description: Create archguardian baseline for incremental adoption
agent: agent
tools:
  - terminal
---

1. Run `npx archguardian scan --update-baseline --format json`
2. Report how many findings were saved to `.archguard-baseline.json`
3. Explain that future scans only show NEW findings
4. Suggest committing the baseline file to version control
