# Initialize archguardian

Set up archguardian in the current project.

## Steps

1. Check if already configured: look for `.archguard.yml`
2. If not configured: `npx archguardian init`
3. Walk through settings: languages, include/exclude, analyzers, severity
4. Customize `.archguard.yml` based on project needs
5. Run initial scan: `npx archguardian scan --format json`
6. If many findings, create baseline: `npx archguardian scan --update-baseline`
7. Confirm pre-commit hook is installed
