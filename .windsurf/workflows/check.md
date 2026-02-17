# Check staged changes with archguardian

Analyze staged git changes before committing.

## Steps

1. Verify staged changes: `git diff --cached --stat`
2. If nothing staged, ask the user to stage files first
3. Run: `npx archguardian check --format json`
4. Present findings for staged files only
5. For each finding: file, line, rule, explanation, fix suggestion
6. If clean, confirm ready to commit
7. For intentional exceptions: `// archguard-ignore-line <rule-id>`
