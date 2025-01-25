**It will break you blog, do not use it now！！！！**  

# autofm
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
npm install autofm -g
```

## Help

```sh
$ autofm --help
Usage:
  autofm --help // print help information
  autofm // current folder as root
  autofm --init (-i) // init model for the whole folder
  autofm --force (-f) // use force model to cover the old front matter
```

## DEV
```powershell
pnpm build
node ..\auto-front-matter\dist\index.js 
```


## Working logic
### init model
regenerate front-matter

### normal model
Add event: 
if file is empty:
initModel()
else:
updateModel()

Change event:
updateModel()

updateModel():
if oldMatter != new Matter:
update()
else:
pass // Prevents add and change from being triggered repeatedly

## Reference
### Referenced libraries
https://github.com/sisyphsu/hexo-enhancer
https://www.npmjs.com/package/auto-front-matter
https://www.npmjs.com/package/hexo-auto-front-matter

### Refer to the tutorial
How to make Global NPM Package: https://obaranovskyi.medium.com/own-global-npm-module-in-5-minutes-efb5d734b033
https://www.freecodecamp.org/news/how-to-create-and-publish-your-first-npm-package/
https://github.com/minimistjs/minimist
https://github.com/paulmillr/chokidar