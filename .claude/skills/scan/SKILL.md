---
name: scan
description: Run a full archguardian project scan, analyze results, and suggest fixes
user-invocable: true
allowed-tools: Bash, Read, Grep, Glob, Edit
---

# archguardian scan

Run a full project scan using archguardian and help the user understand and resolve findings.

## Instructions

1. Run the scan command:
   ```bash
   npx archguardian scan --format json $ARGUMENTS
   ```
2. Parse the JSON output and present findings grouped by severity (errors first, then warnings, then info).
3. For each finding, explain:
   - What the rule checks and why it matters
   - The specific code that triggered it
   - A concrete fix suggestion
4. If there are many findings, summarize the top issues and ask if the user wants to see details for a specific file or rule category.
5. If the user passed `--update-baseline` or `--baseline`, include those flags in the command.

## Tips

- If the scan returns 0 issues, congratulate the user.
- If there are suppressed or baseline counts in the output, mention them.
- Offer to run `/fix` for auto-fixable issues or `/suppress` for false positives.
- Offer to run `/baseline` if this is a first-time adoption with many existing findings.
