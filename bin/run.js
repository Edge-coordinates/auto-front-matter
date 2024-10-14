#!/usr/bin/env node

import minimist from 'minimist';
import { startSever } from '../lib/index.js';

const args = minimist(process.argv.slice(2), {
  alias: {
    'init': 'i',
    'force': 'f',
    'dir': 'd',
  },
  boolean: ['init'],
  'default': {
    'dir': process.cwd()
  }
});

console.log(args);
startSever(args.dir, args);
// console.log(args.dir);
