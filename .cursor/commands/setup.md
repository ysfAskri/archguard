Initialize archguardian in the current project.

1. Check if already configured: `ls .archguard.yml`
2. If not configured, run `npx archguardian init`
3. Walk through key settings: languages, include/exclude, analyzers, severity
4. Ask if user wants to customize anything, apply edits to `.archguard.yml`
5. Run initial scan: `npx archguardian scan --format json`
6. If many findings, suggest baseline: `npx archguardian scan --update-baseline`
7. Confirm pre-commit hook is installed and active
