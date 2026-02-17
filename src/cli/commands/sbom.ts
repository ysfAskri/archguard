import chalk from 'chalk';
import { isGitRepo, getGitRoot } from '../../utils/git.js';
import { ExitCode } from '../../core/types.js';
import { collectDependencies, type PackageDependency } from '../../core/dependency-collector.js';

export interface SbomOptions {
  format?: 'cyclonedx' | 'spdx';
}

export async function sbomCommand(options: SbomOptions = {}): Promise<number> {
  const format = options.format ?? 'cyclonedx';
  const cwd = process.cwd();

  if (!await isGitRepo(cwd)) {
    console.error(chalk.red('Not a git repository.'));
    return ExitCode.ConfigError;
  }

  const projectRoot = await getGitRoot(cwd);
  const deps = await collectDependencies(projectRoot);

  if (deps.length === 0) {
    console.error(chalk.yellow('  No dependencies found to generate SBOM.'));
    return ExitCode.Success;
  }

  if (format === 'spdx') {
    console.log(JSON.stringify(generateSpdx(deps), null, 2));
  } else {
    console.log(JSON.stringify(generateCycloneDx(deps), null, 2));
  }

  return ExitCode.Success;
}

function generateCycloneDx(deps: PackageDependency[]): object {
  return {
    bomFormat: 'CycloneDX',
    specVersion: '1.5',
    version: 1,
    metadata: {
      timestamp: new Date().toISOString(),
      tools: [{ vendor: 'archguardian', name: 'archguardian', version: '1.1.0' }],
    },
    components: deps.map(dep => ({
      type: 'library',
      name: dep.name,
      version: dep.version,
      purl: toPurl(dep),
      'bom-ref': `${dep.ecosystem}/${dep.name}@${dep.version}`,
    })),
  };
}

function generateSpdx(deps: PackageDependency[]): object {
  return {
    spdxVersion: 'SPDX-2.3',
    dataLicense: 'CC0-1.0',
    SPDXID: 'SPDXRef-DOCUMENT',
    name: 'archguardian-sbom',
    documentNamespace: `https://archguardian.dev/sbom/${Date.now()}`,
    creationInfo: {
      created: new Date().toISOString(),
      creators: ['Tool: archguardian-1.1.0'],
    },
    packages: deps.map((dep, i) => ({
      SPDXID: `SPDXRef-Package-${i}`,
      name: dep.name,
      versionInfo: dep.version,
      downloadLocation: 'NOASSERTION',
      externalRefs: [{
        referenceCategory: 'PACKAGE-MANAGER',
        referenceType: 'purl',
        referenceLocator: toPurl(dep),
      }],
    })),
  };
}

function toPurl(dep: PackageDependency): string {
  switch (dep.ecosystem) {
    case 'npm': return `pkg:npm/${dep.name.replace('@', '%40')}@${dep.version}`;
    case 'Go': return `pkg:golang/${dep.name}@${dep.version}`;
    case 'crates.io': return `pkg:cargo/${dep.name}@${dep.version}`;
    case 'Maven': {
      const [group, artifact] = dep.name.split(':');
      return `pkg:maven/${group}/${artifact}@${dep.version}`;
    }
    default: return `pkg:generic/${dep.name}@${dep.version}`;
  }
}
