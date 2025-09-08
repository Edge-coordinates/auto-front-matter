import * as path from "path";
import { 
  FrontMatterTemplate, 
  FrontMatterData, 
  FileInfo, 
  AutoFMError 
} from "../types/index.js";
import { 
  logger, 
  parseFileInfo, 
  parseFileNameDate, 
  generateCurrentDate,
  sanitizeString 
} from "../utils/index.js";
import { ConfigManager } from "../config/index.js";

/**
 * 模板管理器
 */
export class TemplateManager {
  private configManager: ConfigManager;
  private folderPath: string;

  constructor(folderPath: string, configManager: ConfigManager) {
    this.folderPath = folderPath;
    this.configManager = configManager;
  }

  /**
   * 应用模板到文件
   */
  applyTemplate(filePath: string, templateName: string = 'default'): FrontMatterData {
    try {
      const template = this.configManager.getTemplate(templateName);
      if (!template) {
        throw new AutoFMError(`Template not found: ${templateName}`, 'TEMPLATE_NOT_FOUND');
      }

      const fileInfo = parseFileInfo(filePath, this.folderPath);
      const frontMatter: FrontMatterData = {};

      // 处理每个模板字段
      Object.keys(template).forEach(key => {
        const value = template[key];
        frontMatter[key] = this.processTemplateValue(key, value, filePath, fileInfo);
      });

      logger.debug(`Template '${templateName}' applied to: ${filePath}`);
      return frontMatter;
    } catch (error) {
      if (error instanceof AutoFMError) {
        throw error;
      }
      throw new AutoFMError(`Failed to apply template: ${error.message}`, 'TEMPLATE_APPLY_ERROR', filePath);
    }
  }

  /**
   * 创建新模板
   */
  createTemplate(name: string, template: FrontMatterTemplate): void {
    try {
      if (!name || name.trim() === '') {
        throw new AutoFMError('Template name cannot be empty', 'INVALID_TEMPLATE_NAME');
      }

      if (!template || typeof template !== 'object') {
        throw new AutoFMError('Template must be an object', 'INVALID_TEMPLATE');
      }

      this.configManager.addTemplate(name, template);
      logger.info(`Template '${name}' created successfully`);
    } catch (error) {
      if (error instanceof AutoFMError) {
        throw error;
      }
      throw new AutoFMError(`Failed to create template: ${error.message}`, 'TEMPLATE_CREATE_ERROR');
    }
  }

  /**
   * 删除模板
   */
  deleteTemplate(name: string): boolean {
    try {
      const result = this.configManager.removeTemplate(name);
      if (result) {
        logger.info(`Template '${name}' deleted successfully`);
      } else {
        logger.warn(`Template '${name}' not found or cannot be deleted`);
      }
      return result;
    } catch (error) {
      logger.error(`Failed to delete template '${name}': ${error.message}`);
      return false;
    }
  }

  /**
   * 获取模板列表
   */
  listTemplates(): string[] {
    return this.configManager.getTemplateNames();
  }

  /**
   * 获取模板详情
   */
  getTemplate(name: string): FrontMatterTemplate | null {
    return this.configManager.getTemplate(name) || null;
  }

  /**
   * 验证模板
   */
  validateTemplate(template: FrontMatterTemplate): boolean {
    try {
      if (!template || typeof template !== 'object') {
        return false;
      }

      // 检查必要字段
      const requiredFields = ['title'];
      for (const field of requiredFields) {
        if (!(field in template)) {
          return false;
        }
      }

      // 验证字段类型
      Object.keys(template).forEach(key => {
        const value = template[key];
        if (!this.isValidTemplateValue(value)) {
          throw new Error(`Invalid value for field '${key}'`);
        }
      });

      return true;
    } catch (error) {
      logger.error(`Template validation failed: ${error.message}`);
      return false;
    }
  }

  /**
   * 处理模板值
   */
  private processTemplateValue(key: string, value: any, filePath: string, fileInfo: FileInfo): any {
    if (typeof value === 'function') {
      return this.processTemplateFunction(key, value, filePath, fileInfo);
    }

    if (typeof value === 'string') {
      return this.processTemplateString(key, value, filePath, fileInfo);
    }

    if (Array.isArray(value)) {
      return this.processTemplateArray(key, value, filePath, fileInfo);
    }

    return value;
  }

  /**
   * 处理模板函数
   */
  private processTemplateFunction(key: string, func: Function, filePath: string, fileInfo: FileInfo): any {
    try {
      switch (key) {
        case 'title':
          return func(filePath, fileInfo.fileName);
        case 'date':
          return func();
        case 'categories':
        case 'tags':
          return func(filePath);
        default:
          return func(filePath, fileInfo);
      }
    } catch (error) {
      logger.error(`Error executing template function for '${key}': ${error.message}`);
      return this.getDefaultValue(key, fileInfo);
    }
  }

  /**
   * 处理模板字符串（支持变量替换）
   */
  private processTemplateString(key: string, template: string, filePath: string, fileInfo: FileInfo): string {
    let result = template;

    // 支持的变量
    const variables = {
      '{filename}': fileInfo.baseName,
      '{basename}': fileInfo.baseName,
      '{extension}': fileInfo.extension,
      '{path}': fileInfo.relativePath,
      '{dirname}': path.dirname(fileInfo.relativePath),
      '{date}': this.getDateFromFileName(fileInfo.baseName) || generateCurrentDate(),
      '{title}': this.getTitleFromFileName(fileInfo.baseName) || fileInfo.baseName
    };

    // 替换变量
    Object.keys(variables).forEach(variable => {
      result = result.replace(new RegExp(variable.replace(/[{}]/g, '\\$&'), 'g'), variables[variable]);
    });

    return sanitizeString(result);
  }

  /**
   * 处理模板数组
   */
  private processTemplateArray(key: string, array: any[], filePath: string, fileInfo: FileInfo): any[] {
    return array.map(item => {
      if (typeof item === 'string') {
        return this.processTemplateString(key, item, filePath, fileInfo);
      }
      return item;
    });
  }

  /**
   * 从文件名获取日期
   */
  private getDateFromFileName(fileName: string): string | null {
    const { date } = parseFileNameDate(fileName);
    if (date) {
      const config = this.configManager.getConfig();
      return generateCurrentDate(config.dateFormat, config.timezone);
    }
    return null;
  }

  /**
   * 从文件名获取标题
   */
  private getTitleFromFileName(fileName: string): string | null {
    const { title } = parseFileNameDate(fileName);
    return title ? sanitizeString(title) : null;
  }

  /**
   * 获取默认值
   */
  private getDefaultValue(key: string, fileInfo: FileInfo): any {
    switch (key) {
      case 'title':
        return this.getTitleFromFileName(fileInfo.baseName) || fileInfo.baseName;
      case 'date':
        const config = this.configManager.getConfig();
        return generateCurrentDate(config.dateFormat, config.timezone);
      case 'categories':
        return this.generateCategoriesFromPath(fileInfo);
      case 'tags':
        return [];
      default:
        return null;
    }
  }

  /**
   * 从路径生成分类
   */
  private generateCategoriesFromPath(fileInfo: FileInfo): string[] {
    const config = this.configManager.getConfig();
    const categories: string[] = [];
    
    for (let i = 0; i < fileInfo.parts.length - 1; i++) {
      const part = fileInfo.parts[i];
      if (!part || 
          part === "~" || 
          part === "." || 
          part === config.filePatterns.posts || 
          part === config.filePatterns.drafts ||
          config.noCategory.includes(part)) {
        continue;
      }
      if (!categories.includes(part)) {
        categories.push(part);
      }
    }

    return categories;
  }

  /**
   * 验证模板值是否有效
   */
  private isValidTemplateValue(value: any): boolean {
    if (value === null || value === undefined) {
      return true;
    }

    if (typeof value === 'string' || 
        typeof value === 'number' || 
        typeof value === 'boolean' ||
        typeof value === 'function') {
      return true;
    }

    if (Array.isArray(value)) {
      return value.every(item => 
        typeof item === 'string' || 
        typeof item === 'number' || 
        typeof item === 'boolean'
      );
    }

    if (typeof value === 'object') {
      return Object.values(value).every(v => this.isValidTemplateValue(v));
    }

    return false;
  }
}

/**
 * 预定义模板
 */
export const PREDEFINED_TEMPLATES = {
  blog: {
    title: '{title}',
    date: () => generateCurrentDate(),
    categories: (filePath: string) => {
      const fileInfo = parseFileInfo(filePath, '');
      return fileInfo.parts.slice(0, -1).filter(part => part && part !== '_posts' && part !== '_drafts');
    },
    tags: [],
    author: 'AutoFM',
    draft: false
  },

  note: {
    title: '{title}',
    date: () => generateCurrentDate(),
    type: 'note',
    tags: []
  },

  journal: {
    title: '{date} Journal',
    date: () => generateCurrentDate(),
    type: 'journal',
    mood: '',
    weather: ''
  },

  tutorial: {
    title: '{title}',
    date: () => generateCurrentDate(),
    categories: ['tutorial'],
    tags: [],
    difficulty: 'beginner',
    duration: '30 minutes'
  }
};

/**
 * 初始化预定义模板
 */
export function initializePredefinedTemplates(configManager: ConfigManager): void {
  Object.keys(PREDEFINED_TEMPLATES).forEach(name => {
    if (!configManager.getTemplate(name)) {
      configManager.addTemplate(name, PREDEFINED_TEMPLATES[name]);
      logger.info(`Predefined template '${name}' added`);
    }
  });
}
