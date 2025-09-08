import matter from "gray-matter";

// 基础类型定义
export interface GrayMatterFile {
  data: { [key: string]: any };
  content: string;
  excerpt?: string;
  orig: Buffer | any;
  language: string;
  matter: string;
  stringify(lang: string): string;
  isEmpty?: boolean;
}

// 命令行参数类型
export interface CLIArgs {
  init?: boolean;
  force?: boolean;
  dir?: string;
  ct?: boolean;
  help?: boolean;
  backup?: boolean;
  template?: string;
  verbose?: boolean;
  _?: string[];
}

// 应用配置类型
export interface AppConfig {
  noCategory: string[];
  keyOrder?: string[];
  dateFormat?: string;
  timezone?: string;
  categoryMode?: 'hierarchy' | 'flat' | 'parent-only'; // 分类生成模式
  protectedFields?: string[]; // 受保护的字段，不会被更新
  backup?: {
    enabled: boolean;
    directory: string;
    maxFiles: number;
  };
  templates?: {
    [key: string]: FrontMatterTemplate;
  };
  filePatterns?: {
    posts: string;
    drafts: string;
  };
  customFields?: {
    [key: string]: any;
  };
}

// Front Matter模板类型
export interface FrontMatterTemplate {
  title?: string | ((filePath: string, fileName: string) => string);
  date?: string | (() => string);
  categories?: string[] | ((filePath: string) => string[]);
  tags?: string[] | ((filePath: string) => string[]);
  [key: string]: any;
}

// Front Matter生成结果类型
export interface FrontMatterData {
  title?: string;
  date?: string | Date;
  categories?: string | string[];
  tags?: string | string[];
  [key: string]: any;
}

// 文件信息类型
export interface FileInfo {
  filePath: string;
  relativePath: string;
  fileName: string;
  baseName: string;
  extension: string;
  parts: string[];
  stats?: any;
}

// 监控器配置类型
export interface WatcherConfig {
  extensions: string[];
  ignored: string[];
  persistent: boolean;
}

// 错误类型
export class AutoFMError extends Error {
  constructor(message: string, public code?: string, public filePath?: string) {
    super(message);
    this.name = 'AutoFMError';
  }
}

// 操作结果类型
export interface OperationResult {
  success: boolean;
  message: string;
  filePath?: string;
  error?: Error;
}

// 日志级别
export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3
}

// 默认配置常量
export const DEFAULT_CONFIG: AppConfig = {
  noCategory: [],
  keyOrder: ["title", "date", "updated", "categories", "tags"],
  dateFormat: "YYYY/MM/DD HH:mm:ss",
  timezone: "Asia/Shanghai",
  categoryMode: "hierarchy", // 默认使用层级模式
  protectedFields: ["date", "abbrlink", "permalink", "uuid"], // 默认受保护字段
  backup: {
    enabled: false,
    directory: ".autofm-backup",
    maxFiles: 10
  },
  templates: {
    default: {
      title: "",
      date: "",
      categories: [],
      tags: []
    }
  },
  filePatterns: {
    posts: "_posts",
    drafts: "_drafts"
  },
  customFields: {}
};

// 文件名解析正则表达式
export const FILE_NAME_REGEX = /^.?(\d{4})[-_]?(\d{2})[-_]?(\d{2}).?[-_.@# ]*(.*)$/;
