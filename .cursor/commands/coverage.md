# archguardian coverage

Integrate test coverage reports. Run `npx archguardian scan --format json` with `analyzers.coverage.enabled: true`. Reads lcov or Istanbul JSON. Flags files below `minCoverage` threshold and uncovered new code above `minNewCodeCoverage`.
