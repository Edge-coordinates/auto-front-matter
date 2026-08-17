# 快速开始

`autofm` 监控一个 Markdown 目录，在文件创建或变更时自动补全 YAML front matter。它会改写你的 `.md` 文件，先在副本或开启备份的仓库上试。

## 安装

```sh
npm install -g autofm
```

本地调试（本仓库）：

```sh
yarn install
yarn build
node ./dist/index.js --help
```

## 推荐的用户项目布局

配置不要放在内容根目录，也不要放进这个 npm 包的根目录。用户仓库里用隐藏目录：

```text
<your-blog>/
  .autofm/
    config.json      # 提交这个
    backup/          # 不要提交
  _posts/
  _drafts/
```

`.gitignore` 建议只忽略备份：

```gitignore
.autofm/backup/
```

## 第一次使用

在博客 / 文档仓库根目录：

```sh
autofm init-config --preset hexo
autofm --init
autofm
```

- `init-config` 只写 `.autofm/config.json`，然后退出
- `--init` 扫描已有 Markdown，补全 front matter，然后退出
- 不带参数则持续监控

可用预设：`minimal`（默认）、`hexo`、`blog`。

## 配置从哪里读

按这个顺序找，**找到即停，不会因为缺文件而自动写一份配置**：

1. `--config <path>` 或环境变量 `AUTOFM_CONFIG`
2. 从 `--dir` / 当前目录向上：`.autofm/config.{json,js,mjs,cjs}`、`.autofmrc.json`、`autofm.config.js`
3. 目标目录里遗留的 `autofm-config.json`（弃用，会警告）
4. 用户级 `~/.config/autofm/config.json`
5. 内置默认值

更完整的说明见 [配置](./config.md) 和 [命令行](./cli.md)。
