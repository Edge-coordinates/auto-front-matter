# auto-front-matter
Auto Front-matter generator

It will auto generate frontMatter for markdown documents(.md) when file create  
With init model, it can help update the frontMatter

example:
```
---
title: testDocument // Based on filename
date: 2024/10/14 11:28:26 // Based on current time
categories:
  - [hello, hi] // Based on the filePath
---
```

## Installation

Install it as a command line tool via `npm -g`.

```sh
npm install auto-front-matter -g
```

## Help

```sh
$ auto-front-matter --help
Usage:
  auto-front-matter --help // print help information
  auto-front-matter // current folder as root
  auto-front-matter --init (-i) // init model for the whole folder
  auto-front-matter --force (-f) // use force model to cover the old front matter
```

### Referenced libraries
https://github.com/sisyphsu/hexo-enhancer
https://www.npmjs.com/package/auto-front-matter
https://www.npmjs.com/package/hexo-auto-front-matter

### Refer to the tutorial
How to make Global NPM Package: https://obaranovskyi.medium.com/own-global-npm-module-in-5-minutes-efb5d734b033
https://www.freecodecamp.org/news/how-to-create-and-publish-your-first-npm-package/
https://github.com/minimistjs/minimist
https://github.com/paulmillr/chokidar