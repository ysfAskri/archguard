Analyze staged git changes with archguardian before committing.

1. Verify staged changes exist: `git diff --cached --stat`
2. If nothing staged, tell the user to stage files first
3. Run `npx archguardian check --format json`
4. Present findings focused on staged files
5. For each finding: show file, line, rule, explain, offer to fix
6. If all checks pass, confirm clear to commit
7. For intentional exceptions, suggest `// archguard-ignore-line <rule-id>`

Use `--quality-gate` to enforce thresholds and fail on violations.
Use `--ci github` for GitHub Actions integration with inline annotations.
