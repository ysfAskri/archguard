# archguardian coverage

## Goal
Integrate test coverage reports to flag uncovered code.

## Steps
1. Run tests with coverage: e.g., `npx vitest run --coverage`
2. Ensure `.archguard.yml` has `analyzers.coverage.enabled: true`
3. Configure `reportPath` (default: `coverage/lcov.info`)
4. Run: `npx archguardian scan --format json`
5. Filter for `coverage/*` findings
6. Write tests for uncovered new code
