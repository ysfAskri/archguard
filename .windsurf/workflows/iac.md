# archguardian iac

## Goal
Scan infrastructure-as-code for security misconfigurations.

## Steps
1. Ensure `.archguard.yml` has `analyzers.iac.enabled: true`
2. Run: `npx archguardian scan --format json`
3. Filter findings for `iac/*` rules
4. Address each finding:
   - Dockerfile: add USER, pin versions, avoid curl|bash, use COPY over ADD
   - Kubernetes: disable privileged mode, add resource limits, pin image tags
   - GitHub Actions: use environment variables instead of github.event in run blocks, pin actions to SHA
