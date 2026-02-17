# archguardian iac

Scan IaC files for security issues. Run `npx archguardian scan --format json` with `analyzers.iac.enabled: true`. Covers Dockerfiles (root user, :latest tags, secrets), Kubernetes (privileged, resource limits), and GitHub Actions (script injection, mutable refs).
