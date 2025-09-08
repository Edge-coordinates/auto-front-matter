import fs from "fs-extra";
import * as path from "path";
import { AppConfig, DEFAULT_CONFIG, AutoFMError } from "../types/index.js";
import { logger, readFileSafe, writeFileSafe, deepMerge } from "../utils/index.js";

/**
 * 配置管理器
 */
export class ConfigManager {
  private config: AppConfig;
  private configPath: string;
  private folderPath: string;

  constructor(folderPath: string) {
    this.folderPath = folderPath;
    this.configPath = path.join(folderPath, 'autofm-config.json');
    this.config = { ...DEFAULT_CONFIG };
  }

  /**
   * 加载配置文件
   */
  async loadConfig(): Promise<AppConfig> {
    try {
      if (fs.existsSync(this.configPath)) {
        logger.info(`Loading config from: ${this.configPath}`);
        const configContent = readFileSafe(this.configPath);
        const userConfig = JSON.parse(configContent);
        
        // 深度合并用户配置和默认配置
        this.config = deepMerge(DEFAULT_CONFIG, userConfig);
        
        // 验证配置
        this.validateConfig();
        
        logger.info("Configuration loaded successfully");
      } else {
        logger.warn(`Config file not found at ${this.configPath}, using default configuration`);
        // 创建默认配置文件
        await this.saveConfig();
      }
    } catch (error) {
      logger.error(`Failed to load config: ${error.message}`);
      throw new AutoFMError(`Configuration load error: ${error.message}`, 'CONFIG_LOAD_ERROR');
    }

    return this.config;
  }

  /**
   * 保存配置文件
   */
  async saveConfig(): Promise<void> {
    try {
      const configContent = JSON.stringify(this.config, null, 2);
      writeFileSafe(this.configPath, configContent);
      logger.info(`Configuration saved to: ${this.configPath}`);
    } catch (error) {
      throw new AutoFMError(`Failed to save config: ${error.message}`, 'CONFIG_SAVE_ERROR');
    }
  }

  /**
   * 获取当前配置
   */
  getConfig(): AppConfig {
    return { ...this.config };
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
    // 验证必要的配置项
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

    // 验证备份配置
    if (this.config.backup) {
      if (typeof this.config.backup.enabled !== 'boolean') {
        this.config.backup.enabled = false;
      }
      if (!this.config.backup.directory) {
        this.config.backup.directory = DEFAULT_CONFIG.backup.directory;
      }
      if (typeof this.config.backup.maxFiles !== 'number' || this.config.backup.maxFiles < 1) {
        this.config.backup.maxFiles = DEFAULT_CONFIG.backup.maxFiles;
      }
    } else {
      this.config.backup = { ...DEFAULT_CONFIG.backup };
    }

    // 验证文件模式配置
    if (!this.config.filePatterns) {
      this.config.filePatterns = { ...DEFAULT_CONFIG.filePatterns };
    }

    // 验证模板配置
    if (!this.config.templates) {
      this.config.templates = { ...DEFAULT_CONFIG.templates };
    }

    // 验证自定义字段
    if (!this.config.customFields) {
      this.config.customFields = {};
    }
  }

  /**
   * 重置为默认配置
   */
  resetToDefault(): void {
    this.config = { ...DEFAULT_CONFIG };
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
  getTemplate(name: string = 'default') {
    return this.config.templates[name] || this.config.templates['default'];
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
    if (name === 'default') {
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
export function createConfigManager(folderPath: string): ConfigManager {
  return new ConfigManager(folderPath);
}
