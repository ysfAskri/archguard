---
name: deps
description: Check project dependencies for known security vulnerabilities
user-invocable: true
allowed-tools: Bash, Read, Grep, Glob
---

# archguardian deps

Check project dependencies for known security vulnerabilities using the dependency scanner.

## Instructions

1. Run the scan with the dependency scanner enabled:
   ```bash
   npx archguardian scan --format json $ARGUMENTS
   ```

2. Parse the JSON output and focus on `dependency/known-vulnerability` findings.

3. For each vulnerability found, present:
   - **Package**: The affected dependency name and installed version
   - **CVE**: The CVE identifier (e.g., CVE-2024-12345)
   - **Severity**: Critical, High, Medium, or Low
   - **Description**: What the vulnerability allows (RCE, XSS, data leak, etc.)
   - **Fixed in**: The version that patches the vulnerability (if available)

4. Prioritize findings by severity (Critical first, then High, Medium, Low).

5. For each vulnerable package, suggest the upgrade path:
   - Direct dependency: `npm install <package>@<fixed-version>`
   - Transitive dependency: Identify which direct dependency pulls it in and suggest upgrading that instead
   - If no fix is available, suggest alternatives or mitigations

6. After presenting all findings, summarize:
   - Total vulnerabilities by severity
   - How many have available fixes
   - Recommended upgrade commands

## Tips

- Run this regularly and before releases to catch newly disclosed vulnerabilities.
- Pair with `/gate` to enforce zero critical vulnerabilities as a quality gate threshold.
- For transitive dependencies, use `npm ls <package>` to trace the dependency chain.
- If a vulnerability is a false positive or not applicable, use `/dismiss` to exclude it from future scans.
