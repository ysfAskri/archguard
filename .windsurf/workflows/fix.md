# Auto-fix archguardian findings

Fix unused imports and naming violations automatically.

## Steps

1. Preview: `npx archguardian fix --dry-run --format json`
2. Show what will change (file, line, description)
3. Ask for confirmation
4. Apply: `npx archguardian fix`
5. Verify: `npx archguardian scan --format json`
6. Report before/after comparison

## Additional options

- Add `--ai` to use LLM-powered fixes for complex findings
- Add `--verify` to re-scan after fixing and confirm all issues are resolved
