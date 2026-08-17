# 架构

模块划分在 `src/`：

```text
src/
├── types/          # TypeScript 类型与 DEFAULT_CONFIG
├── config/         # 查找、加载、预设、校验
├── utils/          # 日志、路径、读写
├── frontMatter/    # 解析与写入 YAML
├── fileWatcher/    # chokidar 监控
├── template/       # 模板展开
├── backup/         # 改写前备份
├── cli/            # 额外命令（状态、备份列表等）
├── monitor/        # 运行报告
├── lib/            # AutoFrontMatterService
└── index.ts        # CLI 入口
```

## 配置模块

- `resolve.ts`：按约定查找配置，绝不创建文件
- `presets.ts`：`init-config` 写入的内置预设，与 `docs/examples/*.json` 同步
- `index.ts`：`ConfigManager` 合并默认值并校验

查找顺序和路径约定见 [配置](./config.md)。

## 运行时

`AutoFrontMatterService` 在目标目录上组装 Config / FrontMatter / Backup / Template / Watcher。`start()` 先 `loadConfig()`，再挂监控。

`--init` / `--ct` 在初始扫描结束后关掉 watcher。普通模式保持监控，并在 `ready` 之后才根据文件名改 title，避免启动扫描误伤。

`.autofm/` 和 `.autofm-backup` 都在忽略列表里，配置和备份不会被当成 Markdown 源。

## 兼容

- 旧的根目录 `autofm-config.json` 仍能加载，但会警告
- CLI 的 `--init` / `--force` / `--ct` / `--dir` 语义不变
- `startServer()` 仍是库入口
