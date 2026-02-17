import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export interface PackageDependency {
  name: string;
  version: string;
  ecosystem: string;
}

/**
 * Shared utility to collect dependencies from manifest files.
 * Used by DependencyScanner, SBOM generator, and License scanner.
 */
export async function collectDependencies(projectRoot: string): Promise<PackageDependency[]> {
  const deps: PackageDependency[] = [];

  // package.json (npm)
  try {
    const content = await readFile(join(projectRoot, 'package.json'), 'utf-8');
    const pkg = JSON.parse(content) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    for (const [name, version] of Object.entries(pkg.dependencies ?? {})) {
      deps.push({ name, version: version.replace(/^[\^~>=<]/, ''), ecosystem: 'npm' });
    }
    for (const [name, version] of Object.entries(pkg.devDependencies ?? {})) {
      deps.push({ name, version: version.replace(/^[\^~>=<]/, ''), ecosystem: 'npm' });
    }
  } catch {
    // No package.json
  }

  // go.mod
  try {
    const content = await readFile(join(projectRoot, 'go.mod'), 'utf-8');
    const requireRegex = /^\s+(\S+)\s+(v[\d.]+)/gm;
    let match;
    while ((match = requireRegex.exec(content)) !== null) {
      deps.push({ name: match[1], version: match[2], ecosystem: 'Go' });
    }
  } catch {
    // No go.mod
  }

  // Cargo.toml
  try {
    const content = await readFile(join(projectRoot, 'Cargo.toml'), 'utf-8');
    const depRegex = /^(\w[\w-]*)\s*=\s*"([\d.]+)"/gm;
    let match;
    while ((match = depRegex.exec(content)) !== null) {
      deps.push({ name: match[1], version: match[2], ecosystem: 'crates.io' });
    }
  } catch {
    // No Cargo.toml
  }

  // pom.xml (basic)
  try {
    const content = await readFile(join(projectRoot, 'pom.xml'), 'utf-8');
    const depRegex = /<groupId>([^<]+)<\/groupId>\s*<artifactId>([^<]+)<\/artifactId>\s*<version>([^<]+)<\/version>/g;
    let match;
    while ((match = depRegex.exec(content)) !== null) {
      deps.push({ name: `${match[1]}:${match[2]}`, version: match[3], ecosystem: 'Maven' });
    }
  } catch {
    // No pom.xml
  }

  return deps;
}
