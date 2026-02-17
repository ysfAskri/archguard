# archguardian sbom

## Goal
Generate a Software Bill of Materials.

## Steps
1. Run: `npx archguardian sbom --format cyclonedx` (or `spdx`)
2. Review output: component count, ecosystems, PURLs
3. Save to file if needed: `npx archguardian sbom > sbom.json`
4. Supports: npm, Go, Rust, Java dependency manifests
