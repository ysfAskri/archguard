Check dependencies for known security vulnerabilities.

1. Run `npx archguardian scan --format json` (dependency scanner queries OSV database)
2. Parse `dependency/known-vulnerability` findings
3. Show CVE ID, affected package, version, severity
4. Suggest version upgrades for vulnerable packages
