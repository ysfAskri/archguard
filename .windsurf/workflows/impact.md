# Show downstream impact

Show downstream impact of file changes using dependency analysis.

## Steps

1. Run: `npx archguardian scan --format json` to detect impact findings
2. Parse `impact/downstream-consumers` findings
3. Explain which files are affected and the dependency chain
4. Offer `/diagram` for a visual representation of the impact
