---
name: gate
description: Run archguardian scan with quality gate thresholds
user-invocable: true
allowed-tools: Bash, Read, Grep, Glob
---

# archguardian gate

Run an archguardian scan with quality gate enforcement to check if the project meets configured thresholds.

## Instructions

1. Run the scan with quality gate enabled:
   ```bash
   npx archguardian scan --format json --quality-gate $ARGUMENTS
   ```

2. Parse the JSON output and check the quality gate result:
   - **passed**: All thresholds are met
   - **failed**: One or more thresholds were exceeded

3. If the quality gate passed, congratulate the user and show the threshold margins.

4. If the quality gate failed, for each threshold failure explain:
   - Which metric failed (e.g., max errors, max warnings, max duplicates)
   - The configured threshold vs the actual value
   - Which findings contribute most to the failure
   - Concrete steps to get below the threshold

5. If the user wants to adjust thresholds, guide them to update `.archguard.yml`:
   ```yaml
   qualityGate:
     maxErrors: 0
     maxWarnings: 10
     maxDuplicates: 5
   ```

## Tips

- Quality gates are ideal for CI pipelines — use `--ci github` to get GitHub Actions annotation output.
- If gates are too strict for a new project, suggest creating a `/baseline` first and tightening thresholds gradually.
- If gates are too lenient, recommend lowering thresholds incrementally to drive continuous improvement.
- The exit code is non-zero when the quality gate fails, making it usable in CI scripts.
