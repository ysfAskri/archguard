Add archguard-ignore suppression comments to silence false positives.

1. Scan first if no specific finding given: `npx archguardian scan --format json`
2. Use rule-specific suppression over blanket:
   - Same-line: `doSomething(); // archguard-ignore-line security/xss`
   - Next-line: `// archguard-ignore security/xss` above the line
   - Python: `# archguard-ignore-line`
   - Block: `/* archguard-ignore */`
3. After adding, re-scan to confirm: `npx archguardian scan --format json`
4. If many false positives of the same rule, suggest disabling it in `.archguard.yml`
