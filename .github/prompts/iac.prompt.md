# archguardian iac

Scan infrastructure files. Run `npx archguardian scan --format json` with IaC analyzer enabled. Checks Dockerfiles for root user, :latest tags, curl|bash, exposed secrets, ADD vs COPY, missing HEALTHCHECK. Checks K8s for privileged containers, missing resource limits. Checks GitHub Actions for script injection and mutable action refs.
