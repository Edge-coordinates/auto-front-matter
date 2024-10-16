import fs from "fs-extra";
import YAML from "yaml";
import chokidar from "chokidar";
import relative from "relative";

let watcher = null;
const reg = /^.?(\d{4})[-_]?(\d{2})[-_]?(\d{2}).?[-_.@# ]*(.*)$/;
const postDir = "_posts";
const draftDir = "_drafts";
let FolderPath = "";

let defaultKeyOrder = ['title', 'date', 'categories', 'tags'];

export function startSever(path, args) {
  FolderPath = path;
  // Initialize watcher.
  watcher = chokidar.watch(path, {
    ignored: (path, stats) => stats?.isFile() && !path.endsWith(".md"), // only watch js files
    persistent: true,
  });

  // * deal with old documents
  // 'add', 'addDir' and 'change' events also receive stat() results as second
  // argument when available: https://nodejs.org/api/fs.html#fs_class_fs_stats
  if (args.init) {
    watcher.on("add", (tPath) => {
      console.log(`File ${tPath} has been added`);
      frontMatterUpdate(tPath, args);
    });
  }
  watcher.on("ready", () => {
    console.log("Initial scan complete. Sever is ready for changes");
    fileWatcher(); // Watch for changes in files
  });
}

function fileWatcher() {
  watcher.on("add", (path) => {
    console.log(`File ${path} has been added`);
    let content = fs.readFileSync(path);
    let frontMatter = frontMatterGenerator(FolderPath, path);
    injectFrontMatter(frontMatter, path, content);
  });
  watcher.on("change", (path, stats) => {
    if (stats) console.log(`File ${path} changed size to ${stats.size}`);
  });
}

function frontMatterGenerator(path, filePath) {
  const relativePath = relative.toBase(path, filePath);
  let title, date;
  let categories = [[]];
  let parts = relativePath.split("/");

  // console.log(path, filePath);
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
    if (categories[0].indexOf(part) < 0) {
      categories[0].push(part);
    }
  }
  if (categories[0].length === 0) {
    categories = undefined;
  }

  console.log({ title, date, categories });
  return { title, date, categories };
}

function frontMatterInit() {}

function frontMatterUpdate(filePath, args) {
  let content = fs.readFileSync(filePath, "utf8");
  let frontMatter = parseFrontMatter(filePath, content);
  let generatedFrontMatter = frontMatterGenerator(FolderPath, filePath);
  if (frontMatter === null) {
    frontMatter = generatedFrontMatter;
  } else {
    if (args.force || frontMatter.title === undefined) {
      frontMatter.title = generatedFrontMatter.title;
    }
    if (frontMatter.date === undefined) {
      // never force update date
      frontMatter.date = generatedFrontMatter.date;
    }
    if (args.force || frontMatter.categories === undefined) {
      frontMatter.categories = generatedFrontMatter.categories;
    }
  }
  // find and delete the old front matter
  const frontMatterMatch = content.match(/^---\n([\s\S]+?)\n---/);
  if (frontMatterMatch) {
    content = content.replace(frontMatterMatch[0], "");
  }
  injectFrontMatter(frontMatter, filePath, content);
}

function injectFrontMatter(frontMatter, filepath, content) {
  // TODO Sort frontMatter by keyOrder
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
  if (frontMatter.date === undefined) {
    frontMatter.date = generateCurrentDate();
  }
  // https://eemeli.org/yaml/#yaml-stringify
  // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify#the_replacer_parameter
  console.log("customStringify");
  function replacer(key, value) {
    if (
      Array.isArray(value) &&
      value.length > 0 &&
      Array.isArray(value[0]) &&
      value[0].length > 0
    ) {
      console.log("Array: ", value);
      return value.map((subArray) => `[${subArray.join(", ")}]`);
    }
    return value;
  }

  let frontMatterContent =
    "---\n" + YAML.stringify(frontMatter, replacer) + "---\n";
  // Remove quotes around array elements
  frontMatterContent = frontMatterContent.replace(/"\[(.*?)\]"/g, "[$1]");
  console.log();
  fs.writeFile(filepath, frontMatterContent + content, (err) => {
    if (err) {
      console.error(err);
    }
  });
}

function parseFrontMatter(filePath, content) {
  // Read the file content
  const fileContent = content;
  // TODO - according to the config, we can rename the file with date
  // Find the YAML front matter between "---" markers
  const frontMatterMatch = fileContent.match(/^---\n([\s\S]+?)\n---/);
  console.log(frontMatterMatch);
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
