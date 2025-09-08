import fs from "fs-extra";
import * as path from "path";
import relative from "relative";
import moment from "moment-timezone";
import { FileInfo, FILE_NAME_REGEX, LogLevel, AutoFMError } from "../types/index.js";

import { generateAbbrlink } from "./abbrlink.js";

export { generateAbbrlink };

// 日志工具
class Logger {
  private level: LogLevel = LogLevel.INFO;

  setLevel(level: LogLevel) {
    this.level = level;
  }

  error(message: string, ...args: any[]) {
    if (this.level >= LogLevel.ERROR) {
      console.error(`[ERROR] ${message}`, ...args);
    }
  }

  warn(message: string, ...args: any[]) {
    if (this.level >= LogLevel.WARN) {
      console.warn(`[WARN] ${message}`, ...args);
    }
  }

  info(message: string, ...args: any[]) {
    if (this.level >= LogLevel.INFO) {
      console.info(`[INFO] ${message}`, ...args);
    }
  }

  debug(message: string, ...args: any[]) {
    if (this.level >= LogLevel.DEBUG) {
      console.debug(`[DEBUG] ${message}`, ...args);
    }
  }
}

export const logger = new Logger();

export { LogLevel };

/**
 * 安全地读取文件
 * @param filePath 文件路径
 * @returns 文件内容
 */
export function readFileSafe(filePath: string): string {
  try {
    if (!fs.existsSync(filePath)) {
      throw new AutoFMError(`File does not exist: ${filePath}`, 'FILE_NOT_FOUND', filePath);
    }
    return fs.readFileSync(filePath, "utf8");
  } catch (error) {
    if (error instanceof AutoFMError) {
      throw error;
    }
    throw new AutoFMError(`Failed to read file: ${error.message}`, 'READ_ERROR', filePath);
  }
}

/**
 * 安全地写入文件
 * @param filePath 文件路径
 * @param content 文件内容
 */
export function writeFileSafe(filePath: string, content: string): void {
  try {
    // 确保目录存在
    const dir = path.dirname(filePath);
    fs.ensureDirSync(dir);
    
    fs.writeFileSync(filePath, content, "utf8");
    logger.info(`File written successfully: ${filePath}`);
  } catch (error) {
    throw new AutoFMError(`Failed to write file: ${error.message}`, 'WRITE_ERROR', filePath);
  }
}

/**
 * 检查对象是否为空
 * @param obj 要检查的对象
 * @returns 是否为空
 */
export function isEmptyObject(obj: any): boolean {
  return obj === null || obj === undefined || Object.keys(obj).length === 0;
}

/**
 * 解析文件信息
 * @param filePath 文件路径
 * @param basePath 基础路径
 * @returns 文件信息
 */
export function parseFileInfo(filePath: string, basePath: string): FileInfo {
  // 确保路径是绝对路径
  const absoluteFilePath = path.resolve(filePath);
  const absoluteBasePath = path.resolve(basePath);
  
  // 计算相对路径
  const relativePath = path.relative(absoluteBasePath, absoluteFilePath);
  
  const fileName = path.basename(filePath);
  const extension = path.extname(filePath);
  const baseName = path.basename(filePath, extension);
  
  // 分割路径，过滤空字符串和当前目录标识
  const parts = relativePath.split(path.sep).filter(part => part && part !== '.' && part !== '');
  
  logger.debug(`parseFileInfo: filePath=${filePath}, basePath=${basePath}`);
  logger.debug(`parseFileInfo: absoluteFilePath=${absoluteFilePath}, absoluteBasePath=${absoluteBasePath}`);
  logger.debug(`parseFileInfo: relativePath=${relativePath}, parts=[${parts.join(', ')}]`);

  return {
    filePath: absoluteFilePath,
    relativePath,
    fileName,
    baseName,
    extension,
    parts
  };
}

/**
 * 从文件名解析日期和标题
 * @param fileName 文件名
 * @returns 解析结果
 */
export function parseFileNameDate(fileName: string): { date?: Date; title?: string } {
  const match = fileName.match(FILE_NAME_REGEX);
  if (match) {
    const [, year, month, day, title] = match;
    const date = moment(`${year}-${month}-${day}`).toDate();
    return { date, title: title || '' };
  }
  return { title: fileName };
}

/**
 * 生成当前日期字符串
 * @param format 日期格式
 * @param timezone 时区
 * @returns 格式化的日期字符串
 */
export function generateCurrentDate(format: string = "YYYY/MM/DD HH:mm:ss", timezone: string = "Asia/Shanghai"): string {
  return moment().tz(timezone).format(format);
}

/**
 * 转换为moment对象
 * @param value 日期值
 * @returns moment对象
 */
export function toMoment(value: any): moment.Moment {
  if (moment.isMoment(value)) {
    return value.clone();
  }
  return moment(value);
}

/**
 * 清理和规范化路径
 * @param filePath 文件路径
 * @returns 清理后的路径
 */
export function normalizePath(filePath: string): string {
  return path.normalize(filePath).replace(/\\/g, '/');
}

/**
 * 检查文件是否为Markdown文件
 * @param filePath 文件路径
 * @returns 是否为Markdown文件
 */
export function isMarkdownFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return ext === '.md' || ext === '.mdx' || ext === '.markdown';
}

/**
 * 深度合并对象
 * @param target 目标对象
 * @param source 源对象
 * @returns 合并后的对象
 */
export function deepMerge(target: any, source: any): any {
  const result = { ...target };
  
  for (const key in source) {
    if (source.hasOwnProperty(key)) {
      if (isObject(source[key]) && isObject(target[key])) {
        result[key] = deepMerge(target[key], source[key]);
      } else {
        result[key] = source[key];
      }
    }
  }
  
  return result;
}

/**
 * 检查是否为对象
 * @param obj 要检查的值
 * @returns 是否为对象
 */
function isObject(obj: any): boolean {
  return obj !== null && typeof obj === 'object' && !Array.isArray(obj);
}

/**
 * 延迟执行
 * @param ms 延迟毫秒数
 * @returns Promise
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 去除字符串首尾空白字符
 * @param str 字符串
 * @returns 处理后的字符串
 */
export function sanitizeString(str: string): string {
  return str?.trim().replace(/\s+/g, ' ') || '';
}

/**
 * 验证日期格式
 * @param dateStr 日期字符串
 * @returns 是否为有效日期
 */
export function isValidDate(dateStr: string): boolean {
  return moment(dateStr).isValid();
}

/**
 * 格式化文件大小
 * @param bytes 字节数
 * @returns 格式化的大小字符串
 */
export function formatFileSize(bytes: number): string {
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  if (bytes === 0) return '0 Bytes';
  
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
}
