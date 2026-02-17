# Dismiss finding pattern

Dismiss a finding pattern from future archguardian scans.

## Steps

1. Run: `npx archguardian dismiss <ruleId>` with optional `--pattern "msg"` or `--file "glob"`
2. Confirm what was dismissed (rule, pattern, scope)
3. Patterns are stored in `.archguard/memory.json`
4. To undo, edit or remove the entry from `.archguard/memory.json`
