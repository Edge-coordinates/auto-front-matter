import * as path from "path";
import { AutoFrontMatterService } from "../lib/index.js";
import { CLIArgs } from "../types/index.js";
import { logger } from "../utils/index.js";

/**
 * CLI命令处理器
 */
export class CLICommands {
  private service: AutoFrontMatterService;

  constructor(service: AutoFrontMatterService) {
    this.service = service;
  }

  /**
   * 显示服务状态
   */
  async status(): Promise<void> {
    const status = this.service.getStatus();
    
    console.log("\n=== AutoFrontMatter Status ===");
    console.log(`Folder: ${status.folderPath}`);
    console.log(`Watching: ${status.watching ? 'Yes' : 'No'}`);
    
    if (status.watcherStats) {
      console.log(`Files: ${status.watcherStats.files}`);
      console.log(`Directories: ${status.watcherStats.directories}`);
    }
    
    console.log("\n=== Configuration ===");
    console.log(`Date Format: ${status.config.dateFormat}`);
    console.log(`Timezone: ${status.config.timezone}`);
    console.log(`Category Mode: ${status.config.categoryMode}`);
    console.log(`Protected Fields: ${status.config.protectedFields?.join(', ')}`);
    console.log(`Backup Enabled: ${status.config.backup.enabled}`);
    console.log(`Templates: ${Object.keys(status.config.templates).join(', ')}`);
    console.log("===============================\n");
  }

  /**
   * 列出所有模板
   */
  async listTemplates(): Promise<void> {
    const templateManager = this.service.getTemplateManager();
    const templates = templateManager.listTemplates();
    
    console.log("\n=== Available Templates ===");
    templates.forEach(name => {
      const template = templateManager.getTemplate(name);
      console.log(`- ${name}`);
      if (template) {
        Object.keys(template).forEach(key => {
          console.log(`  ${key}: ${typeof template[key]}`);
        });
      }
    });
    console.log("===========================\n");
  }

  /**
   * 创建新模板
   */
  async createTemplate(name: string, templateData: any): Promise<void> {
    try {
      const templateManager = this.service.getTemplateManager();
      templateManager.createTemplate(name, templateData);
      
      // 保存配置
      await this.service.getConfigManager().saveConfig();
      
      logger.info(`Template '${name}' created successfully`);
    } catch (error) {
      logger.error(`Failed to create template: ${error.message}`);
      throw error;
    }
  }

  /**
   * 显示备份统计
   */
  async backupStats(): Promise<void> {
    const backupManager = this.service.getBackupManager();
    const stats = await backupManager.getBackupStats();
    
    console.log("\n=== Backup Statistics ===");
    console.log(`Enabled: ${stats.enabled}`);
    console.log(`Total Backups: ${stats.count}`);
    console.log(`Total Size: ${stats.totalSize}`);
    console.log(`Directory: ${stats.directory}`);
    console.log("=========================\n");
  }

  /**
   * 列出备份文件
   */
  async listBackups(filePath?: string): Promise<void> {
    const backupManager = this.service.getBackupManager();
    const backups = await backupManager.listBackups(filePath);
    
    console.log("\n=== Backup Files ===");
    if (backups.length === 0) {
      console.log("No backups found");
    } else {
      backups.forEach(backup => {
        console.log(`- ${backup.timestamp}`);
        console.log(`  Original: ${backup.originalPath}`);
        console.log(`  Backup: ${backup.backupPath}`);
        console.log(`  Size: ${(backup.size / 1024).toFixed(2)} KB`);
        console.log("");
      });
    }
    console.log("====================\n");
  }

  /**
   * 恢复备份
   */
  async restoreBackup(backupPath: string, targetPath?: string): Promise<void> {
    try {
      const backupManager = this.service.getBackupManager();
      await backupManager.restoreFromBackup(backupPath, targetPath);
      logger.info(`Backup restored successfully`);
    } catch (error) {
      logger.error(`Failed to restore backup: ${error.message}`);
      throw error;
    }
  }

  /**
   * 处理单个文件
   */
  async processFile(filePath: string, args: CLIArgs): Promise<void> {
    try {
      const fileWatcherManager = this.service.getFileWatcherManager();
      const result = await fileWatcherManager.processFile(filePath, args);
      
      if (result.success) {
        logger.info(`File processed successfully: ${filePath}`);
      } else {
        logger.error(`Failed to process file: ${result.message}`);
      }
    } catch (error) {
      logger.error(`Error processing file ${filePath}: ${error.message}`);
      throw error;
    }
  }

  /**
   * 批量处理文件
   */
  async processFiles(filePaths: string[], args: CLIArgs): Promise<void> {
    try {
      const fileWatcherManager = this.service.getFileWatcherManager();
      const results = await fileWatcherManager.processFiles(filePaths, args);
      
      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;
      
      logger.info(`Batch processing completed: ${successful} successful, ${failed} failed`);
      
      // 显示失败的文件
      results.filter(r => !r.success).forEach(result => {
        logger.error(`Failed: ${result.filePath} - ${result.message}`);
      });
    } catch (error) {
      logger.error(`Error in batch processing: ${error.message}`);
      throw error;
    }
  }

  /**
   * 验证配置
   */
  async validateConfig(): Promise<void> {
    try {
      const config = this.service.getConfigManager().getConfig();
      
      console.log("\n=== Configuration Validation ===");
      
      // 验证基本配置
      console.log(`✓ Date format: ${config.dateFormat}`);
      console.log(`✓ Timezone: ${config.timezone}`);
      console.log(`✓ Key order: ${config.keyOrder.join(', ')}`);
      console.log(`✓ Category mode: ${config.categoryMode}`);
      console.log(`✓ Protected fields: ${config.protectedFields?.join(', ')}`);
      
      // 验证模板
      const templateManager = this.service.getTemplateManager();
      const templates = templateManager.listTemplates();
      console.log(`✓ Templates (${templates.length}): ${templates.join(', ')}`);
      
      // 验证备份配置
      if (config.backup.enabled) {
        console.log(`✓ Backup enabled: ${config.backup.directory}`);
      } else {
        console.log(`! Backup disabled`);
      }
      
      console.log("================================\n");
      logger.info("Configuration validation completed");
    } catch (error) {
      logger.error(`Configuration validation failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * 显示分类报告
   */
  async categoryReport(directoryPath?: string): Promise<void> {
    try {
      const targetPath = directoryPath || this.service.getStatus().folderPath;
      const frontMatterProcessor = this.service.getFrontMatterProcessor();
      
      // 获取所有Markdown文件
      const glob = await import('glob');
      const files = glob.globSync('**/*.{md,mdx}', { 
        cwd: targetPath,
        absolute: true,
        ignore: ['node_modules/**', '.git/**', 'dist/**', 'build/**']
      });
      
      const report = frontMatterProcessor.generateCategoryReport(files);
      
      console.log("\n=== Category Analysis Report ===");
      console.log(`Total Files: ${report.totalFiles}`);
      console.log(`Categorized Files: ${report.categorizedFiles}`);
      console.log(`Uncategorized Files: ${report.uncategorizedFiles}`);
      console.log(`Category Coverage: ${((report.categorizedFiles / report.totalFiles) * 100).toFixed(1)}%`);
      
      console.log("\n=== Category Counts ===");
      Object.entries(report.categoryCounts).forEach(([category, count]) => {
        console.log(`${category}: ${count} files`);
      });
      
      if (report.suggestions.length > 0) {
        console.log("\n=== Suggestions ===");
        report.suggestions.slice(0, 10).forEach(suggestion => {
          console.log(`- ${suggestion}`);
        });
        if (report.suggestions.length > 10) {
          console.log(`... and ${report.suggestions.length - 10} more suggestions`);
        }
      }
      
      console.log("===============================\n");
    } catch (error) {
      logger.error(`Failed to generate category report: ${error.message}`);
      throw error;
    }
  }

  /**
   * 修复分类结构
   */
  async fixCategories(filePaths?: string[]): Promise<void> {
    try {
      const frontMatterProcessor = this.service.getFrontMatterProcessor();
      let targetFiles = filePaths;
      
      if (!targetFiles) {
        // 获取所有Markdown文件
        const glob = await import('glob');
        targetFiles = glob.globSync('**/*.{md,mdx}', { 
          cwd: this.service.getStatus().folderPath,
          absolute: true,
          ignore: ['node_modules/**', '.git/**', 'dist/**', 'build/**']
        });
      }
      
      logger.info(`Fixing categories for ${targetFiles.length} files...`);
      
      let fixedCount = 0;
      for (const filePath of targetFiles) {
        try {
          const file = frontMatterProcessor.parseFrontMatter(filePath);
          const originalFrontMatter = { ...file.data };
          
          const fixedFrontMatter = frontMatterProcessor.validateAndFixCategories(file.data, filePath);
          
          if (JSON.stringify(originalFrontMatter.categories) !== JSON.stringify(fixedFrontMatter.categories)) {
            frontMatterProcessor.injectFrontMatter(filePath, fixedFrontMatter, file);
            fixedCount++;
            logger.info(`Fixed categories for: ${path.basename(filePath)}`);
          }
        } catch (error) {
          logger.error(`Failed to fix categories for ${filePath}: ${error.message}`);
        }
      }
      
      logger.info(`Categories fixed for ${fixedCount} files`);
    } catch (error) {
      logger.error(`Failed to fix categories: ${error.message}`);
      throw error;
    }
  }

  /**
   * 清理备份文件
   */
  async cleanupBackups(): Promise<void> {
    try {
      const backupManager = this.service.getBackupManager();
      await backupManager.cleanupOldBackups();
      logger.info("Backup cleanup completed");
    } catch (error) {
      logger.error(`Backup cleanup failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * 重新加载配置
   */
  async reloadConfig(args: CLIArgs): Promise<void> {
    try {
      const fileWatcherManager = this.service.getFileWatcherManager();
      await fileWatcherManager.reloadConfig(args);
      logger.info("Configuration reloaded successfully");
    } catch (error) {
      logger.error(`Failed to reload configuration: ${error.message}`);
      throw error;
    }
  }
}