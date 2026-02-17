---
name: diagram
description: Generate architecture diagram of the project's dependency structure
user-invocable: true
allowed-tools: Bash, Read, Grep, Glob
---

# archguardian diagram

Generate a Mermaid architecture diagram showing the project's dependency structure.

## Instructions

1. Run the diagram command:
   ```bash
   npx archguardian diagram --format mermaid $ARGUMENTS
   ```

2. If the user specified a scope, include it:
   ```bash
   npx archguardian diagram --format mermaid --scope <glob>
   ```

3. Show the Mermaid diagram output to the user in a fenced code block:
   ```mermaid
   <output from command>
   ```

4. Explain the architecture layout shown in the diagram:
   - The main modules or packages and their boundaries
   - Key dependency directions (which modules depend on which)
   - Any circular dependencies or unexpected cross-layer imports
   - Entry points and leaf nodes in the dependency graph

5. If the diagram is very large or cluttered, suggest scope filtering:
   - `--scope "src/core/**"` — Focus on a specific module
   - `--scope "src/{core,analyzers}/**"` — Compare two modules
   - `--scope "**/*.ts"` — Filter by file type

## Tips

- The Mermaid output can be rendered in GitHub Markdown, Notion, or any Mermaid-compatible viewer.
- For monorepos, scope to individual packages to keep diagrams readable.
- Use this alongside `/impact` to understand how changes propagate through the architecture.
- Circular dependencies shown in the diagram are strong candidates for refactoring.
