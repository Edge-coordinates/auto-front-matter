#!/usr/bin/env node

import minimist from 'minimist';
import { startSever } from '../lib/index.js';

const args = minimist(process.argv.slice(2), {
  alias: {
    'init': 'i',
    'force': 'f',
    'dir': 'd',
  },
  boolean: ['init', 'force'],
  'default': {
    'dir': process.cwd()
  }
});

if (args.help) {
  console.log("Usage:");
  console.log("  autofm --help // print help information");
  console.log("  autofm // current folder as root");
  console.log("  autofm --init (-i) // init model for the whole folder");
  console.log("  autofm --force (-f) // use force model to cover the old front matter");
  process.exit(0);
}

console.log(args);
startSever(args.dir, args);
// console.log(args.dir);
