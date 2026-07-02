const fs = require("node:fs");
const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const configDir = path.join(root, "config");
const logsDir = path.join(root, "logs");
const pidFile = path.join(configDir, "server.pid");
const setupLogFile = path.join(logsDir, "windows-launcher-setup.log");
const webUrl = "http://127.0.0.1:19555";
const healthUrl = `${webUrl}/api/health`;
let cachedNpmCommand;

function ensureDirs() {
  fs.mkdirSync(configDir, { recursive: true });
  fs.mkdirSync(logsDir, { recursive: true });
}

function log(message) {
  console.log(`[PEPS LIVE] ${message}`);
}

function appendSetupLog(message) {
  fs.appendFileSync(setupLogFile, message, "utf8");
}

function openSetupLog() {
  if (process.platform === "win32" && fs.existsSync(setupLogFile)) {
    spawn("notepad.exe", [setupLogFile], {
      detached: true,
      stdio: "ignore",
      windowsHide: false
    }).unref();
  }
}

function lastLines(text, count = 30) {
  return text.split(/\r?\n/).filter(Boolean).slice(-count).join("\n");
}

function run(command, args, label) {
  log(label);
  const displayCommand = Array.isArray(command) ? command.join(" ") : command;
  appendSetupLog(`\n\n[${new Date().toISOString()}] ${label}\n> ${displayCommand} ${args.join(" ")}\n`);
  const executable = Array.isArray(command) ? command[0] : command;
  const commandArgs = Array.isArray(command) ? command.slice(1).concat(args) : args;
  const result = spawnSync(executable, commandArgs, {
    cwd: root,
    encoding: "utf8",
    env: {
      ...process.env,
      NO_COLOR: "1",
      FORCE_COLOR: "0",
      npm_config_color: "false"
    },
    maxBuffer: 20 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
    shell: false,
    windowsHide: false
  });

  if (result.stdout) {
    process.stdout.write(result.stdout);
    appendSetupLog(result.stdout);
  }

  if (result.stderr) {
    process.stderr.write(result.stderr);
    appendSetupLog(result.stderr);
  }

  if (result.error) {
    appendSetupLog(`\nSpawn error: ${result.error.message}\n`);
    throw new Error(`${label} failed before command output started: ${result.error.message}. See ${setupLogFile}`);
  }

  if (result.status !== 0) {
    const output = [result.stdout, result.stderr].filter(Boolean).join("\n");
    const tail = lastLines(output);
    throw new Error(`${label} failed with exit code ${result.status}. See ${setupLogFile}${tail ? `\n\nLast output:\n${tail}` : ""}`);
  }
}

async function healthOk() {
  try {
    const response = await fetch(healthUrl, { signal: AbortSignal.timeout(1200) });
    if (!response.ok) return false;
    const payload = await response.json();
    return Boolean(payload.ok);
  } catch {
    return false;
  }
}

async function waitForHealth(timeoutMs = 25000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await healthOk()) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 700));
  }
  return false;
}

function openBrowser() {
  spawn("cmd.exe", ["/c", "start", "", webUrl], {
    cwd: root,
    detached: true,
    stdio: "ignore",
    windowsHide: true
  }).unref();
}

function commandWorks(command, args) {
  const executable = Array.isArray(command) ? command[0] : command;
  const commandArgs = Array.isArray(command) ? command.slice(1).concat(args) : args;
  const result = spawnSync(executable, commandArgs, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true
  });
  return !result.error && result.status === 0;
}

function npmCmd() {
  if (cachedNpmCommand) {
    return cachedNpmCommand;
  }

  if (process.platform !== "win32") {
    cachedNpmCommand = "npm";
    return cachedNpmCommand;
  }

  const nodeDirNpm = path.join(path.dirname(process.execPath), "npm.cmd");
  const candidates = [
    nodeDirNpm,
    "npm.cmd",
    ["cmd.exe", "/d", "/s", "/c", "npm"]
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      if (commandWorks(candidate, ["--version"])) {
        cachedNpmCommand = candidate;
        return cachedNpmCommand;
      }
      continue;
    }

    if ((path.isAbsolute(candidate) && !fs.existsSync(candidate))) {
      continue;
    }

    if (commandWorks(candidate, ["--version"])) {
      cachedNpmCommand = candidate;
      return cachedNpmCommand;
    }
  }

  throw new Error("ไม่พบ npm.cmd สำหรับรัน build กรุณาติดตั้ง Node.js จาก https://nodejs.org/en/download แล้วเลือกติดตั้ง npm ด้วย");
}

function ensureInstalled() {
  if (!fs.existsSync(path.join(root, "node_modules"))) {
    run(npmCmd(), ["install"], "Installing npm packages");
  }
}

function ensureMediaMtx() {
  if (!fs.existsSync(path.join(root, "mediamtx", "mediamtx.exe"))) {
    run(npmCmd(), ["run", "setup:mediamtx"], "Setting up MediaMTX");
  }
}

function latestMtime(target) {
  if (!fs.existsSync(target)) {
    return 0;
  }

  const stat = fs.statSync(target);
  if (stat.isFile()) {
    return stat.mtimeMs;
  }

  return fs.readdirSync(target)
    .map((entry) => latestMtime(path.join(target, entry)))
    .reduce((latest, value) => Math.max(latest, value), stat.mtimeMs);
}

function ensureBuilt() {
  const serverEntry = path.join(root, "server", "dist", "index.js");
  const frontendEntry = path.join(root, "frontend", "dist", "index.html");
  const buildMtime = Math.min(
    latestMtime(serverEntry),
    latestMtime(frontendEntry)
  );
  const sourceMtime = Math.max(
    latestMtime(path.join(root, "server", "src")),
    latestMtime(path.join(root, "frontend", "src")),
    latestMtime(path.join(root, "scripts")),
    latestMtime(path.join(root, "package.json")),
    latestMtime(path.join(root, "package-lock.json"))
  );

  if (!fs.existsSync(serverEntry) || !fs.existsSync(frontendEntry) || sourceMtime > buildMtime) {
    run(npmCmd(), ["run", "build"], "Building local app");
  }
}

function startServer() {
  const stdout = fs.openSync(path.join(logsDir, "windows-launcher-server.log"), "a");
  const stderr = fs.openSync(path.join(logsDir, "windows-launcher-server-error.log"), "a");
  const child = spawn(process.execPath, [path.join(root, "server", "dist", "index.js")], {
    cwd: root,
    detached: true,
    stdio: ["ignore", stdout, stderr],
    windowsHide: true
  });

  fs.writeFileSync(pidFile, `${child.pid}\n`, "utf8");
  child.unref();
  return child.pid;
}

async function main() {
  ensureDirs();
  appendSetupLog(`\n\n========== PEPS LIVE START ${new Date().toISOString()} ==========\n`);
  appendSetupLog(`Node.js ${process.version}\n`);
  appendSetupLog(`Project: ${root}\n`);

  if (await healthOk()) {
    log("Server is already running");
    openBrowser();
    return;
  }

  ensureInstalled();
  ensureMediaMtx();
  ensureBuilt();

  const pid = startServer();
  log(`Starting local server in background (PID ${pid})`);

  const ready = await waitForHealth();
  if (!ready) {
    throw new Error("Server did not become ready. Check logs/windows-launcher-server-error.log");
  }

  log(`Opening ${webUrl}`);
  openBrowser();
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[PEPS LIVE] ${message}`);
  appendSetupLog(`\n[${new Date().toISOString()}] ERROR\n${message}\n`);
  openSetupLog();
  process.exitCode = 1;
});
