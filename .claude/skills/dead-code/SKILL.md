---
name: dead-code
description: Detect unused exports and dead code
user-invocable: true
allowed-tools: Bash, Read, Grep, Glob, Edit
---

# archguardian dead-code

Detect unused exports that may indicate dead code.

## Instructions

1. Run the scan with dead code detection enabled:
   ```bash
   npx archguardian scan --format json $ARGUMENTS
   ```
   Ensure `.archguard.yml` has `analyzers.deadCode.enabled: true`.
2. Parse JSON output, filter for `dead-code/*` rules.
3. For each finding, explain which export is unused and from which file.
4. Suggest removal or check if the export is used outside the analyzed scope.

## Tips

- Configure `entryPoints` in config to mark files that shouldn't be flagged.
- Test files are automatically excluded.
- Files named `index.*` or `main.*` are treated as entry points by default.
