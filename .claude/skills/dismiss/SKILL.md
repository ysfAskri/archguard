---
name: dismiss
description: Dismiss a finding pattern from future archguardian scans
user-invocable: true
allowed-tools: Bash, Read, Grep, Glob
---

# archguardian dismiss

Dismiss a finding pattern so it no longer appears in future archguardian scans.

## Instructions

1. Run the dismiss command with the specified rule ID:
   ```bash
   npx archguardian dismiss <ruleId> $ARGUMENTS
   ```

2. If the user wants to scope the dismissal, add optional flags:
   - `--pattern "message"` — Dismiss only findings matching a specific message pattern
   - `--file "glob"` — Dismiss only findings in files matching the glob pattern

   Example:
   ```bash
   npx archguardian dismiss security/xss --pattern "innerHTML assignment" --file "src/legacy/**"
   ```

3. After dismissing, show the user what was dismissed:
   - The rule ID that was dismissed
   - Any pattern or file scope that was applied
   - How many existing findings this would suppress

4. Mention that dismissed findings are stored in `.archguard/memory.json` and can be reviewed or removed later.

5. If the user wants to see current dismissals:
   ```bash
   cat .archguard/memory.json
   ```

## Tips

- Dismissed patterns persist across scans and are stored in `.archguard/memory.json`.
- To undo a dismissal, the user can edit `.archguard/memory.json` directly or run the dismiss command again with `--remove`.
- Prefer scoped dismissals (`--pattern` or `--file`) over blanket rule dismissals to keep coverage high.
- If the finding is a one-off false positive, suggest using `/suppress` with an inline comment instead.
