---
name: impact
description: Show downstream impact of current file changes using dependency analysis
user-invocable: true
allowed-tools: Bash, Read, Grep, Glob
---

# archguardian impact

Show the downstream impact of current file changes by analyzing the project's dependency graph.

## Instructions

1. Run the scan with the impact analyzer enabled:
   ```bash
   npx archguardian scan --format json $ARGUMENTS
   ```

2. Parse the JSON output and focus on the `impact/downstream-consumers` findings.

3. For each impacted file, explain:
   - Which changed file causes the impact
   - Which downstream files consume or depend on it
   - The type of dependency (import, re-export, interface implementation, etc.)
   - The risk level (how many transitive consumers are affected)

4. Summarize the total impact:
   - Number of directly affected files
   - Number of transitively affected files
   - Which modules or packages are impacted

5. Offer to generate a visual diagram of the impact chain:
   - Suggest running `/diagram` to see the full dependency structure
   - Or `/summarize` to get a Mermaid diagram of the change impact

## Tips

- Impact analysis works best when run on staged or uncommitted changes.
- If no changes are detected, suggest staging files first with `git add`.
- For large impact chains, recommend scoping the analysis to specific directories.
- Use this before merging PRs to understand the blast radius of changes.
