---
name: check
description: Analyze staged git changes with archguardian before committing
user-invocable: true
allowed-tools: Bash, Read, Grep, Glob, Edit
---

# archguardian check

Analyze only the staged git changes to catch issues before they are committed.

## Instructions

1. Verify there are staged changes:
   ```bash
   git diff --cached --stat
   ```
   If nothing is staged, tell the user and suggest staging files first.

2. Run the check command:
   ```bash
   npx archguardian check --format json $ARGUMENTS
   ```

3. Parse the JSON output and present findings, focusing only on the staged files.

4. For each finding:
   - Show the file, line, and rule
   - Explain what's wrong and how to fix it
   - Offer to apply the fix directly

5. If all checks pass, tell the user they're clear to commit.

## Tips

- This is the same analysis that runs in the pre-commit hook.
- If the user wants to commit despite warnings, suggest using `// archguard-ignore-line` for intentional exceptions.
- Offer `/fix --dry-run` to preview auto-fixes before applying.
