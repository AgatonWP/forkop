// Recreates shim files missing from the expo@56 npm package after each `npm install`.
// These files exist as TypeScript source in expo/src/ but were not compiled before publishing.
const fs = require('fs');
const path = require('path');

const expoRoot = path.resolve(__dirname, '../node_modules/expo');

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

console.log('expo shims patched OK');
