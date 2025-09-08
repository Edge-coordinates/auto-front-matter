import matter from "gray-matter";
import _ from "lodash";
import * as YAML from "yaml";
import { ConfigManager } from "../config/index.js";
import { AppConfig, AutoFMError, CLIArgs, FileInfo, FrontMatterData, GrayMatterFile } from "../types/index.js";
import {
  generateCurrentDate,
  isEmptyObject,
  logger,
  parseFileInfo,
  parseFileNameDate,
  readFileSafe,
  writeFileSafe,
} from "../utils/index.js";

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
      throw new AutoFMError(`Failed to parse front matter: ${error.message}`, "PARSE_ERROR", filePath);
    }
  }

  /**
   * 生成Front Matter数据
   */
  generateFrontMatter(filePath: string, templateName: string = "default"): FrontMatterData {
    const fileInfo = parseFileInfo(filePath, this.folderPath);
    const config = this.configManager.getConfig();
    const template = this.configManager.getTemplate(templateName);

    // 解析文件名中的日期和标题
    const { date: fileDate, title: fileTitle } = parseFileNameDate(fileInfo.baseName);

    // 生成标题
    let title = fileTitle || fileInfo.baseName;
    if (template.title) {
      if (typeof template.title === "function") {
        title = template.title(filePath, fileInfo.fileName);
      } else if (typeof template.title === "string" && template.title !== "{title}") {
        // 只有当模板提供了具体的标题时才覆盖，不使用占位符
        title = template.title;
      }
      // 如果模板的title是'{title}'占位符，保持使用从文件名生成的标题
    }

    // 生成日期
    let date: string;
    if (fileDate) {
      date = generateCurrentDate(config.dateFormat, config.timezone);
    } else {
      date = generateCurrentDate(config.dateFormat, config.timezone);
    }
    if (template.date) {
      if (typeof template.date === "function") {
        date = template.date();
      } else if (typeof template.date === "string") {
        date = template.date;
      }
    }

    // 生成分类 - 完善的树状目录分类生成
    let categories: any = this.generateCategoriesFromPath(fileInfo, config);

    // 模板覆盖分类生成（只有在模板明确提供非空分类时才覆盖）
    if (template.categories) {
      if (typeof template.categories === "function") {
        categories = template.categories(filePath);
      } else if (Array.isArray(template.categories) && template.categories.length > 0) {
        // 只有当模板提供了具体的分类内容时才覆盖
        categories = template.categories;
      }
      // 如果模板的categories是空数组，保持使用从路径生成的分类
    }

    // 生成标签
    let tags: string[] = [];
    if (template.tags) {
      if (typeof template.tags === "function") {
        tags = template.tags(filePath);
      } else if (Array.isArray(template.tags)) {
        tags = [...template.tags];
      }
    }

    // 构建Front Matter数据
    const frontMatter: FrontMatterData = {
      title,
      date,
      ...(categories && categories.length > 0 && { categories }),
      ...(tags.length > 0 && { tags }),
    };

    // 添加自定义字段
    const customFields = this.configManager.getCustomFields();
    Object.assign(frontMatter, customFields);

    // 添加模板中的其他字段
    Object.keys(template).forEach(key => {
      if (!["title", "date", "categories", "tags"].includes(key)) {
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
      throw new AutoFMError(`Failed to inject front matter: ${error.message}`, "INJECT_ERROR", filePath);
    }
  }

  /**
   * 初始化文件的Front Matter
   */
  initializeFrontMatter(filePath: string, templateName: string = "default"): void {
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
  updateFrontMatter(filePath: string, args: CLIArgs, templateName: string = "default"): void {
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

      // 保护关键字段：永远不更新日期、abbrlink等重要字段
      if (!frontMatter.date) {
        frontMatter.date = generatedFrontMatter.date;
      }

      // 检查并保护配置中指定的字段
      this.protectImportantFields(frontMatter, generatedFrontMatter);

      // 更新分类 - 增强的分类处理逻辑
      if (args.force || args.ct || !frontMatter.categories || this.isCategoriesEmpty(frontMatter.categories)) {
        const config = this.configManager.getConfig();
        const newCategories = this.generateCategoriesFromPath(parseFileInfo(filePath, this.folderPath), config);
        if (newCategories && newCategories.length > 0) {
          // 当为树状（层级）结构时，只替换第一个分类链，保留后续自定义分类
          const isHierarchy = Array.isArray(newCategories[0]) || config.categoryMode === "hierarchy";
          if (isHierarchy) {
            const generatedChain: string[] = Array.isArray(newCategories[0])
              ? (newCategories[0] as string[])
              : (newCategories as unknown as string[]);

            const existing = frontMatter.categories as unknown as any;
            let preservedTail: any[] = [];

            if (existing) {
              if (Array.isArray(existing)) {
                // 形如 [[a,b,c], 'hello', ...] 或 ['hello', 'tag2']
                if (Array.isArray(existing[0])) {
                  preservedTail = existing.slice(1);
                } else {
                  preservedTail = existing.filter((e) => typeof e === "string" || Array.isArray(e));
                }
              } else if (typeof existing === "string") {
                preservedTail = [existing];
              }
            }
            if (args.force) {
              frontMatter.categories = [generatedChain];
            } else {
              frontMatter.categories = [generatedChain, ...preservedTail];
            }
            logger.debug(
              `Replaced primary hierarchical category chain for ${filePath}: [${
                generatedChain.join(" > ")
              }], preserved ${preservedTail.length} extra categories`,
            );
          } else {
            // 非层级结构，直接覆盖
            frontMatter.categories = newCategories;
            logger.debug(`Updated flat categories for ${filePath}: [${(newCategories as string[]).join(", ")}]`);
          }
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
   * 更新 updated 字段
   */
  updateUpdatedField(filePath: string): void {
    try {
      const file = this.parseFrontMatter(filePath);
      let frontMatter = _.cloneDeep(file.data || {});
      const config = this.configManager.getConfig();
      frontMatter.updated = generateCurrentDate(config.dateFormat, config.timezone);
      this.injectFrontMatter(filePath, frontMatter, file);
      logger.info(`Updated 'updated' field for: ${filePath}`);
    } catch (error) {
      logger.error(`Failed to update 'updated' field for ${filePath}: ${error.message}`);
      throw error;
    }
  }

  /**
   * 根据文件名更新 title 字段（用于重命名后同步标题）
   */
  updateTitleFromFileName(filePath: string): void {
    try {
      const file = this.parseFrontMatter(filePath);
      const fileInfo = parseFileInfo(filePath, this.folderPath);
      const { title: fileTitle } = parseFileNameDate(fileInfo.baseName);
      const newTitle = fileTitle || fileInfo.baseName;

      const current = _.cloneDeep(file.data || {});
      if (current.title !== newTitle) {
        current.title = newTitle;
        this.injectFrontMatter(filePath, current, file);
        logger.info(`Updated 'title' from filename for: ${filePath}`);
      } else {
        logger.debug(`Title already matches filename for: ${filePath}`);
      }
    } catch (error) {
      logger.error(`Failed to update 'title' from filename for ${filePath}: ${error.message}`);
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
      if (!frontMatter.title || typeof frontMatter.title !== "string") {
        return false;
      }

      // 验证日期
      if (frontMatter.date && !isValidDate(frontMatter.date.toString())) {
        return false;
      }

      // 验证分类
      if (frontMatter.categories) {
        if (!Array.isArray(frontMatter.categories) && typeof frontMatter.categories !== "string") {
          return false;
        }
      }

      // 验证标签
      if (frontMatter.tags) {
        if (!Array.isArray(frontMatter.tags) && typeof frontMatter.tags !== "string") {
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

      if (typeof value === "string" && value.trim() === "") {
        return;
      }

      if (Array.isArray(value) && value.length === 0) {
        return;
      }

      cleaned[key] = value;
    });

    return cleaned;
  }

  /**
   * 从路径生成分类 - 完善的分类生成算法
   */
  private generateCategoriesFromPath(fileInfo: FileInfo, config: AppConfig): any {
    const categories: string[] = [];
    const parts = fileInfo.parts;

    logger.debug(`=== generateCategoriesFromPath ===`);
    logger.debug(`File path: ${fileInfo.filePath}`);
    logger.debug(`Relative path: ${fileInfo.relativePath}`);
    logger.debug(`Path parts: [${parts.join(", ")}]`);
    logger.debug(`Parts length: ${parts.length}`);

    // 如果文件直接在根目录，没有子目录结构
    if (parts.length <= 1) {
      logger.debug(`File is in root directory, no categories to generate`);
      return [];
    }

    // 遍历路径的每个部分（除了最后一个，那是文件名）
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      logger.debug(`Processing part ${i}: "${part}"`);

      // 跳过特殊目录和配置中指定的无分类目录
      if (this.shouldSkipDirectory(part, config)) {
        logger.debug(`Skipping directory: "${part}" (special/ignored directory)`);
        continue;
      }

      // 目录名规范化处理
      const normalizedPart = this.normalizeCategoryName(part);
      logger.debug(`Normalized "${part}" to "${normalizedPart}"`);

      if (normalizedPart && !categories.includes(normalizedPart)) {
        categories.push(normalizedPart);
        logger.debug(`✅ Added category: "${normalizedPart}"`);
      } else if (!normalizedPart) {
        logger.debug(`❌ Skipped empty normalized part for: "${part}"`);
      } else {
        logger.debug(`❌ Skipped duplicate category: "${normalizedPart}"`);
      }
    }

    // 如果没有生成任何分类，但文件确实在子目录中，尝试使用最近的父目录
    if (categories.length === 0 && parts.length > 1) {
      logger.debug(`No categories generated, trying parent directory fallback`);

      // 从后往前找第一个有效的目录名
      for (let i = parts.length - 2; i >= 0; i--) {
        const parentDir = parts[i];
        logger.debug(`Trying parent directory: "${parentDir}"`);

        if (!this.shouldSkipDirectory(parentDir, config)) {
          const normalizedParent = this.normalizeCategoryName(parentDir);
          if (normalizedParent) {
            categories.push(normalizedParent);
            logger.debug(`✅ Added parent directory as category: "${normalizedParent}"`);
            break;
          }
        }
      }
    }

    // 根据配置进行分类层级处理
    const processedCategories = this.processCategoryHierarchy(categories, config);

    if (Array.isArray(processedCategories) && processedCategories.length > 0) {
      if (Array.isArray(processedCategories[0])) {
        // 已经是层级结构
        logger.info(
          `📁 Generated hierarchical categories for "${fileInfo.fileName}": [${processedCategories[0].join(" > ")}]`,
        );
      } else {
        // 平级结构
        logger.info(`📁 Generated flat categories for "${fileInfo.fileName}": [${processedCategories.join(", ")}]`);
      }
    }
    return processedCategories;
  }

  /**
   * 判断是否应该跳过目录
   */
  private shouldSkipDirectory(dirName: string, config: AppConfig): boolean {
    if (!dirName || dirName.trim() === "") return true;

    // 系统目录
    const systemDirs = ["~", ".", "..", "node_modules", ".git", "dist", "build"];
    if (systemDirs.includes(dirName)) return true;

    // Hexo/Jekyll 特殊目录
    const specialDirs = [
      config.filePatterns?.posts || "_posts",
      config.filePatterns?.drafts || "_drafts",
      "source",
      "public",
      "themes",
      "_site",
    ];
    if (specialDirs.includes(dirName)) return true;

    // 隐藏目录
    if (dirName.startsWith(".")) return true;

    // 配置中的无分类目录
    if (config.noCategory && config.noCategory.includes(dirName)) return true;

    return false;
  }

  /**
   * 规范化分类名称
   */
  private normalizeCategoryName(name: string): string {
    if (!name || typeof name !== "string") return "";

    const original = name;

    let normalized = name
      .trim()
      // 将多个空格转换为单个连字符
      .replace(/\s+/g, "-");
    // let normalized = name
    //   .trim()
    //   // 保留原始大小写，只处理特殊字符
    //   // 保留中文、英文、数字、连字符、下划线
    //   .replace(/[^\u4e00-\u9fa5a-zA-Z0-9\-_\s]/g, "")
    //   // 将多个空格转换为单个连字符
    //   .replace(/\s+/g, "-")
    //   // 移除多余的连字符和下划线
    //   .replace(/[-_]+/g, "-")
    //   // 移除首尾连字符
    //   .replace(/^-+|-+$/g, "");

    logger.debug(`normalizeCategoryName: "${original}" → "${normalized}"`);
    return normalized;
  }

  /**
   * 处理分类层级
   */
  private processCategoryHierarchy(categories: string[], config: AppConfig): any {
    if (!categories || categories.length === 0) return [];

    // 如果配置指定了分类处理模式
    const categoryMode = config.categoryMode || "hierarchy"; // hierarchy | flat | parent-only

    switch (categoryMode) {
      case "flat":
        // 平铺模式：所有目录作为平级分类（每个都是独立的分类）
        return categories;

      case "parent-only":
        // 仅父目录模式：只取最后一个有效分类
        return categories.length > 0 ? [categories[categories.length - 1]] : [];

      case "hierarchy":
      default:
        // 层级模式：按照Hexo标准，返回层级数组
        // tech/frontend/vue.md → [tech, frontend] (一个层级链)
        return categories.length > 0 ? [categories] : [];
    }
  }

  /**
   * 检查分类是否为空
   */
  private isCategoriesEmpty(categories: any): boolean {
    if (!categories) return true;
    if (Array.isArray(categories)) return categories.length === 0;
    if (typeof categories === "string") return categories.trim() === "";
    return false;
  }

  /**
   * 生成分类的显示路径
   */
  getCategoryPath(categories: string[]): string {
    return categories.join(" > ");
  }

  /**
   * 根据分类生成建议的文件路径
   */
  generateSuggestedPath(categories: string[], fileName: string): string {
    if (!categories || categories.length === 0) return fileName;
    return [...categories, fileName].join("/");
  }

  /**
   * 保护重要字段不被更新
   */
  private protectImportantFields(currentFrontMatter: FrontMatterData, generatedFrontMatter: FrontMatterData): void {
    const config = this.configManager.getConfig();
    const protectedFields = config.protectedFields || ["date", "abbrlink", "permalink", "uuid"];

    protectedFields.forEach(field => {
      if (currentFrontMatter[field] !== undefined && currentFrontMatter[field] !== null) {
        logger.debug(`Protecting field '${field}' from being updated`);
        // 如果当前Front Matter中已存在该字段，就不用生成的值覆盖
        // 这里不需要做任何操作，因为我们只在字段不存在时才设置
      }
    });
  }

  /**
   * 生成详细的分类报告
   */
  generateCategoryReport(filePaths: string[]): any {
    const report = {
      totalFiles: filePaths.length,
      categorizedFiles: 0,
      uncategorizedFiles: 0,
      categoryTree: {},
      categoryCounts: {},
      suggestions: [],
    };

    filePaths.forEach(filePath => {
      try {
        const fileInfo = parseFileInfo(filePath, this.folderPath);
        const categories = this.generateCategoriesFromPath(fileInfo, this.configManager.getConfig());

        if (categories.length > 0) {
          report.categorizedFiles++;

          // 构建分类树
          let currentLevel = report.categoryTree;
          categories.forEach(category => {
            if (!currentLevel[category]) {
              currentLevel[category] = {};
            }
            currentLevel = currentLevel[category];

            // 统计分类计数
            report.categoryCounts[category] = (report.categoryCounts[category] || 0) + 1;
          });
        } else {
          report.uncategorizedFiles++;
          report.suggestions.push(`${filePath}: 建议移动到有意义的目录结构中`);
        }
      } catch (error) {
        logger.error(`Failed to analyze categories for ${filePath}: ${error.message}`);
      }
    });

    return report;
  }

  /**
   * 验证并修复分类结构
   */
  validateAndFixCategories(frontMatter: FrontMatterData, filePath: string): FrontMatterData {
    if (!frontMatter.categories) return frontMatter;

    let categories = Array.isArray(frontMatter.categories) ? frontMatter.categories : [frontMatter.categories];

    // 清理空的或无效的分类
    categories = categories.filter(cat =>
      cat
      && typeof cat === "string"
      && cat.trim() !== ""
      && cat !== "undefined"
      && cat !== "null"
    );

    // 规范化分类名称
    categories = categories.map(cat => this.normalizeCategoryName(cat)).filter(cat => cat !== "");

    // 去重
    categories = [...new Set(categories)];

    if (categories.length === 0) {
      // 如果清理后没有有效分类，尝试从路径重新生成
      const fileInfo = parseFileInfo(filePath, this.folderPath);
      categories = this.generateCategoriesFromPath(fileInfo, this.configManager.getConfig());
    }

    frontMatter.categories = categories.length > 0 ? categories : undefined;
    return frontMatter;
  }
}

/**
 * 验证日期格式的辅助函数
 */
function isValidDate(dateStr: string): boolean {
  const date = new Date(dateStr);
  return date instanceof Date && !isNaN(date.getTime());
}
