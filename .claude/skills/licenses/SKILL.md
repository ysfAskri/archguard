---
name: licenses
description: Scan dependencies for license compliance
user-invocable: true
allowed-tools: Bash, Read, Grep, Glob, Edit
---

# archguardian licenses

Check dependency licenses against allowed/denied lists.

## Instructions

1. Run the scan with license checking enabled:
   ```bash
   npx archguardian scan --format json $ARGUMENTS
   ```
   Ensure `.archguard.yml` has `analyzers.licenses.enabled: true`.
2. Parse JSON output, filter for `license/*` rules.
3. For each finding, explain which dependency has an incompatible license.

## Tips

- Configure allowed licenses: `allowed: ["MIT", "Apache-2.0", "ISC", "BSD-*"]`
- Configure denied licenses: `denied: ["GPL-*", "AGPL-*"]`
- Supports glob patterns for license matching (e.g., `BSD-*` matches `BSD-2-Clause` and `BSD-3-Clause`).
- Fetches license info from npm registry and crates.io API.
