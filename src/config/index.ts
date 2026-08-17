import fs from "fs-extra";
import * as path from "path";
import { AppConfig, AutoFMError, ConfigSource, DEFAULT_CONFIG } from "../types/index.js";
import { deepMerge, logger, writeFileSafe } from "../utils/index.js";
import { DEFAULT_PRESET_NAME, getPreset, listPresetNames } from "./presets.js";
import {
  getDefaultProjectConfigPath,
  isJsConfigPath,
  loadConfigFile,
  resolveConfigPath,
  warnLegacyConfig,
} from "./resolve.js";

export { CONFIG_PRESETS, DEFAULT_PRESET_NAME, getPreset, listPresetNames } from "./presets.js";
export {
  getDefaultProjectConfigPath,
  isJsConfigPath,
  LEGACY_CONFIG_NAME,
  PROJECT_CONFIG_DISPLAY_PATH,
  PROJECT_CONFIG_RELATIVE_PATH,
  resolveConfigPath,
} from "./resolve.js";

export interface ConfigManagerOptions {
  configPath?: string;
}

/**
 * 配置管理器
 */
export class ConfigManager {
  private config: AppConfig;
  private configPath: string | null;
  private configSource: ConfigSource;
  private folderPath: string;
  private explicitConfigPath?: string;

  constructor(folderPath: string, options: ConfigManagerOptions = {}) {
    this.folderPath = path.resolve(folderPath);
    this.explicitConfigPath = options.configPath;
    this.configPath = null;
    this.configSource = "default";
    this.config = deepMerge({}, DEFAULT_CONFIG);
  }

  /**
   * 加载配置文件。找不到文件时使用内置默认值，不会自动写盘。
   */
  async loadConfig(): Promise<AppConfig> {
    try {
      const resolved = resolveConfigPath({
        startDir: this.folderPath,
        explicitPath: this.explicitConfigPath || process.env.AUTOFM_CONFIG,
      });

      if (!resolved) {
        logger.info("No config file found, using built-in defaults");
        this.config = deepMerge({}, DEFAULT_CONFIG);
        this.configPath = null;
        this.configSource = "default";
        this.validateConfig();
        return this.config;
      }

      if (resolved.deprecated) {
        warnLegacyConfig(resolved.path);
      }

      logger.info(`Loading config from: ${resolved.path} (${resolved.source})`);
      const userConfig = await loadConfigFile(resolved.path);
      this.config = deepMerge(DEFAULT_CONFIG, userConfig);
      this.configPath = resolved.path;
      this.configSource = resolved.source;
      this.validateConfig();
      logger.info("Configuration loaded successfully");
      return this.config;
    } catch (error) {
      if (error instanceof AutoFMError) {
        throw error;
      }
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to load config: ${message}`);
      throw new AutoFMError(`Configuration load error: ${message}`, "CONFIG_LOAD_ERROR");
    }
  }

  /**
   * 保存配置文件。JS 配置不能回写；没有已解析路径时写入 .autofm/config.json。
   */
  async saveConfig(): Promise<void> {
    try {
      if (this.configPath && isJsConfigPath(this.configPath)) {
        throw new AutoFMError(
          `Cannot overwrite JS config file: ${this.configPath}. Edit it manually.`,
          "CONFIG_SAVE_ERROR",
          this.configPath,
        );
      }

      const target = this.configPath ?? getDefaultProjectConfigPath(this.folderPath);
      const configContent = JSON.stringify(this.config, null, 2);
      writeFileSafe(target, `${configContent}\n`);
      this.configPath = target;
      if (this.configSource === "default") {
        this.configSource = "project";
      }
      logger.info(`Configuration saved to: ${target}`);
    } catch (error) {
      if (error instanceof AutoFMError) {
        throw error;
      }
      const message = error instanceof Error ? error.message : String(error);
      throw new AutoFMError(`Failed to save config: ${message}`, "CONFIG_SAVE_ERROR");
    }
  }

  /**
   * 在目标目录写入 .autofm/config.json（或 --config 指定的 JSON 路径）。
   */
  async initConfig(presetName: string = DEFAULT_PRESET_NAME, force: boolean = false): Promise<string> {
    const preset = getPreset(presetName);
    if (!preset) {
      throw new AutoFMError(
        `Unknown preset '${presetName}'. Available: ${listPresetNames().join(", ")}`,
        "CONFIG_PRESET_ERROR",
      );
    }

    const target = this.explicitConfigPath
      ? path.resolve(this.folderPath, this.explicitConfigPath)
      : getDefaultProjectConfigPath(this.folderPath);

    if (isJsConfigPath(target)) {
      throw new AutoFMError(
        `init-config writes JSON only. Use a .json path, or create ${target} yourself.`,
        "CONFIG_INIT_ERROR",
        target,
      );
    }

    if (fs.existsSync(target) && !force) {
      throw new AutoFMError(
        `Config already exists: ${target} (use --force to overwrite)`,
        "CONFIG_EXISTS",
        target,
      );
    }

    writeFileSafe(target, `${JSON.stringify(preset, null, 2)}\n`);
    this.config = deepMerge(DEFAULT_CONFIG, preset);
    this.configPath = target;
    this.configSource = this.explicitConfigPath ? "explicit" : "project";
    this.validateConfig();
    logger.info(`Wrote ${presetName} config to: ${target}`);
    return target;
  }

  /**
   * 获取当前配置
   */
  getConfig(): AppConfig {
    return { ...this.config };
  }

  /**
   * 已解析的配置文件路径。使用默认配置时为 null。
   */
  getConfigPath(): string | null {
    return this.configPath;
  }

  /**
   * 配置来源
   */
  getConfigSource(): ConfigSource {
    return this.configSource;
  }

  /**
   * 更新配置
   */
  updateConfig(updates: Partial<AppConfig>): void {
    this.config = deepMerge(this.config, updates);
    this.validateConfig();
  }

  /**
   * 获取配置项
   */
  get<K extends keyof AppConfig>(key: K): AppConfig[K] {
    return this.config[key];
  }

  /**
   * 设置配置项
   */
  set<K extends keyof AppConfig>(key: K, value: AppConfig[K]): void {
    this.config[key] = value;
    this.validateConfig();
  }

  /**
   * 验证配置
   */
  private validateConfig(): void {
    if (!Array.isArray(this.config.noCategory)) {
      this.config.noCategory = [];
    }

    if (!Array.isArray(this.config.keyOrder)) {
      this.config.keyOrder = DEFAULT_CONFIG.keyOrder;
    }

    if (!this.config.dateFormat) {
      this.config.dateFormat = DEFAULT_CONFIG.dateFormat;
    }

    if (!this.config.timezone) {
      this.config.timezone = DEFAULT_CONFIG.timezone;
    }

    if (this.config.backup) {
      if (typeof this.config.backup.enabled !== "boolean") {
        this.config.backup.enabled = false;
      }
      if (!this.config.backup.directory) {
        this.config.backup.directory = DEFAULT_CONFIG.backup.directory;
      }
      if (typeof this.config.backup.maxFiles !== "number" || this.config.backup.maxFiles < 1) {
        this.config.backup.maxFiles = DEFAULT_CONFIG.backup.maxFiles;
      }
    } else {
      this.config.backup = { ...DEFAULT_CONFIG.backup };
    }

    if (!this.config.filePatterns) {
      this.config.filePatterns = { ...DEFAULT_CONFIG.filePatterns };
    }

    if (!this.config.templates) {
      this.config.templates = { ...DEFAULT_CONFIG.templates };
    }

    if (!this.config.customFields) {
      this.config.customFields = {};
    }
  }

  /**
   * 重置为默认配置
   */
  resetToDefault(): void {
    this.config = deepMerge({}, DEFAULT_CONFIG);
    this.configPath = null;
    this.configSource = "default";
  }

  /**
   * 检查是否为无分类目录
   */
  isNoCategoryDir(dirName: string): boolean {
    return this.config.noCategory.includes(dirName);
  }

  /**
   * 获取key排序
   */
  getKeyOrder(): string[] {
    return [...this.config.keyOrder];
  }

  /**
   * 获取日期格式
   */
  getDateFormat(): string {
    return this.config.dateFormat;
  }

  /**
   * 获取时区
   */
  getTimezone(): string {
    return this.config.timezone;
  }

  /**
   * 获取备份配置
   */
  getBackupConfig() {
    return { ...this.config.backup };
  }

  /**
   * 获取模板
   */
  getTemplate(name: string = "default") {
    return this.config.templates[name] || this.config.templates["default"];
  }

  /**
   * 获取所有模板名称
   */
  getTemplateNames(): string[] {
    return Object.keys(this.config.templates);
  }

  /**
   * 添加模板
   */
  addTemplate(name: string, template: any): void {
    if (!this.config.templates) {
      this.config.templates = {};
    }
    this.config.templates[name] = template;
  }

  /**
   * 删除模板
   */
  removeTemplate(name: string): boolean {
    if (name === "default") {
      logger.warn("Cannot remove default template");
      return false;
    }
    if (this.config.templates && this.config.templates[name]) {
      delete this.config.templates[name];
      return true;
    }
    return false;
  }

  /**
   * 获取文件模式
   */
  getFilePatterns() {
    return { ...this.config.filePatterns };
  }

  /**
   * 获取自定义字段
   */
  getCustomFields() {
    return { ...this.config.customFields };
  }

  /**
   * 添加自定义字段
   */
  addCustomField(key: string, value: any): void {
    if (!this.config.customFields) {
      this.config.customFields = {};
    }
    this.config.customFields[key] = value;
  }

  /**
   * 删除自定义字段
   */
  removeCustomField(key: string): boolean {
    if (this.config.customFields && this.config.customFields[key]) {
      delete this.config.customFields[key];
      return true;
    }
    return false;
  }
}

/**
 * 创建配置管理器实例
 */
export function createConfigManager(folderPath: string, options?: ConfigManagerOptions): ConfigManager {
  return new ConfigManager(folderPath, options);
}
