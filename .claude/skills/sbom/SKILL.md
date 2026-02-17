---
name: sbom
description: Generate Software Bill of Materials (CycloneDX or SPDX)
user-invocable: true
allowed-tools: Bash, Read
---

# archguardian sbom

Generate a Software Bill of Materials listing all project dependencies.

## Instructions

1. Run the SBOM command:
   ```bash
   npx archguardian sbom --format cyclonedx $ARGUMENTS
   ```
   Or use `--format spdx` for SPDX 2.3 format.
2. Present the output or save to a file.
3. Explain the SBOM contents: number of components, ecosystems covered.

## Tips

- Supports npm (package.json), Go (go.mod), Rust (Cargo.toml), and Java (pom.xml).
- CycloneDX 1.5 includes PURLs for each component.
- SPDX 2.3 is compatible with NTIA minimum SBOM requirements.
- Pipe output to a file: `npx archguardian sbom --format cyclonedx > sbom.json`
