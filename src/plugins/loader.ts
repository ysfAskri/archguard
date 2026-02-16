import type { Analyzer, ArchGuardConfig } from '../core/types.js';
import { logger } from '../utils/logger.js';

/**
 * Validates that a value conforms to the Analyzer interface:
 * it must have a `name` string property and an `analyze` method.
 */
function isValidAnalyzer(value: unknown): value is Analyzer {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return typeof obj.name === 'string' && typeof obj.analyze === 'function';
}

/**
 * Loads external analyzer plugins specified in the config's `plugins` array.
 *
 * Each plugin is an npm package name that default-exports (or exports) an array
 * of Analyzer objects. The function uses dynamic `import()` to load each plugin,
 * validates every exported analyzer, and returns the valid ones.
 */
export async function loadPlugins(config: ArchGuardConfig): Promise<Analyzer[]> {
  const pluginNames = config.plugins;
  if (pluginNames.length === 0) return [];

  const analyzers: Analyzer[] = [];

  for (const pluginName of pluginNames) {
    try {
      logger.debug(`Loading plugin: ${pluginName}`);
      const mod = await import(pluginName);

      // Support both default export and named `analyzers` export
      const exported: unknown = mod.default ?? mod.analyzers;

      if (!Array.isArray(exported)) {
        logger.warn(
          `Plugin '${pluginName}' does not export an array of analyzers. ` +
          `Expected a default export or named 'analyzers' export that is an array.`,
        );
        continue;
      }

      let loadedCount = 0;
      for (const item of exported) {
        if (isValidAnalyzer(item)) {
          analyzers.push(item);
          loadedCount++;
        } else {
          logger.warn(
            `Plugin '${pluginName}' contains an invalid analyzer entry. ` +
            `Each analyzer must have a 'name' string and an 'analyze' method.`,
          );
        }
      }

      logger.debug(`Loaded ${loadedCount} analyzer(s) from plugin '${pluginName}'`);
    } catch (err) {
      logger.error(`Failed to load plugin '${pluginName}': ${(err as Error).message}`);
    }
  }

  return analyzers;
}
