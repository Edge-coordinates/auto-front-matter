import chokidar from "chokidar";

// One-liner for current directory
chokidar.watch(".").on("all", (event, path) => {
  console.log(event, path);
});

// Extended options
// ----------------

// Initialize watcher.
const watcher = chokidar.watch("file, dir, or array", {
  ignored: (path, stats) => stats?.isFile() && !path.endsWith(".js"), // only watch js files
  persistent: true,
});

// Something to use when events are received.
const log = console.log.bind(console);
// Add event listeners.
watcher
  .on("add", (path) => log(`File ${path} has been added`))
  .on("change", (path) => log(`File ${path} has been changed`))
  .on("unlink", (path) => log(`File ${path} has been removed`));

// More possible events.
watcher
  .on("addDir", (path) => log(`Directory ${path} has been added`))
  .on("unlinkDir", (path) => log(`Directory ${path} has been removed`))
  .on("error", (error) => log(`Watcher error: ${error}`))
  .on("ready", () => log("Initial scan complete. Ready for changes"))
  .on("raw", (event, path, details) => {
    // internal
    log("Raw event info:", event, path, details);
  });

// 'add', 'addDir' and 'change' events also receive stat() results as second
// argument when available: https://nodejs.org/api/fs.html#fs_class_fs_stats
watcher.on("change", (path, stats) => {
  if (stats) console.log(`File ${path} changed size to ${stats.size}`);
});

// Watch new files.
watcher.add("new-file");
watcher.add(["new-file-2", "new-file-3"]);

// Get list of actual paths being watched on the filesystem
let watchedPaths = watcher.getWatched();

// Un-watch some files.
await watcher.unwatch("new-file");

// Stop watching. The method is async!
await watcher.close().then(() => console.log("closed"));

// Full list of options. See below for descriptions.
// Do not use this example!
chokidar.watch("file", {
  persistent: true,

  // ignore .txt files
  ignored: (file) => file.endsWith(".txt"),
  // watch only .txt files
  // ignored: (file, _stats) => _stats?.isFile() && !file.endsWith('.txt'),

  awaitWriteFinish: true, // emit single event when chunked writes are completed
  atomic: true, // emit proper events when "atomic writes" (mv _tmp file) are used

  // The options also allow specifying custom intervals in ms
  // awaitWriteFinish: {
  //   stabilityThreshold: 2000,
  //   pollInterval: 100
  // },
  // atomic: 100,

  interval: 100,
  binaryInterval: 300,

  cwd: ".",
  depth: 99,

  followSymlinks: true,
  ignoreInitial: false,
  ignorePermissionErrors: false,
  usePolling: false,
  alwaysStat: false,
});
