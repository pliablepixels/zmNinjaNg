import { defaults, type PlatformTestConfig } from './platforms.config.defaults';

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

function deepMerge(base: PlatformTestConfig, override: DeepPartial<PlatformTestConfig>): PlatformTestConfig {
  const result = { ...base };
  for (const key of Object.keys(override) as (keyof PlatformTestConfig)[]) {
    const val = override[key];
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      (result[key] as Record<string, unknown>) = {
        ...(base[key] as Record<string, unknown>),
        ...(val as Record<string, unknown>),
      };
    } else if (val !== undefined) {
      (result[key] as unknown) = val;
    }
  }
  return result;
}

async function loadConfig(): Promise<PlatformTestConfig> {
  try {
    // platforms.config.local.ts is gitignored — load only if present
    const local = await import('./platforms.config.local');
    const overrides: DeepPartial<PlatformTestConfig> = local.default ?? local;
    return deepMerge(defaults, overrides);
  } catch {
    return defaults;
  }
}

export const platformConfig: PlatformTestConfig = await loadConfig();
