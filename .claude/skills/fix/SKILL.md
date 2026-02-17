---
name: fix
description: Auto-fix archguardian findings like unused imports and naming violations
user-invocable: true
allowed-tools: Bash, Read, Glob, Edit
---

# archguardian fix

Auto-fix simple findings detected by archguardian.

## Instructions

1. First, run a dry-run to preview what would change:
   ```bash
   npx archguardian fix --dry-run --format json $ARGUMENTS
   ```

2. Show the user what fixes will be applied (file, line, what changes).

3. Ask for confirmation before applying.

4. If confirmed, run the actual fix:
   ```bash
   npx archguardian fix
   ```

5. After fixing, run a scan to verify the fixes resolved the issues:
   ```bash
   npx archguardian scan --format json
   ```

6. Report the before/after comparison.

## Supported Auto-Fixes

- **Unused imports**: Removes import statements for unused identifiers
- **Naming conventions**: Renames identifiers to match configured conventions (camelCase, PascalCase, etc.)
- **AI-powered fixes**: Use `--ai` to enable LLM-powered fixes for any rule, including security issues and architecture violations that don't have built-in fixers

## Tips

- Always preview with `--dry-run` first.
- Use `--ai` to enable LLM-powered fixes for any rule, including those without built-in fixers.
- Use `--verify` to re-analyze after fixing to confirm the fix actually resolved the issue.
- For findings that can't be auto-fixed (and `--ai` is not available), suggest manual fixes or suppression comments.
