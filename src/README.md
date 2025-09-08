---
title: README
date: 2025/09/09 03:18:38
---
# AutoFrontMatter - 重构版本

这是 AutoFrontMatter 的重构版本，采用了模块化架构，提供了更好的可维护性和扩展性。

## 🚀 新特性

### 模块化架构
- **类型定义** (`types/`): 完整的TypeScript类型支持
- **配置管理** (`config/`): 灵活的配置系统
- **工具函数** (`utils/`): 通用工具和日志系统
- **Front Matter处理** (`frontMatter/`): 核心处理逻辑
- **文件监控** (`fileWatcher/`): 智能文件监控
- **模板系统** (`template/`): 可扩展的模板引擎
- **备份管理** (`backup/`): 自动备份功能
- **CLI命令** (`cli/`): 高级命令行功能
- **服务监控** (`monitor/`): 性能监控和报告

### 主要改进

#### 1. 配置系统增强
- 支持更丰富的配置选项
- 配置验证和自动修复
- 模板配置支持
- 备份策略配置

#### 2. 模板系统
- 预定义模板：`blog`, `note`, `journal`, `tutorial`
- 支持函数式模板
- 变量替换支持：`{title}`, `{date}`, `{filename}` 等
- 自定义模板创建

#### 3. 备份功能
- 自动文件备份
- 备份历史管理
- 一键恢复功能
- 备份统计和清理

#### 4. 监控和日志
- 详细的日志系统（DEBUG, INFO, WARN, ERROR）
- 性能监控
- 错误追踪
- 监控报告生成

#### 5. 错误处理
- 优雅的错误处理
- 详细的错误信息
- 错误恢复机制

#### 6. CLI 增强
- 新的命令行选项
- 详细的帮助信息
- 优雅的进程退出处理

## 📁 目录结构

```
src/
├── types/          # TypeScript类型定义
├── config/         # 配置管理
├── utils/          # 工具函数
├── frontMatter/    # Front Matter处理
├── fileWatcher/    # 文件监控
├── template/       # 模板系统
├── backup/         # 备份管理
├── cli/            # CLI命令
├── monitor/        # 服务监控
├── lib/            # 主服务类
└── index.ts        # 入口文件
```

## 🛠️ 新增命令选项

```bash
# 基本用法（保持兼容）
autofm --init           # 初始化所有文件
autofm --force          # 强制更新
autofm --ct             # 重新生成分类和标签

# 新增选项
autofm --backup         # 启用备份
autofm --template blog  # 使用特定模板
autofm --verbose        # 详细日志输出
```

## 📝 配置文件示例

参考 `autofm-config.example.json` 查看完整配置示例。

## 🔧 模板使用

### 预定义模板
- `default`: 基础模板
- `blog`: 博客文章模板
- `note`: 笔记模板
- `journal`: 日记模板
- `tutorial`: 教程模板

### 变量支持
- `{filename}`: 文件名
- `{title}`: 从文件名解析的标题
- `{date}`: 当前日期
- `{path}`: 相对路径
- `{dirname}`: 目录名

## 🔄 向后兼容性

重构后的版本完全兼容原有的 API 和配置，现有项目无需修改即可使用。

## 🐛 错误修复

- 修复了原版本中的拼写错误（`startSever` → `startServer`）
- 改进了日期处理逻辑
- 优化了分类生成算法
- 修复了配置文件加载问题

## 📊 性能提升

- 异步处理优化
- 内存使用优化
- 文件 I/O 优化
- 错误处理优化

## 🎯 未来计划

- [ ] Web UI 界面
- [ ] 插件系统
- [ ] 更多预定义模板
- [ ] 国际化支持
- [ ] 配置文件热重载
- [ ] 批量操作 API
