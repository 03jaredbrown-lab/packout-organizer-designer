// Metro config so the Expo app can import the shared TypeScript core that lives
// one level up in ../src (model + layout + geometry). Standard Expo "code
// outside the app dir" setup: watch the repo root and let Metro resolve modules
// from both node_modules trees.
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const repoRoot = path.resolve(projectRoot, "..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [repoRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(repoRoot, "node_modules"),
];
// The repo root has its own package.json (the web app); don't let Metro treat it
// as a workspace package to bundle.
config.resolver.disableHierarchicalLookup = false;

module.exports = config;
