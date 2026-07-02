import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentFile = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFile);

export const PROJECT_ROOT = process.env.PEPS_BRIDGE_ROOT
  ? path.resolve(process.env.PEPS_BRIDGE_ROOT)
  : path.resolve(currentDir, "..", "..");

export const CONFIG_DIR = path.join(PROJECT_ROOT, "config");
export const MEDIAMTX_DIR = path.join(PROJECT_ROOT, "mediamtx");
export const LOG_DIR = path.join(PROJECT_ROOT, "logs");
export const FRONTEND_DIST_DIR = path.join(PROJECT_ROOT, "frontend", "dist");
export const MEDIAMTX_EXE = path.join(MEDIAMTX_DIR, "mediamtx.exe");
export const MEDIAMTX_CONFIG = path.join(CONFIG_DIR, "mediamtx.yml");
export const SETTINGS_FILE = path.join(CONFIG_DIR, "settings.json");

export function ensureRuntimeDirs(): void {
  for (const dir of [CONFIG_DIR, MEDIAMTX_DIR, LOG_DIR]) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function datedLogFile(prefix: string): string {
  ensureRuntimeDirs();
  const date = new Date().toISOString().slice(0, 10);
  return path.join(LOG_DIR, `${date}-${prefix}.log`);
}
