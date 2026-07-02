import express from "express";
import fs from "node:fs";
import path from "node:path";
import { buildDiagnostics } from "./diagnostics.js";
import { openFirewallRule } from "./firewall.js";
import { MediaMtxController } from "./mediamtx.js";
import { FRONTEND_DIST_DIR, ensureRuntimeDirs } from "./paths.js";
import { WEB_PORT } from "./types.js";

ensureRuntimeDirs();

const app = express();
const bridge = new MediaMtxController();

app.use(express.json());

app.get("/api/health", (_request, response) => {
  response.json({
    ok: true,
    service: "PEPS LIVE Drone RTMP Bridge",
    status: bridge.getStatus()
  });
});

app.get("/api/status", (_request, response) => {
  response.json(bridge.getStatus());
});

app.get("/api/events", (request, response) => {
  response.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive"
  });

  const writeStatus = (status = bridge.getStatus()) => {
    response.write(`event: status\n`);
    response.write(`data: ${JSON.stringify(status)}\n\n`);
  };

  writeStatus();
  bridge.on("status", writeStatus);

  request.on("close", () => {
    bridge.off("status", writeStatus);
  });
});

app.post("/api/server/start", async (_request, response) => {
  response.json(await bridge.start());
});

app.post("/api/server/stop", async (_request, response) => {
  response.json(await bridge.stop());
});

app.post("/api/adapters/select", (request, response) => {
  const adapterId = String(request.body?.adapterId ?? "");
  response.json(bridge.setSelectedAdapter(adapterId));
});

app.get("/api/diagnostics", async (_request, response) => {
  response.json(await buildDiagnostics({
    processRunning: bridge.getStatus().processRunning
  }));
});

app.post("/api/firewall/open", async (request, response) => {
  response.json(await openFirewallRule(Boolean(request.body?.confirm)));
});

app.post("/api/logs/open-folder", (_request, response) => {
  response.json(bridge.openLogFolder());
});

app.get("/api/logs/recent", (_request, response) => {
  response.json({
    lines: bridge.recentLogs()
  });
});

if (fs.existsSync(FRONTEND_DIST_DIR)) {
  app.use(express.static(FRONTEND_DIST_DIR));
  app.get("*", (_request, response) => {
    response.sendFile(path.join(FRONTEND_DIST_DIR, "index.html"));
  });
}

const server = app.listen(WEB_PORT, "127.0.0.1", () => {
  bridge.startPolling();
  console.log(`PEPS LIVE Drone RTMP Bridge: http://127.0.0.1:${WEB_PORT}`);
});

async function close(): Promise<void> {
  await bridge.shutdown();
  server.close(() => process.exit(0));
}

process.once("SIGINT", () => {
  void close();
});

process.once("SIGTERM", () => {
  void close();
});
