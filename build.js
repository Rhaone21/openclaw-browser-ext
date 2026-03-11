/**
 * Build script to bundle Chrome Extension files
 * Bundles ES modules into single files for Manifest V3 compatibility
 */

const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

async function build() {
  // Clean dist
  if (fs.existsSync('dist')) {
    fs.rmSync('dist', { recursive: true });
  }
  fs.mkdirSync('dist', { recursive: true });

  // Build background service worker
  await esbuild.build({
    entryPoints: ['src/background/index.ts'],
    bundle: true,
    outfile: 'dist/background.js',
    format: 'iife',
    platform: 'browser',
    target: 'chrome100',
    minify: true,
    sourcemap: true,
  });

  // Build content script
  await esbuild.build({
    entryPoints: ['src/content/index.ts'],
    bundle: true,
    outfile: 'dist/content.js',
    format: 'iife',
    platform: 'browser',
    target: 'chrome100',
    minify: true,
    sourcemap: true,
  });

  // Build options page
  await esbuild.build({
    entryPoints: ['src/options/options.ts'],
    bundle: true,
    outfile: 'dist/options.js',
    format: 'iife',
    platform: 'browser',
    target: 'chrome100',
    minify: true,
    sourcemap: true,
  });

  // Build popup
  await esbuild.build({
    entryPoints: ['src/popup/popup.ts'],
    bundle: true,
    outfile: 'dist/popup.js',
    format: 'iife',
    platform: 'browser',
    target: 'chrome100',
    minify: true,
    sourcemap: true,
  });

  // Copy static files
  fs.copyFileSync('public/manifest.json', 'dist/manifest.json');
  fs.copyFileSync('public/options.html', 'dist/options.html');
  fs.copyFileSync('public/popup.html', 'dist/popup.html');
  
  // Copy icons
  fs.cpSync('icons', 'dist/icons', { recursive: true });

  console.log('Build complete!');
}

build().catch((err) => {
  console.error('Build failed:', err);
  process.exit(1);
});
