---
name: setup
description: Initialize archguardian in a project with config and git hooks
user-invocable: true
allowed-tools: Bash, Read, Edit, Glob
---

# archguardian setup

Initialize archguardian in the current project.

## Instructions

1. Check if archguardian is already installed:
   ```bash
   ls .archguard.yml 2>/dev/null && echo "EXISTS" || echo "NOT_FOUND"
   ```

2. If already configured, read `.archguard.yml` and summarize the current settings. Ask if the user wants to reconfigure.

3. If not configured, run init:
   ```bash
   npx archguardian init
   ```

4. After init, read the generated `.archguard.yml` and walk the user through key settings:
   - **Languages**: Which languages to analyze
   - **Include/Exclude**: Which directories to scan
   - **Analyzers**: Which are enabled and their thresholds
   - **Severity**: What blocks commits vs what just warns

5. Ask if they want to customize anything based on their project. Apply edits to `.archguard.yml` as needed.

6. Run a quick scan to show the initial state:
   ```bash
   npx archguardian scan --format json
   ```

7. If there are many findings, suggest creating a baseline:
   ```bash
   npx archguardian scan --update-baseline
   ```

8. Remind the user that the pre-commit hook is now installed and will run `archguardian check` automatically on every commit.

## Tips

- For monorepos, adjust the `include` patterns to target specific packages.
- The `severity.maxWarnings` setting controls how many warnings are allowed before blocking a commit.
- Suggest starting with security enabled and other analyzers at warning level, then tightening over time.
