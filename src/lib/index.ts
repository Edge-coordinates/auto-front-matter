import fs from "fs-extra";
import * as path from 'path';
import * as YAML from "yaml";
import chokidar from "chokidar";
import relative from "relative";
import moment from "moment-timezone";
import matter from "gray-matter";
import { exit } from "process";

import _ from "lodash";

interface GrayMatterFile {
  data: { [key: string]: any };
  content: string;
  excerpt?: string;
  orig: Buffer | any;
  language: string;
  matter: string;
  stringify(lang: string): string;
  isEmpty?: boolean;
}
let watcher = null;
const reg = /^.?(\d{4})[-_]?(\d{2})[-_]?(\d{2}).?[-_.@# ]*(.*)$/;
const postDir = "_posts";
const draftDir = "_drafts";
let FolderPath = "";

let defaultKeyOrder = ["title", "date", "categories", "tags"];

let config: any = {
  noCategory: [],
}

export function startSever(tpath, args) {
  FolderPath = tpath;

  // Read and parse the config file
  const configFilePath = path.join(FolderPath, 'autofm-config.json');
  if (fs.existsSync(configFilePath)) {
    const configFileContent = fs.readFileSync(configFilePath, 'utf-8');
    config = JSON.parse(configFileContent);
  } else {
    console.error(`Config file not found at ${configFilePath}`);
  }
  // Initialize watcher.
  watcher = chokidar.watch(tpath, {
    ignored: (tpath, stats) =>
      stats?.isFile() && !(tpath.endsWith(".md") || tpath.endsWith(".mdx")), // only watch js files
    persistent: true,
  });

  // * deal with old documents
  // 'add', 'addDir' and 'change' events also receive stat() results as second
  // argument when available: https://nodejs.org/api/fs.html#fs_class_fs_stats
  if (args.init) {
    console.log("Init mode");
    watcher.on("add", (tpath) => {
      console.log(`File ${tpath} has been added`);
      frontMatterUpdate(tpath, args);
    });
    // TODO Use a lib to get all files in the folder
  }
  watcher.on("ready", () => {
    if (args.init) {
      console.log("Initial scan complete.");
      watcher.close().then(() => {
        console.log('Watcher closed.');
        // console.log("You'd better wait for a while to make sure all write operations are finished.");
        console.log("If you want to watch for changes, please restart the program without --init flag.");
      });
        
    } else {
      fileWatcher(); // Watch for changes in files
      console.log("Initial scan complete. Sever is ready for changes");
    }
  });
}

function fileWatcher() {
  watcher.on("add", (tpath) => {
    console.log(`File ${tpath} has been added`);
    initModel(tpath);
  });
  watcher.on("change", (tpath, stats) => {
    if (stats) console.log(`File ${tpath} changed size to ${stats.size}`);
  });
}

function readFile(filePath): string {
  // * If we need to support other codecs, we can use iconv-lite
  const data = fs.readFileSync(filePath, "utf8");
  return data;
}

function checkNullObj(obj) {
  return Object.keys(obj).length === 0;
}

// file.empty {String}: when the front-matter is "empty" (either all whitespace, nothing at all, or just comments and no data), the original string is set on this property. See #65 for details regarding use case.
// file.isEmpty {Boolean}: true if front-matter is empty.
function initModel(filePath) {
  let file: any = readFile(filePath); // new file doesn't has content
  file = matter(file);
  console.log("File doesn't has FrontMatter: ", checkNullObj(file.data));
  if (checkNullObj(file.data)) {
    console.log("New file");
    let frontMatter = frontMatterGenerator(filePath);
    injectFrontMatter(filePath, frontMatter, file);
  }
}

function updateModel() {}

// copy from hexo
function toMoment(value) {
  // ! This won't work!!!!
  // You need to update by yourself
  if (moment.isMoment(value)) return moment(value);
  return moment(value);
}

function frontMatterGenerator(filePath, content = "") {
  const relativePath = relative.toBase(FolderPath, filePath);
  let title, date;
  let categories = [[]];
  let parts = relativePath.split("/");

  // console.log(tpath, filePath);
  // Generate a new front matter, according to file
  if (parts.length > 0) {
    let filename = parts[parts.length - 1];
    if (filename.indexOf(".") >= 0) {
      filename = filename.substring(0, filename.indexOf("."));
    }
    let match = filename.match(reg);
    if (match) {
      date = toMoment(`${match[1]}-${match[2]}-${match[3]}`);
      title = match[4];
    } else {
      title = filename;
      date = generateCurrentDate();
    }
  }
  for (let i = 0; i <= parts.length - 2; i++) {
    let part = parts[i];
    if (
      !part ||
      part === "~" ||
      part === "." ||
      part === postDir ||
      part === draftDir
    ) {
      break;
    }
    // TODO - We can provide several models to generate categories
    if (categories[0].indexOf(part) < 0 && config.noCategory.indexOf(part) < 0) {
      categories[0].push(part);
    }
  }
  if (categories[0].length === 0) {
    categories = undefined;
  } else if (categories[0].length === 1) {
    categories[0] = categories[0][0];
  }
  // console.log("Generated front matter: ");
  // console.log({ title, date, categories });
  return { title, date, categories };
}

function frontMatterInit() {}

function frontMatterUpdate(filePath, args) {
  const file: string = readFile(filePath); // new file doesn't has content
  let parsedFile: GrayMatterFile = matter(file);
  console.log("File doesn't has FrontMatter: ", checkNullObj(parsedFile.data));
  if (checkNullObj(parsedFile.data)) {
    console.log("Empty file");
    let frontMatter = frontMatterGenerator(filePath);
    console.log(frontMatter);
    injectFrontMatter(filePath, frontMatter, parsedFile);
    return;
  }
  let frontMatter = _.cloneDeep(parsedFile.data);
  // console.log(parsedFile);
  let generatedFrontMatter = frontMatterGenerator(filePath);
  if (args.force || frontMatter.title === undefined) {
    frontMatter.title = generatedFrontMatter.title;
  }
  if (frontMatter.date === undefined) {
    // never force update date
    frontMatter.date = generatedFrontMatter.date;
  }
  if (
    args.force ||
    !frontMatter.categories ||
    checkNullObj(frontMatter.categories)
  ) {
    frontMatter.categories = generatedFrontMatter.categories;
  }
  injectFrontMatter(filePath, frontMatter, parsedFile);
}

// ANCHOR injectFrontMatter
function injectFrontMatter(filePath, frontMatter, file: GrayMatterFile) {
  if (frontMatter === null || frontMatter.notAutofm || _.isEqual(frontMatter, file.data)) {
    console.log(
      "No need to inject front matter",
      _.isEqual(frontMatter, file.data),
      "not autofm",
      frontMatter.notAutofm,
    );
    return;
  }
  // * Sort frontMatter by keyOrder
  let keyOrder = defaultKeyOrder;
  // Sort the frontMatter object based on the key order
  const sortedFrontMatter = {};
  keyOrder.forEach((key) => {
    if (frontMatter.hasOwnProperty(key)) {
      sortedFrontMatter[key] = frontMatter[key];
    }
  });

  // Add any remaining keys that were not in the keyOrder
  Object.keys(frontMatter).forEach((key) => {
    if (!sortedFrontMatter.hasOwnProperty(key)) {
      sortedFrontMatter[key] = frontMatter[key];
    }
  });
  frontMatter = sortedFrontMatter;
  // Is the next If module necessary?
  if (frontMatter.date === undefined) {
    frontMatter.date = generateCurrentDate();
  }
  // * Change categories to string
  // if (frontMatter.categories) {
  //   for (let i = 0; i < frontMatter.categories.length; i++) {
  //     if (frontMatter.categories[i] instanceof Array) {
  //       if (frontMatter.categories[i].length > 1)
  //         frontMatter.categories[i] = `[${frontMatter.categories[i].join(
  //           ", "
  //         )}]`;
  //       else frontMatter.categories[i] = frontMatter.categories[i][0];
  //     }
  //   }
  // }
  let frontMatterContent = "---\n" + YAML.stringify(frontMatter) + "---\n";
  // Remove quotes around array elements
  // frontMatterContent = frontMatterContent.replace(/"\[(.*?)\]"/g, "[$1]");
  // Init Finished
  let finalContent = "";
  if (!file.content) finalContent = frontMatterContent;
  else finalContent = frontMatterContent + file.content;
  // console.log(finalContent);
  try {
    fs.writeFileSync(filePath, finalContent); //'a+' is append mode
    console.log("FrontMatter injected successfully!");
  } catch (err) {
    console.error(err);
  }
  // console.log("FrontMatter injected finished");
}

function parseFrontMatter(filePath, content) {
  // Read the file content
  const fileContent = content;
  // TODO - according to the config, we can rename the file with date
  // Find the YAML front matter between "---" markers
  const frontMatterMatch = fileContent.match(/^---\n([\s\S]+?)\n---/);
  // output the front matter match
  console.log("Match:\n", frontMatterMatch);
  if (frontMatterMatch) {
    const frontMatterYaml = frontMatterMatch[1];
    // Parse the YAML content
    const frontMatter = YAML.parse(frontMatterYaml);
    return frontMatter;
  } else {
    console.error("No front matter found");
    return null;
  }
}

function generateCurrentDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 月份从0开始，所以需要加1
  const day = now.getDate();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const seconds = now.getSeconds();

  // 格式化日期和时间
  const formattedDate = `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`;
  return formattedDate;
}
