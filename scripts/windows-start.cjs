const fs = require("node:fs");
const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const configDir = path.join(root, "config");
const logsDir = path.join(root, "logs");
const pidFile = path.join(configDir, "server.pid");
const webUrl = "http://127.0.0.1:19555";
const healthUrl = `${webUrl}/api/health`;

function ensureDirs() {
  fs.mkdirSync(configDir, { recursive: true });
  fs.mkdirSync(logsDir, { recursive: true });
}

function log(message) {
  console.log(`[PEPS LIVE] ${message}`);
}

function run(command, args, label) {
  log(label);
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: "inherit",
    shell: false,
    windowsHide: false
  });

  if (result.status !== 0) {
    throw new Error(`${label} failed`);
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

function npmCmd() {
  return process.platform === "win32" ? "npm.cmd" : "npm";
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
  console.error(`[PEPS LIVE] ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
});
