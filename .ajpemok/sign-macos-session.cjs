const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

module.exports = async function signInLoginSession(context, configPath) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "ajp3-signing-job-"));
  fs.chmodSync(directory, 0o700);
  const label = `com.ajp3.local-sign.${path.basename(directory)}`;
  const domain = `gui/${os.userInfo().uid}`;
  const input = path.join(directory, "input.json");
  const receipt = path.join(directory, "receipt.json");
  const plist = path.join(directory, "job.plist");
  const log = path.join(directory, "output.log");
  const run = (args) => spawnSync("/bin/launchctl", args, { encoding: "utf8", timeout: 10000 });
  let started = false;
  let watcher;
  let timer;
  let failure;
  try {
    fs.writeFileSync(
      input,
      JSON.stringify({
        context: {
          appOutDir: context.appOutDir,
          packager: { appInfo: { productFilename: context.packager.appInfo.productFilename } },
        },
        configPath,
      }),
    );
    const conversion = spawnSync("/usr/bin/plutil", ["-convert", "xml1", "-o", plist, "-"], {
      encoding: "utf8",
      input: JSON.stringify({
        Label: label,
        ProgramArguments: [process.execPath, __filename, input],
        RunAtLoad: true,
        LimitLoadToSessionType: "Aqua",
        StandardOutPath: log,
        StandardErrorPath: log,
        EnvironmentVariables: {
          HOME: os.homedir(),
          PATH: `${path.dirname(process.execPath)}:/usr/bin:/bin:/usr/sbin:/sbin`,
        },
      }),
    });
    if (conversion.status !== 0)
      throw new Error(conversion.stderr || "Cannot prepare signing job.");
    await new Promise((resolve, reject) => {
      watcher = fs.watch(directory, (_event, name) => {
        if (name !== "receipt.json") return;
        try {
          const result = JSON.parse(fs.readFileSync(receipt, "utf8"));
          if (result.ok) resolve();
          else reject(new Error(result.error));
        } catch (error) {
          reject(error);
        }
      });
      timer = setTimeout(() => reject(new Error("Local signing exceeded ten minutes.")), 600000);
      const bootstrap = run(["bootstrap", domain, plist]);
      if (bootstrap.status !== 0)
        reject(new Error(bootstrap.stderr || "The logged-in macOS session is unavailable."));
      else started = true;
    });
  } catch (error) {
    failure = error;
  } finally {
    watcher?.close();
    clearTimeout(timer);
    if (fs.existsSync(log)) console.log(fs.readFileSync(log, "utf8").trim());
    if (started) {
      const removed = run(["bootout", `${domain}/${label}`]);
      if (removed.status !== 0)
        failure = new Error(
          `Signing job cleanup failed: ${label}. Retained ${directory}: ${removed.stderr}. ${failure ?? ""}`,
        );
      else started = false;
    }
    if (!started) {
      for (const name of fs.readdirSync(directory)) fs.unlinkSync(path.join(directory, name));
      fs.rmdirSync(directory);
    }
  }
  if (failure) throw failure;
};

if (require.main === module) {
  const input = fs.realpathSync(process.argv[2]);
  const directory = path.dirname(input);
  if (
    path.dirname(directory) !== fs.realpathSync(os.tmpdir()) ||
    !path.basename(directory).startsWith("ajp3-signing-job-")
  )
    throw new Error("Invalid signing job directory.");
  const { context, configPath } = JSON.parse(fs.readFileSync(input, "utf8"));
  process.env.T3CODE_LOCAL_SIGNING_CONFIG = configPath;
  delete process.env.SSH_CONNECTION;
  delete process.env.SSH_TTY;
  Promise.resolve()
    .then(() => require("./sign-macos.cjs")(context))
    .then(
      () => ({ ok: true }),
      (error) => {
        process.exitCode = 1;
        return { ok: false, error: String(error?.stack ?? error) };
      },
    )
    .then((result) => {
      const temporary = path.join(directory, "receipt.tmp");
      fs.writeFileSync(temporary, JSON.stringify(result));
      fs.renameSync(temporary, path.join(directory, "receipt.json"));
    });
}
