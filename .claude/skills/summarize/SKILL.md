---
name: summarize
description: Generate a visual change summary with impact diagram
user-invocable: true
allowed-tools: Bash, Read, Grep, Glob
---

# archguardian summarize

Generate a visual summary of current changes and their impact across the project.

## Instructions

1. Run the summarize command:
   ```bash
   npx archguardian summarize --format mermaid $ARGUMENTS
   ```

2. If the command fails because there are no staged changes, tell the user:
   - Suggest staging files first with `git add`
   - Or specify files manually with `--files <glob>`

3. Show the Mermaid diagram output to the user in a fenced code block:
   ```mermaid
   <output from command>
   ```

4. Explain the impact chain shown in the diagram:
   - Which files were changed (source nodes)
   - Which files are directly affected (first-level dependents)
   - Which files are transitively affected (downstream consumers)
   - The overall blast radius of the changes

5. Highlight any high-risk impacts:
   - Changes affecting many downstream consumers
   - Changes touching shared utilities or core modules
   - Changes crossing module or package boundaries

## Tips

- The Mermaid diagram can be pasted into GitHub PR descriptions for visual context.
- For large projects, the diagram may be very wide — suggest scoping with `--scope <glob>` if needed.
- Pair with `/gate` to check if the changes meet quality thresholds.
- Pair with `/check` to see specific findings in the changed files.
