## 工作方式
- 默认开启后不处理首批add事件（能做到嘛？），仅处理之后的add事件和change事件。
- 补全/生成模式，同样启动看门狗，处理一开始的add事件，逐个文件判断 front-matter
- frontMatterConfig.js support

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
