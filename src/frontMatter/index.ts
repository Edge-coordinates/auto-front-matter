import * as YAML from "yaml";
import matter from "gray-matter";
import _ from "lodash";
import { 
  GrayMatterFile, 
  FrontMatterData, 
  FileInfo,
  AutoFMError,
  CLIArgs,
  AppConfig 
} from "../types/index.js";
import { 
  logger, 
  readFileSafe, 
  writeFileSafe, 
  isEmptyObject, 
  parseFileInfo, 
  parseFileNameDate, 
  generateCurrentDate 
} from "../utils/index.js";
import { ConfigManager } from "../config/index.js";

/**
 * Front Matter处理器
 */
export class FrontMatterProcessor {
  private configManager: ConfigManager;
  private folderPath: string;

  constructor(folderPath: string, configManager: ConfigManager) {
    this.folderPath = folderPath;
    this.configManager = configManager;
  }

  /**
   * 解析文件的Front Matter
   */
  parseFrontMatter(filePath: string): GrayMatterFile {
    try {
      const fileContent = readFileSafe(filePath);
      return matter(fileContent);
    } catch (error) {
      throw new AutoFMError(`Failed to parse front matter: ${error.message}`, 'PARSE_ERROR', filePath);
    }
  }

  /**
   * 生成Front Matter数据
   */
  generateFrontMatter(filePath: string, templateName: string = 'default'): FrontMatterData {
    const fileInfo = parseFileInfo(filePath, this.folderPath);
    const config = this.configManager.getConfig();
    const template = this.configManager.getTemplate(templateName);
    
    // 解析文件名中的日期和标题
    const { date: fileDate, title: fileTitle } = parseFileNameDate(fileInfo.baseName);
    
    // 生成标题
    let title = fileTitle || fileInfo.baseName;
    if (template.title) {
      if (typeof template.title === 'function') {
        title = template.title(filePath, fileInfo.fileName);
      } else if (typeof template.title === 'string') {
        title = template.title;
      }
    }

    // 生成日期
    let date: string;
    if (fileDate) {
      date = generateCurrentDate(config.dateFormat, config.timezone);
    } else {
      date = generateCurrentDate(config.dateFormat, config.timezone);
    }
    if (template.date) {
      if (typeof template.date === 'function') {
        date = template.date();
      } else if (typeof template.date === 'string') {
        date = template.date;
      }
    }

    // 生成分类
    let categories: string[] = [];
    const parts = fileInfo.parts;
    
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
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

    if (template.categories) {
      if (typeof template.categories === 'function') {
        categories = template.categories(filePath);
      } else if (Array.isArray(template.categories)) {
        categories = [...template.categories];
      }
    }

    // 生成标签
    let tags: string[] = [];
    if (template.tags) {
      if (typeof template.tags === 'function') {
        tags = template.tags(filePath);
      } else if (Array.isArray(template.tags)) {
        tags = [...template.tags];
      }
    }

    // 构建Front Matter数据
    const frontMatter: FrontMatterData = {
      title,
      date,
      ...(categories.length > 0 && { categories }),
      ...(tags.length > 0 && { tags })
    };

    // 添加自定义字段
    const customFields = this.configManager.getCustomFields();
    Object.assign(frontMatter, customFields);

    // 添加模板中的其他字段
    Object.keys(template).forEach(key => {
      if (!['title', 'date', 'categories', 'tags'].includes(key)) {
        frontMatter[key] = template[key];
      }
    });

    return frontMatter;
  }

  /**
   * 注入Front Matter到文件
   */
  injectFrontMatter(filePath: string, frontMatter: FrontMatterData, file: GrayMatterFile): void {
    try {
      // 检查是否需要注入
      if (!frontMatter || frontMatter.notAutofm || _.isEqual(frontMatter, file.data)) {
        logger.debug(`No need to inject front matter for: ${filePath}`);
        return;
      }

      // 排序Front Matter字段
      const sortedFrontMatter = this.sortFrontMatterKeys(frontMatter);

      // 确保有日期
      if (!sortedFrontMatter.date) {
        const config = this.configManager.getConfig();
        sortedFrontMatter.date = generateCurrentDate(config.dateFormat, config.timezone);
      }

      // 生成YAML内容
      const frontMatterContent = "---\n" + YAML.stringify(sortedFrontMatter) + "---\n";
      
      // 构建最终内容
      const finalContent = frontMatterContent + (file.content || "");

      // 写入文件
      writeFileSafe(filePath, finalContent);
      logger.info(`Front matter injected successfully: ${filePath}`);
    } catch (error) {
      throw new AutoFMError(`Failed to inject front matter: ${error.message}`, 'INJECT_ERROR', filePath);
    }
  }

  /**
   * 初始化文件的Front Matter
   */
  initializeFrontMatter(filePath: string, templateName: string = 'default'): void {
    try {
      const file = this.parseFrontMatter(filePath);
      
      if (isEmptyObject(file.data)) {
        logger.info(`Initializing front matter for new file: ${filePath}`);
        const frontMatter = this.generateFrontMatter(filePath, templateName);
        this.injectFrontMatter(filePath, frontMatter, file);
      } else {
        logger.debug(`File already has front matter: ${filePath}`);
      }
    } catch (error) {
      logger.error(`Failed to initialize front matter for ${filePath}: ${error.message}`);
      throw error;
    }
  }

  /**
   * 更新文件的Front Matter
   */
  updateFrontMatter(filePath: string, args: CLIArgs, templateName: string = 'default'): void {
    try {
      const file = this.parseFrontMatter(filePath);
      
      if (isEmptyObject(file.data)) {
        logger.info(`Empty file, initializing: ${filePath}`);
        const frontMatter = this.generateFrontMatter(filePath, templateName);
        this.injectFrontMatter(filePath, frontMatter, file);
        return;
      }

      let frontMatter = _.cloneDeep(file.data);
      const generatedFrontMatter = this.generateFrontMatter(filePath, templateName);

      // 更新标题
      if (args.force || !frontMatter.title) {
        frontMatter.title = generatedFrontMatter.title;
      }

      // 更新日期（不强制更新已有日期）
      if (!frontMatter.date) {
        frontMatter.date = generatedFrontMatter.date;
      }

      // 更新分类
      if (args.force || args.ct || !frontMatter.categories || isEmptyObject(frontMatter.categories)) {
        if (generatedFrontMatter.categories && generatedFrontMatter.categories.length > 0) {
          frontMatter.categories = generatedFrontMatter.categories;
        }
      }

      // 更新标签
      if (args.force || args.ct || !frontMatter.tags || isEmptyObject(frontMatter.tags)) {
        if (generatedFrontMatter.tags && generatedFrontMatter.tags.length > 0) {
          frontMatter.tags = generatedFrontMatter.tags;
        }
      }

      this.injectFrontMatter(filePath, frontMatter, file);
    } catch (error) {
      logger.error(`Failed to update front matter for ${filePath}: ${error.message}`);
      throw error;
    }
  }

  /**
   * 根据配置排序Front Matter字段
   */
  private sortFrontMatterKeys(frontMatter: FrontMatterData): FrontMatterData {
    const keyOrder = this.configManager.getKeyOrder();
    const sorted: FrontMatterData = {};

    // 按照配置的顺序添加字段
    keyOrder.forEach(key => {
      if (frontMatter.hasOwnProperty(key)) {
        sorted[key] = frontMatter[key];
      }
    });

    // 添加剩余字段
    Object.keys(frontMatter).forEach(key => {
      if (!sorted.hasOwnProperty(key)) {
        sorted[key] = frontMatter[key];
      }
    });

    return sorted;
  }

  /**
   * 验证Front Matter数据
   */
  validateFrontMatter(frontMatter: FrontMatterData): boolean {
    try {
      // 基本验证
      if (!frontMatter.title || typeof frontMatter.title !== 'string') {
        return false;
      }

      // 验证日期
      if (frontMatter.date && !isValidDate(frontMatter.date.toString())) {
        return false;
      }

      // 验证分类
      if (frontMatter.categories) {
        if (!Array.isArray(frontMatter.categories) && typeof frontMatter.categories !== 'string') {
          return false;
        }
      }

      // 验证标签
      if (frontMatter.tags) {
        if (!Array.isArray(frontMatter.tags) && typeof frontMatter.tags !== 'string') {
          return false;
        }
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * 清理Front Matter数据
   */
  cleanFrontMatter(frontMatter: FrontMatterData): FrontMatterData {
    const cleaned: FrontMatterData = {};

    Object.keys(frontMatter).forEach(key => {
      const value = frontMatter[key];
      
      if (value === null || value === undefined) {
        return;
      }

      if (typeof value === 'string' && value.trim() === '') {
        return;
      }

      if (Array.isArray(value) && value.length === 0) {
        return;
      }

      cleaned[key] = value;
    });

    return cleaned;
  }
}

/**
 * 验证日期格式的辅助函数
 */
function isValidDate(dateStr: string): boolean {
  const date = new Date(dateStr);
  return date instanceof Date && !isNaN(date.getTime());
}
