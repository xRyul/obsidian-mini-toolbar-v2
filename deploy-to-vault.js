'use strict';

const fs = require('fs');
const path = require('path');

const projectRoot = __dirname;
const vaultPluginsPath = 'C:\\Users\\daniel\\Developer\\Obsidian Plugins\\Plugin-Testing-Vault\\.obsidian\\plugins';

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function main() {
  const manifestPath = path.join(projectRoot, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    console.error('manifest.json not found at', manifestPath);
    process.exit(1);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const pluginId = manifest.id;

  if (!pluginId) {
    console.error('No "id" field found in manifest.json');
    process.exit(1);
  }

  const targetDir = path.join(vaultPluginsPath, pluginId);
  ensureDir(targetDir);

  const files = ['main.js', 'manifest.json', 'styles.css'];

  for (const file of files) {
    const source = path.join(projectRoot, 'build', file);
    if (!fs.existsSync(source)) {
      if (file === 'styles.css') {
        // styles.css is optional
        continue;
      }
      console.error(`Required file "${source}" not found. Make sure the build step produced it.`);
      process.exit(1);
    }
    const dest = path.join(targetDir, file);
    fs.copyFileSync(source, dest);
    console.log(`Copied ${source} -> ${dest}`);
  }

  console.log(`Deployed plugin "${pluginId}" to testing vault at ${targetDir}`);
}

main();
