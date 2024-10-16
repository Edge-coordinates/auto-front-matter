## Bugs
莫名其妙的 FM 匹配不出来。
No front matter found

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
