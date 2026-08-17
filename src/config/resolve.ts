import fs from "fs-extra";
import { createRequire } from "module";
import os from "os";
import * as path from "path";
import { pathToFileURL } from "url";
import { AppConfig, AutoFMError, ResolvedConfig } from "../types/index.js";
import { logger, readFileSafe } from "../utils/index.js";

const PROJECT_CONFIG_CANDIDATES = [
  [".autofm", "config.json"],
  [".autofm", "config.js"],
  [".autofm", "config.mjs"],
  [".autofm", "config.cjs"],
  [".autofmrc.json"],
  [".autofmrc.js"],
  ["autofm.config.js"],
  ["autofm.config.mjs"],
  ["autofm.config.cjs"],
];

export const LEGACY_CONFIG_NAME = "autofm-config.json";
export const PROJECT_CONFIG_DISPLAY_PATH = ".autofm/config.json";
export const PROJECT_CONFIG_RELATIVE_PATH = path.join(".autofm", "config.json");

const JS_CONFIG_EXTENSIONS = new Set([".js", ".mjs", ".cjs"]);

export function isJsConfigPath(filePath: string): boolean {
  return JS_CONFIG_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

export function getDefaultProjectConfigPath(folderPath: string): string {
  return path.join(path.resolve(folderPath), PROJECT_CONFIG_RELATIVE_PATH);
}

function fileExists(filePath: string): boolean {
  try {
    return fs.existsSync(filePath) && fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function getUserConfigCandidates(): string[] {
  const xdg = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config");
  return [
    path.join(xdg, "autofm", "config.json"),
    path.join(xdg, "autofm", "config.js"),
    path.join(xdg, "autofm", "config.mjs"),
    path.join(xdg, "autofm", "config.cjs"),
    path.join(os.homedir(), ".autofm", "config.json"),
    path.join(os.homedir(), ".autofm", "config.js"),
  ];
}

function findFirstExisting(candidates: string[]): string | undefined {
  return candidates.find(fileExists);
}

/**
 * Resolve a config file without creating one.
 *
 * Order:
 * 1. --config / AUTOFM_CONFIG
 * 2. Walk up from startDir: .autofm/config.*, .autofmrc.*, autofm.config.*
 * 3. Legacy autofm-config.json in startDir only
 * 4. User-level ~/.config/autofm/config.* (and ~/.autofm/config.*)
 */
export function resolveConfigPath(options: {
  startDir: string;
  explicitPath?: string;
}): ResolvedConfig | null {
  const startDir = path.resolve(options.startDir);
  const explicitPath = options.explicitPath?.trim();

  if (explicitPath) {
    const resolved = path.resolve(startDir, explicitPath);
    if (!fileExists(resolved)) {
      throw new AutoFMError(
        `Config file not found: ${resolved}`,
        "CONFIG_NOT_FOUND",
        resolved,
      );
    }
    return { path: resolved, source: "explicit", deprecated: false };
  }

  const home = path.resolve(os.homedir());
  let dir = startDir;

  while (true) {
    const atHome = path.resolve(dir) === home;
    if (atHome && path.resolve(startDir) !== home) {
      break;
    }

    const projectMatch = findFirstExisting(
      PROJECT_CONFIG_CANDIDATES.map((parts) => path.join(dir, ...parts)),
    );
    if (projectMatch) {
      return { path: projectMatch, source: "project", deprecated: false };
    }

    const parent = path.dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }

  const legacyPath = path.join(startDir, LEGACY_CONFIG_NAME);
  if (fileExists(legacyPath)) {
    return { path: legacyPath, source: "legacy", deprecated: true };
  }

  const userMatch = findFirstExisting(getUserConfigCandidates());
  if (userMatch) {
    return { path: userMatch, source: "user", deprecated: false };
  }

  return null;
}

function unwrapConfigModule(mod: any): Partial<AppConfig> {
  const exported = mod?.default ?? mod?.config ?? mod;
  return exported;
}

async function loadJsConfig(filePath: string): Promise<Partial<AppConfig>> {
  const href = pathToFileURL(filePath).href;

  try {
    const mod = await import(`${href}?update=${Date.now()}`);
    return unwrapConfigModule(mod);
  } catch (esmError) {
    try {
      const require = createRequire(import.meta.url);
      const resolved = require.resolve(filePath);
      delete require.cache[resolved];
      return unwrapConfigModule(require(filePath));
    } catch (cjsError) {
      const esmMessage = esmError instanceof Error ? esmError.message : String(esmError);
      const cjsMessage = cjsError instanceof Error ? cjsError.message : String(cjsError);
      throw new AutoFMError(
        `Failed to load JS config ${filePath}: ${esmMessage}; CJS fallback: ${cjsMessage}`,
        "CONFIG_LOAD_ERROR",
        filePath,
      );
    }
  }
}

export async function loadConfigFile(filePath: string): Promise<Partial<AppConfig>> {
  const ext = path.extname(filePath).toLowerCase();

  if (ext === ".json") {
    try {
      return JSON.parse(readFileSafe(filePath));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new AutoFMError(
        `Failed to parse JSON config ${filePath}: ${message}`,
        "CONFIG_LOAD_ERROR",
        filePath,
      );
    }
  }

  if (isJsConfigPath(filePath)) {
    const loaded = await loadJsConfig(filePath);
    if (typeof loaded === "function") {
      const result = await (loaded as () => Partial<AppConfig> | Promise<Partial<AppConfig>>)();
      if (!result || typeof result !== "object" || Array.isArray(result)) {
        throw new AutoFMError(
          `JS config function must return an object: ${filePath}`,
          "CONFIG_LOAD_ERROR",
          filePath,
        );
      }
      return result;
    }
    if (!loaded || typeof loaded !== "object" || Array.isArray(loaded)) {
      throw new AutoFMError(
        `JS config must export an object: ${filePath}`,
        "CONFIG_LOAD_ERROR",
        filePath,
      );
    }
    return loaded;
  }

  throw new AutoFMError(
    `Unsupported config file type: ${filePath}`,
    "CONFIG_LOAD_ERROR",
    filePath,
  );
}

export function warnLegacyConfig(filePath: string): void {
  logger.warn(
    `Legacy config path is deprecated: ${filePath}. Move it to ${PROJECT_CONFIG_DISPLAY_PATH} (or run: autofm init-config).`,
  );
}
