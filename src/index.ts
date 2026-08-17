#!/usr/bin/env node

import minimist from "minimist";
import { ConfigManager, listPresetNames } from "./config/index.js";
import { startServer } from "./lib/index.js";
import { CLIArgs } from "./types/index.js";
import { logger, LogLevel } from "./utils/index.js";

const args: CLIArgs = minimist(process.argv.slice(2), {
  alias: {
    init: "i",
    force: "f",
    dir: "d",
    ct: "c",
    backup: "b",
    template: "t",
    help: "h",
    verbose: "v",
    config: "C",
    preset: "p",
  },
  boolean: ["init", "force", "ct", "backup", "help", "verbose", "init-config"],
  string: ["dir", "template", "config", "preset"],
  default: {
    dir: process.cwd(),
  },
});

if (args.verbose) {
  logger.setLevel(LogLevel.DEBUG);
}

if (args.help) {
  showHelp();
  process.exit(0);
}

function showHelp() {
  console.log("AutoFrontMatter - Automatic Front Matter Generator");
  console.log("");
  console.log("Usage:");
  console.log("  autofm [options]");
  console.log("  autofm init-config [--preset <name>] [--dir <path>] [--force]");
  console.log("");
  console.log("Commands:");
  console.log("  init-config             Write .autofm/config.json and exit");
  console.log("");
  console.log("Options:");
  console.log("  -h, --help              Show help information");
  console.log("  -d, --dir <path>        Target directory (default: current directory)");
  console.log("  -C, --config <path>     Use a specific config file");
  console.log("  -p, --preset <name>     Config preset for init-config: " + listPresetNames().join(", "));
  console.log("  -i, --init              Initialize front matter for all files");
  console.log("  -f, --force             Force update existing front matter");
  console.log("                          (with init-config: overwrite existing config)");
  console.log("  -c, --ct                Regenerate categories and tags only");
  console.log("  -b, --backup            Enable backup before modifying files");
  console.log("  -t, --template <name>   Use specific template (default: 'default')");
  console.log("  -v, --verbose           Enable verbose logging");
  console.log("");
  console.log("Examples:");
  console.log("  autofm init-config --preset hexo");
  console.log("  autofm                  # Watch current directory");
  console.log("  autofm --init           # Initialize all files in current directory");
  console.log("  autofm --force          # Force update all front matter");
  console.log("  autofm --dir ./blog     # Watch specific directory");
  console.log("  autofm --config ./.autofm/config.json");
  console.log("");
  console.log("Docs: https://github.com/Edge-coordinates/auto-front-matter/tree/main/docs");
}

function isInitConfigCommand(cliArgs: CLIArgs): boolean {
  return cliArgs._?.[0] === "init-config" || Boolean((cliArgs as any)["init-config"]) || Boolean(cliArgs.initConfig);
}

async function runInitConfig(cliArgs: CLIArgs): Promise<void> {
  const manager = new ConfigManager(cliArgs.dir, { configPath: cliArgs.config });
  const written = await manager.initConfig(cliArgs.preset || "minimal", Boolean(cliArgs.force));
  console.log(`Wrote config to ${written}`);
}

async function main() {
  try {
    if (isInitConfigCommand(args)) {
      await runInitConfig(args);
      return;
    }

    logger.info("Starting AutoFrontMatter...");
    logger.debug("Arguments:", args);

    const service = await startServer(args.dir, args);

    process.on("SIGINT", async () => {
      logger.info("Received SIGINT, shutting down gracefully...");
      try {
        await service.stop();
        process.exit(0);
      } catch (error) {
        logger.error(`Error during shutdown: ${error.message}`);
        process.exit(1);
      }
    });

    process.on("SIGTERM", async () => {
      logger.info("Received SIGTERM, shutting down gracefully...");
      try {
        await service.stop();
        process.exit(0);
      } catch (error) {
        logger.error(`Error during shutdown: ${error.message}`);
        process.exit(1);
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(message);
    process.exit(1);
  }
}

process.on("uncaughtException", (error) => {
  logger.error(`Uncaught Exception: ${error.message}`);
  console.error(error.stack);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  logger.error(`Unhandled Rejection at:`, promise, "reason:", reason);
  process.exit(1);
});

main();
