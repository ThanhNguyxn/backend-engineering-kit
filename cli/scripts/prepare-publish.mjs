#!/usr/bin/env node
/**
 * Prepare package for publishing
 * Copies adapters/ and .shared/ into cli/ so they're included in npm package
 */

import { cpSync, rmSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const cliRoot = join(__dirname, '..');
const repoRoot = join(cliRoot, '..');

// Directories to copy
const ASSETS = [
  { src: 'adapters', dest: 'adapters' },
  { src: '.shared', dest: '.shared' }
];

console.log('📦 Preparing package for publish...\n');

for (const { src, dest } of ASSETS) {
  const srcPath = join(repoRoot, src);
  const destPath = join(cliRoot, dest);
  
  // Clean existing
  if (existsSync(destPath)) {
    console.log(`  🗑️  Removing existing ${dest}/`);
    rmSync(destPath, { recursive: true, force: true });
  }
  
  // Copy
  if (existsSync(srcPath)) {
    console.log(`  📋 Copying ${src}/ → cli/${dest}/`);
    cpSync(srcPath, destPath, { recursive: true });
  } else {
    console.warn(`  ⚠️  Source not found: ${src}/`);
  }
}

console.log('\n✅ Package ready for publish!');
