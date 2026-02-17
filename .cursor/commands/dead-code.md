# archguardian dead-code

Detect unused exports. Run `npx archguardian scan --format json` with `analyzers.deadCode.enabled: true`. Filter for `dead-code/*` rules. Explain which exports are never imported. Configure `entryPoints` to exclude legitimate entry files.
