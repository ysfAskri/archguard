# Dependency vulnerability check

Check dependencies for known security vulnerabilities.

## Steps

1. Run: `npx archguardian scan --format json` (dependency scanner queries OSV)
2. Parse `dependency/known-vulnerability` findings
3. Show CVE ID, package, version, and severity for each vulnerability
4. Suggest upgrading vulnerable packages
