---
title: TODO
date: 2025/09/09 03:18:38
---
## Bugs
有可能导致损毁！！！

对于特定的分类，不按照目录划分，比如Diary分类下。
莫名其妙的 FM 匹配不出来。
No front matter found
设置用户配置的方式，用户可以自行配置任何 key 的生成函数。

README 文件 title 修正, 重命名为 上一级目录-README 的模式，增加可读性

abbrlink: e3897e3a  支援
date: '2024/11/9 18:29:15' Data修复为这种生成，而不是之前那种没有引号的，不过要测试data解析库能不能解析字符串，还是要做修改

## 工作方式
- 根据文件创建事件生成日期，而不是当前事件（add事件当然就是当前时间啦！）
- 补全/生成模式，同样启动看门狗，处理一开始的add事件，逐个文件判断 front-matter
- frontMatterConfig.js support
- 支持定制Key的顺序 [title, date, categories, tags] // 默认顺序

## Front-matter Example
```
---
title: Hello World
date: 2013/7/13 20:46:25
categories:
  - [Sports, Baseball]
  - [MLB, American League, Boston Red Sox]
  - [MLB, American League, New York Yankees]
  - Rivalries
tags:
  - Injury
  - Fight
  - Shocking
---
```
