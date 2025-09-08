import chokidar, { FSWatcher } from "chokidar";
import * as path from "path";
import { 
  CLIArgs, 
  WatcherConfig, 
  OperationResult, 
  AutoFMError 
} from "../types/index.js";
import { 
  logger, 
  isMarkdownFile, 
  delay, 
  formatFileSize 
} from "../utils/index.js";
import { ConfigManager } from "../config/index.js";
import { FrontMatterProcessor } from "../frontMatter/index.js";
import { BackupManager } from "../backup/index.js";

/**
 * 文件监控管理器
 */
export class FileWatcherManager {
  private watcher: FSWatcher | null = null;
  private folderPath: string;
  private configManager: ConfigManager;
  private frontMatterProcessor: FrontMatterProcessor;
  private backupManager: BackupManager;
  private isInitialized: boolean = false;
  private canUpdateTitle: boolean = false;

  constructor(
    folderPath: string, 
    configManager: ConfigManager, 
    frontMatterProcessor: FrontMatterProcessor,
    backupManager: BackupManager
  ) {
    this.folderPath = folderPath;
    this.configManager = configManager;
    this.frontMatterProcessor = frontMatterProcessor;
    this.backupManager = backupManager;
  }

  /**
   * 启动文件监控服务
   */
  async startWatcher(args: CLIArgs): Promise<void> {
    try {
      const watcherConfig = this.createWatcherConfig();
      
      // 在启动时关闭标题更新，等待 ready 事件开启
      this.canUpdateTitle = false;

      this.watcher = chokidar.watch(this.folderPath, {
        ignored: this.createIgnoreFunction(),
        persistent: true,
        ignoreInitial: false,
        depth: undefined,
        awaitWriteFinish: {
          stabilityThreshold: 100,
          pollInterval: 100
        }
      });

      this.setupEventHandlers(args);
      
      logger.info(`File watcher started for: ${this.folderPath}`);
    } catch (error) {
      throw new AutoFMError(`Failed to start file watcher: ${error.message}`, 'WATCHER_START_ERROR');
    }
  }

  /**
   * 停止文件监控服务
   */
  async stopWatcher(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
      this.isInitialized = false;
      this.canUpdateTitle = false;
      logger.info('File watcher stopped');
    }
  }

  /**
   * 检查监控器是否运行中
   */
  isWatching(): boolean {
    return this.watcher !== null && this.isInitialized;
  }

  /**
   * 创建监控器配置
   */
  private createWatcherConfig(): WatcherConfig {
    return {
      extensions: ['.md', '.mdx', '.markdown'],
      ignored: ['node_modules', '.git', 'dist', 'build', '.autofm-backup'],
      persistent: true
    };
  }

  /**
   * 创建忽略函数
   */
  private createIgnoreFunction() {
    return (filePath: string, stats?: any): boolean => {
      // 忽略非Markdown文件
      if (stats?.isFile() && !isMarkdownFile(filePath)) {
        return true;
      }

      // 忽略隐藏文件和目录
      const basename = path.basename(filePath);
      if (basename.startsWith('.')) {
        return true;
      }

      // 忽略node_modules等目录
      const ignoredDirs = ['node_modules', '.git', 'dist', 'build', '.autofm-backup'];
      for (const dir of ignoredDirs) {
        if (filePath.includes(dir)) {
          return true;
        }
      }

      return false;
    };
  }

  /**
   * 设置事件处理器
   */
  private setupEventHandlers(args: CLIArgs): void {
    if (!this.watcher) return;

    // 处理初始扫描完成
    this.watcher.on('ready', () => {
      this.isInitialized = true;
      
      if (args.init || args.ct) {
        logger.info("Initial scan complete.");
        this.stopWatcher().then(() => {
          logger.info('Watcher closed.');
          logger.info("If you want to watch for changes, please restart the program without --init or --ct flag.");
        });
      } else {
        // 只有在 ready 且非一次性执行模式下，才允许更新标题
        this.canUpdateTitle = true;
        this.setupContinuousWatching();
        logger.info("Initial scan complete. Server is ready for changes");
      }
    });

    // 处理文件添加
    this.watcher.on('add', async (filePath, stats) => {
      await this.handleFileAdd(filePath, stats, args);
    });

    // 处理文件变更（仅在连续监控模式下）
    if (!args.init && !args.ct) {
      this.watcher.on('change', async (filePath, stats) => {
        await this.handleFileChange(filePath, stats);
      });
    }

    // 处理错误
    this.watcher.on('error', (error) => {
      logger.error(`Watcher error: ${error.message}`);
    });
  }

  /**
   * 设置连续监控
   */
  private setupContinuousWatching(): void {
    if (!this.watcher) return;

    // 文件删除事件
    this.watcher.on('unlink', (filePath) => {
      logger.info(`File removed: ${filePath}`);
    });

    // 目录添加事件
    this.watcher.on('addDir', (dirPath) => {
      logger.debug(`Directory added: ${dirPath}`);
    });

    // 目录删除事件
    this.watcher.on('unlinkDir', (dirPath) => {
      logger.info(`Directory removed: ${dirPath}`);
    });
  }

  /**
   * 处理文件添加事件
   */
  private async handleFileAdd(filePath: string, stats: any, args: CLIArgs): Promise<OperationResult> {
    try {
      if (!isMarkdownFile(filePath)) {
        return { success: true, message: 'Not a markdown file', filePath };
      }

      logger.info(`Processing file: ${filePath} (${formatFileSize(stats?.size || 0)})`);

      // 创建备份（如果启用）
      const backupConfig = this.configManager.getBackupConfig();
      if (backupConfig.enabled) {
        await this.backupManager.createBackup(filePath);
      }

      // 处理Front Matter
      if (args.init || args.ct) {
        this.frontMatterProcessor.updateFrontMatter(filePath, args);
      } else {
        this.frontMatterProcessor.initializeFrontMatter(filePath);
      }

      // 每次文件作为“新文件”被 chokidar 报告（包括重命名 unlink+add）时，同步标题
      if (this.canUpdateTitle) {
        this.frontMatterProcessor.updateTitleFromFileName(filePath);
      } else {
        logger.debug(`Skip title update before ready: ${filePath}`);
      }

      return { 
        success: true, 
        message: 'File processed successfully', 
        filePath 
      };
    } catch (error) {
      logger.error(`Failed to process file ${filePath}: ${error.message}`);
      return { 
        success: false, 
        message: error.message, 
        filePath, 
        error: error as Error 
      };
    }
  }

  /**
   * 处理文件变更事件
   */
  private async handleFileChange(filePath: string, stats: any): Promise<OperationResult> {
    try {
      if (!isMarkdownFile(filePath)) {
        return { success: true, message: 'Not a markdown file', filePath };
      }

      logger.info(`File changed: ${filePath} (${formatFileSize(stats?.size || 0)})`);
      
      // 延迟处理，避免频繁的文件变更
      await delay(200);

      // 文件内容变更时，更新 updated 字段
      this.frontMatterProcessor.updateUpdatedField(filePath);

      return { 
        success: true, 
        message: 'File change detected', 
        filePath 
      };
    } catch (error) {
      logger.error(`Failed to handle file change ${filePath}: ${error.message}`);
      return { 
        success: false, 
        message: error.message, 
        filePath, 
        error: error as Error 
      };
    }
  }

  /**
   * 手动处理单个文件
   */
  async processFile(filePath: string, args: CLIArgs): Promise<OperationResult> {
    try {
      if (!isMarkdownFile(filePath)) {
        throw new AutoFMError('Not a markdown file', 'INVALID_FILE_TYPE', filePath);
      }

      // 创建备份
      const backupConfig = this.configManager.getBackupConfig();
      if (backupConfig.enabled) {
        await this.backupManager.createBackup(filePath);
      }

      // 处理Front Matter
      if (args.force) {
        this.frontMatterProcessor.updateFrontMatter(filePath, args);
      } else {
        this.frontMatterProcessor.initializeFrontMatter(filePath);
      }

      return { 
        success: true, 
        message: 'File processed successfully', 
        filePath 
      };
    } catch (error) {
      return { 
        success: false, 
        message: error.message, 
        filePath, 
        error: error as Error 
      };
    }
  }

  /**
   * 批量处理文件
   */
  async processFiles(filePaths: string[], args: CLIArgs): Promise<OperationResult[]> {
    const results: OperationResult[] = [];
    
    for (const filePath of filePaths) {
      const result = await this.processFile(filePath, args);
      results.push(result);
      
      // 短暂延迟，避免系统过载
      await delay(50);
    }

    return results;
  }

  /**
   * 获取监控统计信息
   */
  getWatcherStats(): any {
    if (!this.watcher) {
      return { watching: false };
    }

    const watched = this.watcher.getWatched();
    let fileCount = 0;
    let dirCount = 0;

    Object.keys(watched).forEach(dir => {
      dirCount++;
      fileCount += watched[dir].length;
    });

    return {
      watching: true,
      directories: dirCount,
      files: fileCount,
      folderPath: this.folderPath,
      initialized: this.isInitialized
    };
  }

  /**
   * 重新加载配置并重启监控器
   */
  async reloadConfig(args: CLIArgs): Promise<void> {
    logger.info('Reloading configuration and restarting watcher...');
    
    await this.stopWatcher();
    await this.configManager.loadConfig();
    await this.startWatcher(args);
    
    logger.info('Configuration reloaded and watcher restarted');
  }
}
