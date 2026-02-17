# Quality gate check

Run scan with quality gate thresholds.

## Steps

1. Run: `npx archguardian scan --format json --quality-gate`
2. Parse quality gate result (passed/failed)
3. Show each threshold failure (new errors, warnings, total)
4. Suggest config adjustments in `.archguard.yml` if needed
