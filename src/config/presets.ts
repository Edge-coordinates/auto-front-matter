import { AppConfig } from "../types/index.js";

/**
 * Built-in config presets written by `autofm init-config`.
 * Keep docs/examples/*.json in sync with these objects.
 */
export const CONFIG_PRESETS: Record<string, AppConfig> = {
  minimal: {
    noCategory: ["assets", "images", "public", "static", "node_modules", "dist", "build"],
    keyOrder: ["title", "date", "updated", "categories", "tags", "abbrlink"],
    dateFormat: "YYYY/MM/DD HH:mm:ss",
    timezone: "Asia/Shanghai",
    categoryMode: "hierarchy",
    protectedFields: ["date", "abbrlink", "permalink", "uuid"],
    abbrlink: {
      enabled: true,
      algorithm: "crc32",
      representation: "hex",
    },
    backup: {
      enabled: false,
      directory: ".autofm/backup",
      maxFiles: 10,
    },
    templates: {
      default: {
        title: "{title}",
        date: "",
        categories: [],
        tags: [],
      },
    },
    filePatterns: {
      posts: "_posts",
      drafts: "_drafts",
    },
    customFields: {},
  },
  hexo: {
    noCategory: [
      "assets",
      "images",
      "public",
      "static",
      "node_modules",
      "dist",
      "build",
      "themes",
      "source",
    ],
    keyOrder: [
      "title",
      "date",
      "updated",
      "categories",
      "tags",
      "description",
      "keywords",
      "abbrlink",
    ],
    dateFormat: "YYYY-MM-DD HH:mm:ss",
    timezone: "Asia/Shanghai",
    categoryMode: "hierarchy",
    protectedFields: ["date", "abbrlink", "permalink", "uuid"],
    abbrlink: {
      enabled: true,
      algorithm: "crc32",
      representation: "hex",
    },
    backup: {
      enabled: true,
      directory: ".autofm/backup",
      maxFiles: 20,
    },
    templates: {
      default: {
        title: "{title}",
        date: "",
        categories: [],
        tags: [],
        description: "",
        keywords: [],
      },
    },
    filePatterns: {
      posts: "_posts",
      drafts: "_drafts",
    },
    customFields: {},
  },
  blog: {
    noCategory: ["assets", "images", "public", "static", "node_modules", "dist", "build"],
    keyOrder: ["title", "date", "updated", "categories", "tags", "author", "draft", "abbrlink"],
    dateFormat: "YYYY-MM-DD HH:mm:ss",
    timezone: "Asia/Shanghai",
    categoryMode: "hierarchy",
    protectedFields: ["date", "abbrlink", "permalink", "uuid"],
    abbrlink: {
      enabled: true,
      algorithm: "crc32",
      representation: "hex",
    },
    backup: {
      enabled: true,
      directory: ".autofm/backup",
      maxFiles: 20,
    },
    templates: {
      default: {
        title: "{title}",
        date: "",
        categories: [],
        tags: [],
        author: "",
        draft: false,
        description: "",
      },
    },
    filePatterns: {
      posts: "_posts",
      drafts: "_drafts",
    },
    customFields: {},
  },
};

export const DEFAULT_PRESET_NAME = "minimal";

export function listPresetNames(): string[] {
  return Object.keys(CONFIG_PRESETS);
}

export function getPreset(name: string): AppConfig | undefined {
  return CONFIG_PRESETS[name];
}
