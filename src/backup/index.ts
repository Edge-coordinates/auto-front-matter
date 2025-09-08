import fs from "fs-extra";
import * as path from "path";
import { AutoFMError } from "../types/index.js";
import { 
  logger, 
  readFileSafe, 
  writeFileSafe, 
  formatFileSize,
  generateCurrentDate 
} from "../utils/index.js";
import { ConfigManager } from "../config/index.js";

/**
 * 备份文件信息
 */
interface BackupInfo {
  originalPath: string;
  backupPath: string;
  timestamp: string;
  size: number;
  hash?: string;
}

/**
 * 备份管理器
 */
export class BackupManager {
  private configManager: ConfigManager;
  private folderPath: string;
  private backupDir: string;

  constructor(folderPath: string, configManager: ConfigManager) {
    this.folderPath = folderPath;
    this.configManager = configManager;
    this.backupDir = path.join(folderPath, configManager.getBackupConfig().directory);
  }

  /**
   * 初始化备份目录
   */
  async initializeBackupDirectory(): Promise<void> {
    try {
      await fs.ensureDir(this.backupDir);
      
      // 创建备份信息文件
      const infoFile = path.join(this.backupDir, 'backup-info.json');
      if (!fs.existsSync(infoFile)) {
        const info = {
          created: generateCurrentDate(),
          version: '1.0.0',
          backups: []
        };
        await writeFileSafe(infoFile, JSON.stringify(info, null, 2));
      }
      
      logger.debug(`Backup directory initialized: ${this.backupDir}`);
    } catch (error) {
      throw new AutoFMError(`Failed to initialize backup directory: ${error.message}`, 'BACKUP_INIT_ERROR');
    }
  }

  /**
   * 创建文件备份
   */
  async createBackup(filePath: string): Promise<BackupInfo> {
    try {
      const config = this.configManager.getBackupConfig();
      if (!config.enabled) {
        throw new AutoFMError('Backup is disabled', 'BACKUP_DISABLED');
      }

      await this.initializeBackupDirectory();

      // 检查文件是否存在
      if (!fs.existsSync(filePath)) {
        throw new AutoFMError(`File does not exist: ${filePath}`, 'FILE_NOT_FOUND', filePath);
      }

      const stats = await fs.stat(filePath);
      const timestamp = generateCurrentDate('YYYY-MM-DD_HH-mm-ss');
      
      // 生成备份文件名
      const relativePath = path.relative(this.folderPath, filePath);
      const backupFileName = this.generateBackupFileName(relativePath, timestamp);
      const backupPath = path.join(this.backupDir, backupFileName);

      // 确保备份目录存在
      await fs.ensureDir(path.dirname(backupPath));

      // 复制文件
      await fs.copy(filePath, backupPath);

      const backupInfo: BackupInfo = {
        originalPath: filePath,
        backupPath,
        timestamp,
        size: stats.size
      };

      // 记录备份信息
      await this.recordBackupInfo(backupInfo);

      // 清理旧备份
      await this.cleanupOldBackups();

      logger.info(`Backup created: ${backupPath} (${formatFileSize(stats.size)})`);
      return backupInfo;
    } catch (error) {
      if (error instanceof AutoFMError) {
        throw error;
      }
      throw new AutoFMError(`Failed to create backup: ${error.message}`, 'BACKUP_CREATE_ERROR', filePath);
    }
  }

  /**
   * 恢复文件从备份
   */
  async restoreFromBackup(backupPath: string, targetPath?: string): Promise<void> {
    try {
      if (!fs.existsSync(backupPath)) {
        throw new AutoFMError(`Backup file does not exist: ${backupPath}`, 'BACKUP_NOT_FOUND');
      }

      const backupInfo = await this.getBackupInfo(backupPath);
      const restorePath = targetPath || backupInfo?.originalPath;

      if (!restorePath) {
        throw new AutoFMError('Cannot determine restore path', 'RESTORE_PATH_ERROR');
      }

      // 确保目标目录存在
      await fs.ensureDir(path.dirname(restorePath));

      // 复制备份文件到目标位置
      await fs.copy(backupPath, restorePath);

      logger.info(`File restored from backup: ${restorePath}`);
    } catch (error) {
      if (error instanceof AutoFMError) {
        throw error;
      }
      throw new AutoFMError(`Failed to restore from backup: ${error.message}`, 'RESTORE_ERROR');
    }
  }

  /**
   * 列出所有备份
   */
  async listBackups(filePath?: string): Promise<BackupInfo[]> {
    try {
      const infoFile = path.join(this.backupDir, 'backup-info.json');
      if (!fs.existsSync(infoFile)) {
        return [];
      }

      const content = readFileSafe(infoFile);
      const info = JSON.parse(content);
      let backups: BackupInfo[] = info.backups || [];

      // 如果指定了文件路径，只返回该文件的备份
      if (filePath) {
        backups = backups.filter(backup => backup.originalPath === filePath);
      }

      // 按时间戳排序（最新的在前）
      backups.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

      return backups;
    } catch (error) {
      logger.error(`Failed to list backups: ${error.message}`);
      return [];
    }
  }

  /**
   * 删除备份
   */
  async deleteBackup(backupPath: string): Promise<void> {
    try {
      if (fs.existsSync(backupPath)) {
        await fs.remove(backupPath);
        logger.info(`Backup deleted: ${backupPath}`);
      }

      // 从备份信息中移除
      await this.removeBackupInfo(backupPath);
    } catch (error) {
      throw new AutoFMError(`Failed to delete backup: ${error.message}`, 'BACKUP_DELETE_ERROR');
    }
  }

  /**
   * 清理旧备份
   */
  async cleanupOldBackups(): Promise<void> {
    try {
      const config = this.configManager.getBackupConfig();
      const backups = await this.listBackups();

      if (backups.length > config.maxFiles) {
        const toDelete = backups.slice(config.maxFiles);
        
        for (const backup of toDelete) {
          await this.deleteBackup(backup.backupPath);
        }

        logger.info(`Cleaned up ${toDelete.length} old backups`);
      }
    } catch (error) {
      logger.error(`Failed to cleanup old backups: ${error.message}`);
    }
  }

  /**
   * 获取备份统计信息
   */
  async getBackupStats(): Promise<any> {
    try {
      const backups = await this.listBackups();
      const totalSize = backups.reduce((sum, backup) => sum + backup.size, 0);

      return {
        count: backups.length,
        totalSize: formatFileSize(totalSize),
        directory: this.backupDir,
        enabled: this.configManager.getBackupConfig().enabled
      };
    } catch (error) {
      logger.error(`Failed to get backup stats: ${error.message}`);
      return {
        count: 0,
        totalSize: '0 Bytes',
        directory: this.backupDir,
        enabled: false,
        error: error.message
      };
    }
  }

  /**
   * 生成备份文件名
   */
  private generateBackupFileName(relativePath: string, timestamp: string): string {
    const ext = path.extname(relativePath);
    const nameWithoutExt = relativePath.slice(0, -ext.length);
    const sanitizedPath = nameWithoutExt.replace(/[/\\]/g, '_');
    return `${sanitizedPath}_${timestamp}${ext}`;
  }

  /**
   * 记录备份信息
   */
  private async recordBackupInfo(backupInfo: BackupInfo): Promise<void> {
    try {
      const infoFile = path.join(this.backupDir, 'backup-info.json');
      let info = { backups: [] };

      if (fs.existsSync(infoFile)) {
        const content = readFileSafe(infoFile);
        info = JSON.parse(content);
      }

      if (!info.backups) {
        info.backups = [];
      }

      info.backups.push(backupInfo);
      await writeFileSafe(infoFile, JSON.stringify(info, null, 2));
    } catch (error) {
      logger.error(`Failed to record backup info: ${error.message}`);
    }
  }

  /**
   * 获取备份信息
   */
  private async getBackupInfo(backupPath: string): Promise<BackupInfo | null> {
    try {
      const backups = await this.listBackups();
      return backups.find(backup => backup.backupPath === backupPath) || null;
    } catch (error) {
      return null;
    }
  }

  /**
   * 移除备份信息
   */
  private async removeBackupInfo(backupPath: string): Promise<void> {
    try {
      const infoFile = path.join(this.backupDir, 'backup-info.json');
      if (!fs.existsSync(infoFile)) {
        return;
      }

      const content = readFileSafe(infoFile);
      const info = JSON.parse(content);

      if (info.backups) {
        info.backups = info.backups.filter((backup: BackupInfo) => backup.backupPath !== backupPath);
        await writeFileSafe(infoFile, JSON.stringify(info, null, 2));
      }
    } catch (error) {
      logger.error(`Failed to remove backup info: ${error.message}`);
    }
  }
}
