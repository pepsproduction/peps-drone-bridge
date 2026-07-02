import { execFile } from "node:child_process";
import net from "node:net";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export async function isTcpPortOpen(host: string, port: number, timeoutMs = 700): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    const finish = (result: boolean) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(result);
    };

    socket.setTimeout(timeoutMs);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
  });
}

export async function canBindTcpPort(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, "0.0.0.0");
  });
}

export async function findWindowsPortOwner(port: number): Promise<string | undefined> {
  if (process.platform !== "win32") {
    return undefined;
  }

  try {
    const { stdout } = await execFileAsync("netstat", ["-ano", "-p", "tcp"], {
      windowsHide: true,
      timeout: 5000
    });
    const lines = stdout.split(/\r?\n/);
    const match = lines.find((line) => {
      const fields = line.trim().split(/\s+/);
      return fields[0] === "TCP"
        && fields[1]?.endsWith(`:${port}`)
        && fields[3] === "LISTENING";
    });
    if (!match) {
      return undefined;
    }

    const fields = match.trim().split(/\s+/);
    const pid = fields.at(-1);
    if (!pid) {
      return undefined;
    }

    const task = await execFileAsync("tasklist", ["/FI", `PID eq ${pid}`, "/FO", "CSV", "/NH"], {
      windowsHide: true,
      timeout: 5000
    });
    const processName = task.stdout.split(",")[0]?.replaceAll("\"", "").trim();
    return processName ? `${processName} (PID ${pid})` : `PID ${pid}`;
  } catch {
    return undefined;
  }
}
