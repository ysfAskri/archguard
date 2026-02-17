# Manage archguardian baseline

Create or update a baseline for incremental adoption.

## Steps

1. Create/update: `npx archguardian scan --update-baseline --format json`
2. Report how many findings were saved to `.archguard-baseline.json`
3. Future scans only show NEW findings not in the baseline
4. Suggest committing `.archguard-baseline.json` to version control
5. To clear: confirm with user, then delete `.archguard-baseline.json`
