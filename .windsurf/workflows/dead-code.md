# archguardian dead-code

## Goal
Detect unused exports that indicate dead code.

## Steps
1. Ensure `.archguard.yml` has `analyzers.deadCode.enabled: true`
2. Run: `npx archguardian scan --format json`
3. Filter for `dead-code/unused-export` findings
4. Verify exports are truly unused (check if used outside analyzed scope)
5. Configure `entryPoints` for legitimate entry files like `src/index.ts`
