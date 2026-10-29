const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync, spawnSync } = require("node:child_process");
const { createRequire } = require("node:module");

module.exports = async function signLocalMacBuild(context) {
  if (os.platform() !== "darwin") throw new Error("Local macOS signing requires a Mac.");
  const configPath =
    process.env.T3CODE_LOCAL_SIGNING_CONFIG ??
    path.join(os.homedir(), ".local/share/a3-fork-signing/identity.json");
  if (!process.env.T3CODE_LOCAL_SIGNING_CONFIG && !fs.existsSync(configPath)) return;
  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  if (!/^[A-F0-9]{40}$/.test(config.identity)) throw new Error("Invalid signing fingerprint.");
  const keychain = fs.realpathSync(config.keychain);
  const expected = fs.realpathSync(path.join(os.homedir(), "Library/Keychains/login.keychain-db"));
  if (keychain !== expected) throw new Error("Signing must use the configured login keychain.");
  const run = (file, args) => execFileSync(file, args, { encoding: "utf8", timeout: 60000 });
  if (
    !run("/usr/bin/security", ["find-identity", "-v", "-p", "codesigning", keychain]).includes(
      config.identity,
    )
  ) {
    throw new Error("The configured local signing identity is not valid.");
  }
  const output = fs.realpathSync(context.appOutDir);
  const temp = fs.realpathSync(os.tmpdir());
  const relative = path.relative(temp, output).split(path.sep);
  if (
    relative.length < 3 ||
    !relative[0].startsWith("t3code-desktop-mac-stage-") ||
    relative.includes("..")
  ) {
    throw new Error("Signing is restricted to desktop build staging.");
  }
  const app = path.join(output, `${context.packager.appInfo.productFilename}.app`);
  if (fs.realpathSync(app) !== app) throw new Error("The staged app must not be a link.");
  const bundleId = run("/usr/libexec/PlistBuddy", [
    "-c",
    "Print :CFBundleIdentifier",
    path.join(app, "Contents/Info.plist"),
  ]).trim();
  if (bundleId !== "com.t3tools.t3code") throw new Error("The staged bundle identity changed.");
  const requireScripts = createRequire(path.join(__dirname, "../scripts/package.json"));
  const { sign } = await import(requireScripts.resolve("@electron/osx-sign"));
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "ajp3-entitlements-"));
  fs.chmodSync(scratch, 0o700);
  let index = 0;
  const entitlementFiles = new Map();
  try {
    await sign({
      app,
      identity: config.identity,
      keychain,
      platform: "darwin",
      batchCodesignCalls: true,
      preAutoEntitlements: false,
      preEmbedProvisioningProfile: false,
      optionsForFile(file) {
        const result = spawnSync("/usr/bin/codesign", ["-d", "--entitlements", ":-", file], {
          encoding: "utf8",
        });
        if (result.status !== 0 && !result.stderr.includes("code object is not signed at all"))
          throw new Error(`Cannot read existing entitlements: ${file}`);
        const contents =
          result.stdout.trim() ||
          '<?xml version="1.0"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict/></plist>';
        let entitlements = entitlementFiles.get(contents);
        if (!entitlements) {
          entitlements = path.join(scratch, `${index++}.plist`);
          fs.writeFileSync(entitlements, contents);
          entitlementFiles.set(contents, entitlements);
        }
        return {
          entitlements,
          hardenedRuntime: false,
          timestamp: "none",
          additionalArguments: ["--preserve-metadata=identifier,flags,runtime"],
        };
      },
    });
    run("/usr/bin/codesign", ["--verify", "--deep", "--strict", app]);
    const result = spawnSync("/usr/bin/codesign", ["-d", "-r-", app], { encoding: "utf8" });
    if (
      result.status !== 0 ||
      !(result.stdout + result.stderr).toUpperCase().includes(config.identity) ||
      /designated => cdhash/.test(result.stdout + result.stderr)
    ) {
      throw new Error("The signed app does not retain the configured certificate requirement.");
    }
    console.log(`Locally signed ${app} with ${config.identity}.`);
  } finally {
    for (const name of fs.readdirSync(scratch)) fs.unlinkSync(path.join(scratch, name));
    fs.rmdirSync(scratch);
  }
};
