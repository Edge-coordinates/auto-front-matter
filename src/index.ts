#!/usr/bin/env node

import minimist from 'minimist';
import { startServer } from './lib/index.js';
import { CLIArgs } from './types/index.js';
import { logger, LogLevel } from './utils/index.js';

// 解析命令行参数
const args: CLIArgs = minimist(process.argv.slice(2), {
  alias: {
    'init': 'i',
    'force': 'f',
    'dir': 'd',
    'ct': 'c',
    'backup': 'b',
    'template': 't',
    'help': 'h',
    'verbose': 'v'
  },
  boolean: ['init', 'force', 'ct', 'backup', 'help', 'verbose'],
  string: ['dir', 'template'],
  'default': {
    'dir': process.cwd()
  }
});

// 设置日志级别
if (args.verbose) {
  logger.setLevel(LogLevel.DEBUG);
}

// 显示帮助信息
if (args.help) {
  showHelp();
  process.exit(0);
}

// 显示帮助信息函数
function showHelp() {
  console.log("AutoFrontMatter - Automatic Front Matter Generator");
  console.log("");
  console.log("Usage:");
  console.log("  autofm [options]");
  console.log("");
  console.log("Options:");
  console.log("  -h, --help              Show help information");
  console.log("  -d, --dir <path>        Target directory (default: current directory)");
  console.log("  -i, --init              Initialize front matter for all files");
  console.log("  -f, --force             Force update existing front matter");
  console.log("  -c, --ct                Regenerate categories and tags only");
  console.log("  -b, --backup            Enable backup before modifying files");
  console.log("  -t, --template <name>   Use specific template (default: 'default')");
  console.log("  -v, --verbose           Enable verbose logging");
  console.log("");
  console.log("Examples:");
  console.log("  autofm                  # Watch current directory");
  console.log("  autofm --init           # Initialize all files in current directory");
  console.log("  autofm --force          # Force update all front matter");
  console.log("  autofm --dir ./blog     # Watch specific directory");
  console.log("  autofm --template blog  # Use blog template");
  console.log("");
  console.log("For more information, visit: https://github.com/your-repo/auto-front-matter");
}

// 主函数
async function main() {
  try {
    logger.info("Starting AutoFrontMatter...");
    logger.debug("Arguments:", args);

    // 启动服务
    const service = await startServer(args.dir, args);

    // 处理进程退出信号
    process.on('SIGINT', async () => {
      logger.info("Received SIGINT, shutting down gracefully...");
      try {
        await service.stop();
        process.exit(0);
      } catch (error) {
        logger.error(`Error during shutdown: ${error.message}`);
        process.exit(1);
      }
    });

    process.on('SIGTERM', async () => {
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
    logger.error(`Failed to start AutoFrontMatter: ${error.message}`);
    process.exit(1);
  }
}

// 处理未捕获的异常
process.on('uncaughtException', (error) => {
  logger.error(`Uncaught Exception: ${error.message}`);
  console.error(error.stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error(`Unhandled Rejection at:`, promise, 'reason:', reason);
  process.exit(1);
});

// 启动应用
main();
