const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const pidFile = path.join(root, "config", "server.pid");

function log(message) {
  console.log(`[PEPS LIVE] ${message}`);
}

function taskkill(pid) {
  const result = spawnSync("taskkill", ["/PID", String(pid), "/T", "/F"], {
    cwd: root,
    stdio: "pipe",
    windowsHide: true,
    encoding: "utf8"
  });
  return result.status === 0;
}

function stopPidFromFile() {
  if (!fs.existsSync(pidFile)) {
    return false;
  }

  const pid = Number(fs.readFileSync(pidFile, "utf8").trim());
  fs.rmSync(pidFile, { force: true });
  if (!Number.isFinite(pid) || pid <= 0) {
    return false;
  }

  if (taskkill(pid)) {
    log(`Stopped server process PID ${pid}`);
    return true;
  }

  return false;
}

function findPortPid(port) {
  const result = spawnSync("netstat", ["-ano", "-p", "tcp"], {
    cwd: root,
    stdio: "pipe",
    windowsHide: true,
    encoding: "utf8"
  });

  if (result.status !== 0) {
    return undefined;
  }

  const line = result.stdout
    .split(/\r?\n/)
    .find((item) => {
      const columns = item.trim().split(/\s+/);
      return columns[0] === "TCP" && columns[1]?.endsWith(`:${port}`) && columns[3] === "LISTENING";
    });

  const pid = Number(line?.trim().split(/\s+/).at(-1));
  return Number.isFinite(pid) && pid > 0 ? pid : undefined;
}

function main() {
  const stoppedFromFile = stopPidFromFile();
  const portPid = findPortPid(19555);

  if (portPid && taskkill(portPid)) {
    log(`Stopped server listening on 19555 (PID ${portPid})`);
    return;
  }

  if (stoppedFromFile) {
    return;
  }

  log("No PEPS LIVE server process was found");
}

main();
