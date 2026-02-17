---
name: iac
description: Scan Dockerfiles, Kubernetes manifests, and GitHub Actions for security issues
user-invocable: true
allowed-tools: Bash, Read, Grep, Glob, Edit
---

# archguardian iac

Scan infrastructure-as-code files for security misconfigurations.

## Instructions

1. Run the scan with IaC analysis enabled:
   ```bash
   npx archguardian scan --format json $ARGUMENTS
   ```
   Ensure `.archguard.yml` has `analyzers.iac.enabled: true`.
2. Parse JSON output, filter for `iac/*` rules.
3. For each finding, explain the security risk and how to fix it.

## Rules covered

- Dockerfile: root user, :latest tags, curl|bash, exposed secrets, ADD vs COPY, missing HEALTHCHECK
- Kubernetes: privileged containers, missing resource limits, :latest image tags
- GitHub Actions: script injection via github.event, mutable action references

## Tips

- Configure which file types to scan: `dockerfile: true`, `kubernetes: true`, `actions: true`.
- Pin GitHub Actions to SHA commits instead of branch names.
- Always specify a USER instruction in Dockerfiles.
