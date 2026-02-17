# archguardian complexity

Analyze function complexity. Run `npx archguardian scan --format json` with complexity analyzer enabled in `.archguard.yml`. Filter `complexity/*` findings. Explain cyclomatic (branch count) and cognitive (nesting-weighted) scores. Suggest refactoring: extract functions, early returns, reduce nesting. Default thresholds: cyclomatic 15, cognitive 20.
