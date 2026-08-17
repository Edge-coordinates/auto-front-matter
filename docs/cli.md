# 命令行

```text
autofm [options]
autofm init-config [--preset <name>] [--dir <path>] [--force]
```

## 命令

| 命令 | 作用 |
| --- | --- |
| `init-config` | 在目标目录写入 `.autofm/config.json` 后退出。不会启动监控。 |

等价写法：`autofm --init-config`。

`--init` 和 `init-config` 不是一回事：`--init` 是给已有 Markdown 补 front matter。

## 选项

| 选项 | 说明 |
| --- | --- |
| `-h, --help` | 帮助 |
| `-d, --dir <path>` | 目标目录，默认当前目录 |
| `-C, --config <path>` | 指定配置文件。文件必须已存在 |
| `-p, --preset <name>` | 仅 `init-config`：`minimal`、`hexo`、`blog` |
| `-i, --init` | 扫描并初始化全部 Markdown 的 front matter，然后退出 |
| `-f, --force` | 覆盖已有 front matter；和 `init-config` 一起用时覆盖已有配置文件 |
| `-c, --ct` | 只重新生成 categories / tags |
| `-b, --backup` | 改文件前先备份 |
| `-t, --template <name>` | 使用指定 front matter 模板 |
| `-v, --verbose` | 调试日志 |

## 示例

```sh
autofm init-config --preset hexo
autofm init-config --dir ./blog --force
autofm --dir ./blog --init
autofm --config ./notes/.autofm/config.json --dir ./notes
autofm --template blog
```

## 环境变量

`AUTOFM_CONFIG` 等价于 `--config`。命令行优先。
