import fs from "node:fs";
import { SETTINGS_FILE, ensureRuntimeDirs } from "./paths.js";
import type { StoredSettings } from "./types.js";

export function readSettings(): StoredSettings {
  ensureRuntimeDirs();
  if (!fs.existsSync(SETTINGS_FILE)) {
    return {};
  }

  try {
    return JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf8")) as StoredSettings;
  } catch {
    return {};
  }
}

export function writeSettings(settings: StoredSettings): void {
  ensureRuntimeDirs();
  fs.writeFileSync(SETTINGS_FILE, `${JSON.stringify(settings, null, 2)}\n`, "utf8");
}
