Create or update an archguardian baseline for incremental adoption.

- **Create/Update**: `npx archguardian scan --update-baseline --format json`
- **Custom path**: add `--baseline <path>` flag
- **Status**: read `.archguard-baseline.json`, summarize, run scan to compare
- **Clear**: confirm with user first, then delete `.archguard-baseline.json`

Baseline matching uses `ruleId + file + message` (not line numbers) — survives code edits.
Recommend committing `.archguard-baseline.json` to version control.
