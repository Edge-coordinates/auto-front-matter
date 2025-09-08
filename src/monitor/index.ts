import * as fs from "fs-extra";
import * as path from "path";
import { EventEmitter } from "events";
import { AutoFrontMatterService } from "../lib/index.js";
import { logger, formatFileSize } from "../utils/index.js";

/**
 * 性能监控数据
 */
interface PerformanceMetrics {
  processedFiles: number;
  totalProcessingTime: number;
  averageProcessingTime: number;
  errorCount: number;
  lastError?: Error;
  backupCount: number;
  backupSize: number;
}

/**
 * 监控事件
 */
export interface MonitorEvents {
  'file-processed': (filePath: string, processingTime: number) => void;
  'error': (error: Error, filePath?: string) => void;
  'performance-update': (metrics: PerformanceMetrics) => void;
  'backup-created': (filePath: string, backupPath: string, size: number) => void;
}

/**
 * 服务监控器
 */
export class ServiceMonitor extends EventEmitter {
  private service: AutoFrontMatterService;
  private metrics: PerformanceMetrics;
  private startTime: number;

  constructor(service: AutoFrontMatterService) {
    super();
    this.service = service;
    this.metrics = {
      processedFiles: 0,
      totalProcessingTime: 0,
      averageProcessingTime: 0,
      errorCount: 0,
      backupCount: 0,
      backupSize: 0
    };
    this.startTime = Date.now();
  }

  /**
   * 开始监控
   */
  start(): void {
    logger.info("Service monitor started");
    
    // 定期更新性能指标
    setInterval(() => {
      this.updateMetrics();
    }, 5000); // 每5秒更新一次
  }

  /**
   * 记录文件处理
   */
  recordFileProcessing(filePath: string, processingTime: number): void {
    this.metrics.processedFiles++;
    this.metrics.totalProcessingTime += processingTime;
    this.metrics.averageProcessingTime = this.metrics.totalProcessingTime / this.metrics.processedFiles;
    
    this.emit('file-processed', filePath, processingTime);
    
    logger.debug(`File processed: ${filePath} (${processingTime}ms)`);
  }

  /**
   * 记录错误
   */
  recordError(error: Error, filePath?: string): void {
    this.metrics.errorCount++;
    this.metrics.lastError = error;
    
    this.emit('error', error, filePath);
    
    logger.error(`Error recorded: ${error.message}`, filePath ? `(${filePath})` : '');
  }

  /**
   * 记录备份创建
   */
  recordBackupCreated(filePath: string, backupPath: string, size: number): void {
    this.metrics.backupCount++;
    this.metrics.backupSize += size;
    
    this.emit('backup-created', filePath, backupPath, size);
    
    logger.debug(`Backup created: ${backupPath} (${formatFileSize(size)})`);
  }

  /**
   * 获取性能指标
   */
  getMetrics(): PerformanceMetrics & { uptime: number } {
    return {
      ...this.metrics,
      uptime: Date.now() - this.startTime
    };
  }

  /**
   * 获取详细状态
   */
  getDetailedStatus(): any {
    const metrics = this.getMetrics();
    const serviceStatus = this.service.getStatus();
    
    return {
      service: serviceStatus,
      performance: {
        uptime: this.formatUptime(metrics.uptime),
        processedFiles: metrics.processedFiles,
        averageProcessingTime: `${metrics.averageProcessingTime.toFixed(2)}ms`,
        errorRate: metrics.processedFiles > 0 ? `${((metrics.errorCount / metrics.processedFiles) * 100).toFixed(2)}%` : '0%',
        backupCount: metrics.backupCount,
        backupSize: formatFileSize(metrics.backupSize)
      },
      errors: {
        count: metrics.errorCount,
        lastError: metrics.lastError ? {
          message: metrics.lastError.message,
          timestamp: new Date().toISOString()
        } : null
      }
    };
  }

  /**
   * 生成监控报告
   */
  async generateReport(): Promise<string> {
    const status = this.getDetailedStatus();
    
    const report = `
# AutoFrontMatter Monitor Report

## Service Status
- Folder: ${status.service.folderPath}
- Watching: ${status.service.watching ? 'Active' : 'Inactive'}
- Files: ${status.service.watcherStats?.files || 0}
- Directories: ${status.service.watcherStats?.directories || 0}

## Performance Metrics
- Uptime: ${status.performance.uptime}
- Processed Files: ${status.performance.processedFiles}
- Average Processing Time: ${status.performance.averageProcessingTime}
- Error Rate: ${status.performance.errorRate}

## Backup Statistics
- Total Backups: ${status.performance.backupCount}
- Total Backup Size: ${status.performance.backupSize}

## Configuration
- Date Format: ${status.service.config.dateFormat}
- Timezone: ${status.service.config.timezone}
- Backup Enabled: ${status.service.config.backup.enabled}
- Templates: ${Object.keys(status.service.config.templates).join(', ')}

## Error Summary
- Total Errors: ${status.errors.count}
${status.errors.lastError ? `- Last Error: ${status.errors.lastError.message} (${status.errors.lastError.timestamp})` : '- No recent errors'}

---
Generated at: ${new Date().toISOString()}
`;

    return report;
  }

  /**
   * 保存监控报告
   */
  async saveReport(outputPath?: string): Promise<string> {
    try {
      const report = await this.generateReport();
      const fileName = outputPath || `autofm-report-${new Date().toISOString().replace(/:/g, '-')}.md`;
      const fullPath = path.resolve(fileName);
      
      await fs.writeFile(fullPath, report, 'utf8');
      
      logger.info(`Monitor report saved: ${fullPath}`);
      return fullPath;
    } catch (error) {
      logger.error(`Failed to save monitor report: ${error.message}`);
      throw error;
    }
  }

  /**
   * 重置指标
   */
  resetMetrics(): void {
    this.metrics = {
      processedFiles: 0,
      totalProcessingTime: 0,
      averageProcessingTime: 0,
      errorCount: 0,
      backupCount: 0,
      backupSize: 0
    };
    this.startTime = Date.now();
    
    logger.info("Monitor metrics reset");
  }

  /**
   * 更新性能指标
   */
  private updateMetrics(): void {
    this.emit('performance-update', this.metrics);
  }

  /**
   * 格式化运行时间
   */
  private formatUptime(milliseconds: number): string {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) {
      return `${days}d ${hours % 24}h ${minutes % 60}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }
}
