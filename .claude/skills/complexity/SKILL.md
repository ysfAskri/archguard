---
name: complexity
description: Analyze cyclomatic and cognitive complexity of functions
user-invocable: true
allowed-tools: Bash, Read, Grep, Glob, Edit
---

# archguardian complexity

Analyze function complexity metrics using archguardian.

## Instructions

1. Run the scan with complexity enabled:
   ```bash
   npx archguardian scan --format json $ARGUMENTS
   ```
   Ensure `.archguard.yml` has `analyzers.complexity.enabled: true`.
2. Parse JSON output, filter for `complexity/*` rules.
3. For each finding, explain:
   - The function name and its cyclomatic/cognitive score
   - What makes the function complex (nested conditionals, loops, logical operators)
   - How to refactor: extract helper functions, use early returns, simplify branching

## Tips

- Default thresholds: cyclomatic 15, cognitive 20. Configure in `.archguard.yml`.
- Suggest breaking complex functions into smaller, focused functions.
- Cognitive complexity weighs nesting depth, so deeply nested code scores higher.
