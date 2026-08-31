const fs = require('node:fs');
const path = require('node:path');

const { withDangerousMod } = require('@expo/config-plugins');

const MARKER = '# Work around fmt 11.0.2 with Apple Clang 21 (Xcode 26.4+).';
const POST_INSTALL = '  post_install do |installer|\n';

module.exports = function withFmtXcode26Fix(config) {
  return withDangerousMod(config, [
    'ios',
    async (modConfig) => {
      const podfilePath = path.join(modConfig.modRequest.platformProjectRoot, 'Podfile');
      let podfile = fs.readFileSync(podfilePath, 'utf8');

      if (podfile.includes(MARKER)) {
        return modConfig;
      }

      if (!podfile.includes(POST_INSTALL)) {
        throw new Error('Could not find the post_install block in the generated iOS Podfile.');
      }

      const workaround = `${POST_INSTALL}    ${MARKER}
    fmt_base = File.join(installer.sandbox.root, 'fmt', 'include', 'fmt', 'base.h')
    if File.exist?(fmt_base)
      content = File.read(fmt_base)
      patched = content.gsub(
        '#elif defined(__apple_build_version__) && __apple_build_version__ < 14000029L',
        '#elif defined(__apple_build_version__)'
      )
      if patched != content
        File.chmod(0644, fmt_base)
        File.write(fmt_base, patched)
      end
    end

`;

      podfile = podfile.replace(POST_INSTALL, workaround);
      fs.writeFileSync(podfilePath, podfile);

      return modConfig;
    },
  ]);
};
