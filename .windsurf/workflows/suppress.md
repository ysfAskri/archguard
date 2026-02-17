# Suppress archguardian false positives

Add inline suppression comments.

## Steps

1. Identify the finding to suppress
2. Add rule-specific comment (preferred over blanket):
   - JS/TS same-line: `doSomething(); // archguard-ignore-line security/xss`
   - JS/TS next-line: `// archguard-ignore security/xss` above the line
   - Python: `# archguard-ignore-line security/xss`
3. Re-scan to confirm: `npx archguardian scan --format json`
4. If many false positives of same rule, suggest disabling in `.archguard.yml`
