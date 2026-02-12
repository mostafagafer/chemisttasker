const { withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

const MARKER_BEGIN = "# BEGIN CHEMISTTASKER NON-MODULAR HEADERS";
const MARKER_END = "# END CHEMISTTASKER NON-MODULAR HEADERS";

const POST_INSTALL_SNIPPET = `${MARKER_BEGIN}
  installer.pods_project.targets.each do |target|
    target.build_configurations.each do |config|
      config.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'
    end
  end
${MARKER_END}`;

function addUseModularHeaders(podfile) {
  if (podfile.includes("use_modular_headers!")) {
    return podfile;
  }

  const platformRegex = /^platform\s+:ios.*$/m;
  if (platformRegex.test(podfile)) {
    return podfile.replace(platformRegex, (match) => `${match}\nuse_modular_headers!`);
  }

  return `use_modular_headers!\n${podfile}`;
}

function addOrUpdatePostInstallSnippet(podfile) {
  if (podfile.includes(MARKER_BEGIN)) {
    return podfile.replace(
      new RegExp(`${MARKER_BEGIN}[\\s\\S]*?${MARKER_END}`),
      POST_INSTALL_SNIPPET
    );
  }

  const postInstallRegex = /post_install\s+do\s+\|installer\|([\s\S]*?)end\s*$/m;
  if (postInstallRegex.test(podfile)) {
    return podfile.replace(postInstallRegex, (match, body) => {
      const trimmedBody = body.replace(/\n\s*$/m, "");
      return `post_install do |installer|\n${POST_INSTALL_SNIPPET}\n${trimmedBody}\nend`;
    });
  }

  return `${podfile.trim()}\n\npost_install do |installer|\n${POST_INSTALL_SNIPPET}\nend\n`;
}

module.exports = function withIosNonModularHeaders(config) {
  return withDangerousMod(config, [
    "ios",
    (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, "Podfile");
      if (!fs.existsSync(podfilePath)) {
        return config;
      }

      let podfile = fs.readFileSync(podfilePath, "utf8");
      const updated = addOrUpdatePostInstallSnippet(addUseModularHeaders(podfile));

      if (updated !== podfile) {
        fs.writeFileSync(podfilePath, updated);
      }

      return config;
    },
  ]);
};
