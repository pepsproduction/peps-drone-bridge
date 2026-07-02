import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const projectRoot = path.resolve(import.meta.dirname, "..");
const mediaMtxDir = path.join(projectRoot, "mediamtx");
const downloadDir = path.join(mediaMtxDir, "_download");
const zipPath = path.join(mediaMtxDir, "mediamtx.zip");

interface GitHubAsset {
  name: string;
  browser_download_url: string;
}

interface GitHubRelease {
  tag_name: string;
  assets: GitHubAsset[];
}

function platformAssetPattern(): RegExp {
  if (process.platform !== "win32") {
    throw new Error("Local test build นี้เตรียม MediaMTX runtime สำหรับ Windows เท่านั้น");
  }

  const arch = process.arch === "arm64" ? "arm64" : "amd64";
  return new RegExp(`windows_${arch}\\.zip$`, "i");
}

async function latestRelease(): Promise<GitHubRelease> {
  const response = await fetch("https://api.github.com/repos/bluenviron/mediamtx/releases/latest", {
    headers: {
      "User-Agent": "peps-drone-bridge-local-setup"
    }
  });

  if (!response.ok) {
    throw new Error(`GitHub release lookup failed: ${response.status}`);
  }

  return response.json() as Promise<GitHubRelease>;
}

async function download(url: string, destination: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Download failed: ${response.status}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(destination, buffer);
}

function psQuote(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

async function expandArchive(zipFile: string, destination: string): Promise<void> {
  fs.rmSync(destination, { recursive: true, force: true });
  fs.mkdirSync(destination, { recursive: true });
  await execFileAsync(
    "powershell.exe",
    [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-Command",
      `Expand-Archive -LiteralPath ${psQuote(zipFile)} -DestinationPath ${psQuote(destination)} -Force`
    ],
    {
      windowsHide: true,
      timeout: 60000
    }
  );
}

function findExe(directory: string): string | undefined {
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      const nested = findExe(fullPath);
      if (nested) {
        return nested;
      }
    }
    if (entry.isFile() && entry.name.toLowerCase() === "mediamtx.exe") {
      return fullPath;
    }
  }
  return undefined;
}

async function main(): Promise<void> {
  fs.mkdirSync(mediaMtxDir, { recursive: true });

  const release = await latestRelease();
  const pattern = platformAssetPattern();
  const asset = release.assets.find((item) => pattern.test(item.name));
  if (!asset) {
    throw new Error(`ไม่พบ MediaMTX asset สำหรับ Windows (${pattern}) ใน ${release.tag_name}`);
  }

  console.log(`Downloading MediaMTX ${release.tag_name}: ${asset.name}`);
  await download(asset.browser_download_url, zipPath);
  await expandArchive(zipPath, downloadDir);

  const exe = findExe(downloadDir);
  if (!exe) {
    throw new Error("แตกไฟล์แล้วไม่พบ mediamtx.exe");
  }

  fs.copyFileSync(exe, path.join(mediaMtxDir, "mediamtx.exe"));
  console.log(`MediaMTX ready: ${path.join(mediaMtxDir, "mediamtx.exe")}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
