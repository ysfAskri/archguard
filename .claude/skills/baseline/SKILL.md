---
name: baseline
description: Create or update an archguardian baseline to adopt the tool on existing projects incrementally
user-invocable: true
allowed-tools: Bash, Read, Glob
---

# archguardian baseline

Manage the archguardian baseline file for incremental adoption.

## Instructions

Determine the user's intent from $ARGUMENTS (create, update, status, clear):

### Create / Update baseline

1. Run:
   ```bash
   npx archguardian scan --update-baseline --format json
   ```
2. Report how many findings were saved to `.archguard-baseline.json`.
3. Remind the user that future scans will only show NEW findings not in the baseline.
4. Suggest committing `.archguard-baseline.json` to version control.

### Custom baseline path

If the user specifies a path:
```bash
npx archguardian scan --update-baseline --baseline <path> --format json
```

### Check baseline status

1. Check if `.archguard-baseline.json` exists:
   ```bash
   ls -la .archguard-baseline.json
   ```
2. If it exists, read and summarize: how many findings, when generated, by which command.
3. Run a scan to show how many new vs baseline findings there are.

### Clear baseline

If the user wants to remove the baseline:
1. Confirm with the user first.
2. Delete `.archguard-baseline.json`.
3. Warn that the next scan will report all findings again.

## Tips

- Baseline matching uses `ruleId + file + message` (not line numbers), so it survives code edits that shift line numbers.
- Recommend creating a baseline when first adopting archguardian on a large existing codebase.
- The baseline should be updated periodically as tech debt is paid down.
