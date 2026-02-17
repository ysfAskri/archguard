Show downstream impact of file changes using dependency analysis.

1. Run `npx archguardian scan --format json` (impact analyzer detects downstream consumers)
2. Parse `impact/downstream-consumers` findings
3. Explain which files are affected and the dependency chain
4. Offer `/diagram` for visual representation
