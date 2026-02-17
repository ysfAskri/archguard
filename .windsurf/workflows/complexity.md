# archguardian complexity

## Goal
Analyze function complexity metrics to identify hard-to-maintain code.

## Steps
1. Ensure `.archguard.yml` has `analyzers.complexity.enabled: true`
2. Run: `npx archguardian scan --format json`
3. Filter findings for `complexity/*` rules
4. For each finding:
   - Identify the function and its cyclomatic/cognitive score
   - Explain what contributes to complexity (nesting, branching, logical operators)
   - Suggest refactoring: extract helpers, use early returns, simplify conditions
5. Configure thresholds: `maxCyclomatic` (default 15), `maxCognitive` (default 20)
