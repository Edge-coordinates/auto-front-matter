# 配置

运行时配置属于**用户的博客 / 文档仓库**，不属于这个 npm 包。包根目录里的 `autofm-config.json` 只是误把本仓库当成内容目录跑出来的产物，已经移除。

## 应该放哪

推荐：

```text
<your-blog>/.autofm/config.json
```

需要给某个字段写生成函数时，改用：

```text
<your-blog>/.autofm/config.js
```

备份默认写到 `.autofm/backup/`，和配置放在一起，但不要提交备份。

## 查找顺序

1. `--config <path>` 或 `AUTOFM_CONFIG`
2. 从目标目录向上查找（不会把 `$HOME` 当成项目根，除非你就在 home 里启动）：
   - `.autofm/config.json`
   - `.autofm/config.js` / `.mjs` / `.cjs`
   - `.autofmrc.json` / `.autofmrc.js`
   - `autofm.config.js` / `.mjs` / `.cjs`
3. 目标目录下的遗留文件 `autofm-config.json`（弃用，加载时警告）
4. 用户级：
   - `$XDG_CONFIG_HOME/autofm/config.json`（默认 `~/.config/autofm/config.json`）
   - `~/.autofm/config.json`
5. 内置默认值（**不写文件**）

显式指定的路径如果不存在，直接报错，不会静默回退。

## 生成配置

```sh
autofm init-config                 # 写入 minimal
autofm init-config --preset hexo
autofm init-config --force         # 覆盖已有 .autofm/config.json
```

`init-config` 只写 JSON。JS 配置请自己从 [examples/custom.js](./examples/custom.js) 复制。

仓库里的示例和内置预设保持一致：

- [examples/minimal.json](./examples/minimal.json)
- [examples/hexo.json](./examples/hexo.json)
- [examples/blog.json](./examples/blog.json)

## 字段

| 字段 | 含义 |
| --- | --- |
| `noCategory` | 生成分类时跳过的目录名 |
| `keyOrder` | front matter 键的输出顺序 |
| `dateFormat` | moment 日期格式 |
| `timezone` | 时区 |
| `categoryMode` | `hierarchy` / `flat` / `parent-only` |
| `protectedFields` | 更新时不会覆盖的键（例如 `date`、`abbrlink`） |
| `abbrlink` | 是否生成 abbrlink，以及算法 |
| `backup.enabled` | 是否备份 |
| `backup.directory` | 相对目标目录或绝对路径，默认 `.autofm/backup` |
| `backup.maxFiles` | 保留的备份数量 |
| `templates` | 命名模板，见 [模板](./templates.md) |
| `filePatterns` | 当作 posts / drafts 的目录名，不计入分类 |
| `customFields` | 写入 front matter 的额外静态字段 |

用户配置会和内置默认值做深合并。数组（如 `noCategory`、`keyOrder`）整段替换，不会拼接。

## JS 配置

JSON 不能表达函数。要把某个模板字段变成生成器时，用 `.js` / `.mjs` / `.cjs`。

`.js` / `.cjs` 用 CommonJS（博客仓库最常见）：

```js
module.exports = {
  timezone: "Asia/Shanghai",
  templates: {
    default: {
      title: (_filePath, fileName) => fileName.replace(/\.md$/i, ""),
      categories: (filePath) => filePath.split(/[/\\]/).slice(-3, -1),
    },
  },
};
```

`.mjs` 可以用 `export default { ... }` 或 `export default function () { return { ... } }`。

`autofm` 不会回写 JS 配置。改完保存即可；监控中的重载会重新 `import`。

## 从旧路径迁移

如果仓库根上还有 `autofm-config.json`：

```sh
mkdir .autofm
mv autofm-config.json .autofm/config.json
```

或直接 `autofm init-config` 生成新文件，再把旧选项抄过去。旧路径仍然能读，但每次启动会警告。
