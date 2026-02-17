# archguardian licenses

## Goal
Check dependency licenses for compliance.

## Steps
1. Ensure `.archguard.yml` has `analyzers.licenses.enabled: true`
2. Configure allowed/denied lists with SPDX identifiers and glob patterns
3. Run: `npx archguardian scan --format json`
4. Filter for `license/incompatible-license` findings
5. Review flagged dependencies and find compliant alternatives if needed
