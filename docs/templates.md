# 模板

模板定义新文件（或 `--template` 指定时）写入的 front matter 字段。配置在 `templates` 里：

```json
{
  "templates": {
    "default": {
      "title": "{title}",
      "date": "",
      "categories": [],
      "tags": []
    }
  }
}
```

`autofm --template blog` 会使用 `templates.blog`。找不到指定名称时回退到 `default`。

## 字符串变量

| 变量 | 值 |
| --- | --- |
| `{filename}` / `{basename}` | 不含扩展名的文件名 |
| `{extension}` | 扩展名 |
| `{path}` | 相对目标目录的路径 |
| `{dirname}` | 相对目录名 |
| `{date}` | 从文件名解析出的日期，否则为当前时间 |
| `{title}` | 从文件名解析出的标题，否则为 basename |

空的 `date` 由程序按 `dateFormat` / `timezone` 填。

## 内置预定义模板

启动时如果配置里还没有同名模板，会补上：`blog`、`note`、`journal`、`tutorial`。它们可以在配置里覆盖。

## 函数字段

只有 JS 配置能写函数，见 [examples/custom.js](./examples/custom.js)。

| 字段 | 调用方式 |
| --- | --- |
| `title` | `(filePath, fileName)` |
| `date` | `()` |
| `categories` / `tags` | `(filePath)` |
| 其他键 | `(filePath, fileInfo)` |

函数抛错时回退到该字段的默认生成逻辑。
