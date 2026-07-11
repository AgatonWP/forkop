// Recreates shim files missing from the expo@56 npm package after each `npm install`.
// These files exist as TypeScript source in expo/src/ but were not compiled before publishing.
const fs = require('fs');
const path = require('path');

const expoRoot = path.resolve(__dirname, '../node_modules/expo');
const repoRoot = path.resolve(__dirname, '..');

const shims = {
  'config-plugins.js': `module.exports = require('@expo/config-plugins');\n`,

  'dom.js': `'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.IS_DOM = false;
exports.addGlobalDomEventListener = function() { return function() {}; };
`,

  'dom/index.js': `'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.IS_DOM = false;
exports.addGlobalDomEventListener = function() { return function() {}; };
`,

  'dom/global.js': `'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.addGlobalDomEventListener = function() { return function() {}; };
exports._emitGlobalEvent = function() {};
`,

  'fetch.js': `'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.fetch = globalThis.fetch;
`,
};

for (const [rel, content] of Object.entries(shims)) {
  const dest = path.join(expoRoot, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, content);
}

function replaceIfExists(file, replacements) {
  if (!fs.existsSync(file)) return false;

  let content = fs.readFileSync(file, 'utf8');
  let changed = false;

  for (const [from, to] of replacements) {
    if (content.includes(from)) {
      content = content.replaceAll(from, to);
      changed = true;
    }
  }

  if (changed) {
    fs.writeFileSync(file, content);
  }

  return changed;
}

// The expo-constants iOS build phase invokes a generated script via bash -c.
// Without inner quotes, project paths containing spaces are split by bash.
const constantsPodspec = path.join(repoRoot, 'node_modules/expo-constants/ios/EXConstants.podspec');
const constantsPodsProject = path.join(repoRoot, 'ios/Pods/Pods.xcodeproj/project.pbxproj');
const constantsScriptFixes = [
  [
    ':script => "bash -l -c \\"#{env_vars}$PODS_TARGET_SRCROOT/../scripts/get-app-config-ios.sh\\""',
    ':script => "bash -l -c \\"#{env_vars}\\\\\\"$PODS_TARGET_SRCROOT/../scripts/get-app-config-ios.sh\\\\\\"\\""',
  ],
  [
    'shellScript = "bash -l -c \\"$PODS_TARGET_SRCROOT/../scripts/get-app-config-ios.sh\\"";',
    'shellScript = "bash -l -c \\"\\\\\\"$PODS_TARGET_SRCROOT/../scripts/get-app-config-ios.sh\\\\\\"\\"";',
  ],
];

const patchedConstantsPodspec = replaceIfExists(constantsPodspec, constantsScriptFixes);
const patchedConstantsPodsProject = replaceIfExists(constantsPodsProject, constantsScriptFixes);

// The Expo Constants script also checks whether Xcode is building from Pods
// with basename. Keep PROJECT_DIR quoted so paths with spaces are not split.
const constantsConfigScript = path.join(repoRoot, 'node_modules/expo-constants/scripts/get-app-config-ios.sh');
const constantsConfigScriptFixes = [
  ['PROJECT_DIR_BASENAME=$(basename $PROJECT_DIR)', 'PROJECT_DIR_BASENAME=$(basename "$PROJECT_DIR")'],
  [
    'if [ "$BUNDLE_FORMAT" == "shallow" ]; then\n  RESOURCE_DEST="$DEST/$RESOURCE_BUNDLE_NAME"',
    'if [ "$BUNDLE_FORMAT" == "shallow" ]; then\n  RESOURCE_DEST="$DEST/$RESOURCE_BUNDLE_NAME"\n  mkdir -p "$RESOURCE_DEST"',
  ],
];

const patchedConstantsConfigScript = replaceIfExists(constantsConfigScript, constantsConfigScriptFixes);

// The app bundle phase gets the React Native xcode script path from Node and
// executes the output directly. Quote the substitution so spaces in repo paths work.
const appXcodeProject = path.join(repoRoot, 'ios/forkop.xcodeproj/project.pbxproj');
const appBundleScriptFixes = [
  [
    '`"$NODE_BINARY" --print "require(\'path\').dirname(require.resolve(\'react-native/package.json\')) + \'/scripts/react-native-xcode.sh\'"`',
    '"$("$NODE_BINARY" --print "require(\'path\').dirname(require.resolve(\'react-native/package.json\')) + \'/scripts/react-native-xcode.sh\'")"',
  ],
];

const patchedAppBundleScript = replaceIfExists(appXcodeProject, appBundleScriptFixes);

console.log(
  `expo shims patched OK${
    patchedConstantsPodspec || patchedConstantsPodsProject || patchedConstantsConfigScript
      ? ' + expo-constants path quoting'
      : ''
  }${patchedAppBundleScript ? ' + app bundle path quoting' : ''}`,
);
