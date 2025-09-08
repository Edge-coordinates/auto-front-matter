import { CLIArgs } from "../types/index.js";
import { logger } from "../utils/index.js";
import { ConfigManager } from "../config/index.js";
import { FrontMatterProcessor } from "../frontMatter/index.js";
import { FileWatcherManager } from "../fileWatcher/index.js";
import { BackupManager } from "../backup/index.js";
import { TemplateManager, initializePredefinedTemplates } from "../template/index.js";

/**
 * 应用程序主服务类
 */
export class AutoFrontMatterService {
  private folderPath: string;
  private configManager: ConfigManager;
  private frontMatterProcessor: FrontMatterProcessor;
  private fileWatcherManager: FileWatcherManager;
  private backupManager: BackupManager;
  private templateManager: TemplateManager;

  constructor(folderPath: string) {
    this.folderPath = folderPath;
    this.configManager = new ConfigManager(folderPath);
    this.frontMatterProcessor = new FrontMatterProcessor(folderPath, this.configManager);
    this.backupManager = new BackupManager(folderPath, this.configManager);
    this.templateManager = new TemplateManager(folderPath, this.configManager);
    this.fileWatcherManager = new FileWatcherManager(
      folderPath,
      this.configManager,
      this.frontMatterProcessor,
      this.backupManager
    );
  }

  /**
   * 启动服务
   */
  async start(args: CLIArgs): Promise<void> {
    try {
      logger.info(`Starting AutoFrontMatter service in: ${this.folderPath}`);

      // 加载配置
      await this.configManager.loadConfig();

      // 初始化预定义模板
      initializePredefinedTemplates(this.configManager);

      // 启动文件监控
      await this.fileWatcherManager.startWatcher(args);

      logger.info("AutoFrontMatter service started successfully");
    } catch (error) {
      logger.error(`Failed to start service: ${error.message}`);
      throw error;
    }
  }

  /**
   * 停止服务
   */
  async stop(): Promise<void> {
    try {
      await this.fileWatcherManager.stopWatcher();
      logger.info("AutoFrontMatter service stopped");
    } catch (error) {
      logger.error(`Failed to stop service: ${error.message}`);
      throw error;
    }
  }

  /**
   * 获取服务状态
   */
  getStatus(): any {
    return {
      folderPath: this.folderPath,
      watching: this.fileWatcherManager.isWatching(),
      config: this.configManager.getConfig(),
      watcherStats: this.fileWatcherManager.getWatcherStats()
    };
  }

  /**
   * 获取配置管理器
   */
  getConfigManager(): ConfigManager {
    return this.configManager;
  }

  /**
   * 获取Front Matter处理器
   */
  getFrontMatterProcessor(): FrontMatterProcessor {
    return this.frontMatterProcessor;
  }

  /**
   * 获取备份管理器
   */
  getBackupManager(): BackupManager {
    return this.backupManager;
  }

  /**
   * 获取模板管理器
   */
  getTemplateManager(): TemplateManager {
    return this.templateManager;
  }

  /**
   * 获取文件监控管理器
   */
  getFileWatcherManager(): FileWatcherManager {
    return this.fileWatcherManager;
  }
}

/**
 * 启动服务器的主函数（保持向后兼容）
 */
export async function startServer(tpath: string, args: CLIArgs): Promise<AutoFrontMatterService> {
  const service = new AutoFrontMatterService(tpath);
  await service.start(args);
  return service;
}
