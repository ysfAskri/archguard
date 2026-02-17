Auto-fix archguardian findings (unused imports, naming violations).

1. Preview fixes first: `npx archguardian fix --dry-run --format json`
2. Show what will change (file, line, description)
3. Ask for confirmation before applying
4. Apply: `npx archguardian fix`
5. Re-scan to verify: `npx archguardian scan --format json`
6. Report before/after comparison

Supported fixes: unused import removal, naming convention renames.
For non-auto-fixable issues, suggest manual fixes or suppression.
