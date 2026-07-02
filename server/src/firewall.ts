import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { CONFIG_DIR, ensureRuntimeDirs } from "./paths.js";
import { FIREWALL_RULE_NAME, RTMP_PORT } from "./types.js";

const execFileAsync = promisify(execFile);

interface ExecFileError extends Error {
  code?: number | string;
  stdout?: string;
  stderr?: string;
}

function psQuote(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function firewallRuleScript(): string {
  return [
    "$ErrorActionPreference = 'Stop'",
    `$ruleName = ${psQuote(FIREWALL_RULE_NAME)}`,
    `$port = ${RTMP_PORT}`,
    "if (-not (Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue)) {",
    "  New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -Action Allow -Protocol TCP -LocalPort $port -Profile Any | Out-Null",
    "}",
    "exit 0",
    ""
  ].join("\n");
}

function formatExecError(error: unknown): string {
  if (!(error instanceof Error)) {
    return "ไม่สามารถเปิด Firewall rule ได้";
  }

  const execError = error as ExecFileError;
  const output = [execError.stderr, execError.stdout]
    .filter((value): value is string => Boolean(value?.trim()))
    .join("\n")
    .trim();

  return output || error.message;
}

async function isAdministrator(): Promise<boolean> {
  const { stdout } = await execFileAsync(
    "powershell.exe",
    [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-Command",
      [
        "$identity = [Security.Principal.WindowsIdentity]::GetCurrent()",
        "$principal = [Security.Principal.WindowsPrincipal]::new($identity)",
        "$principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)"
      ].join("; ")
    ],
    {
      windowsHide: true,
      timeout: 7000
    }
  );

  return stdout.trim().toLowerCase() === "true";
}

async function openFirewallRuleDirect(): Promise<void> {
  await execFileAsync(
    "netsh.exe",
    [
      "advfirewall",
      "firewall",
      "add",
      "rule",
      `name="${FIREWALL_RULE_NAME}"`,
      "dir=in",
      "action=allow",
      "protocol=TCP",
      `localport=${RTMP_PORT}`
    ],
    {
      windowsHide: true,
      timeout: 10000
    }
  );
}

async function openFirewallRuleElevated(): Promise<void> {
  ensureRuntimeDirs();
  const scriptPath = path.join(CONFIG_DIR, "open-firewall-rule-admin.ps1");
  fs.writeFileSync(scriptPath, firewallRuleScript(), "utf8");

  const argumentList = `-NoProfile -ExecutionPolicy Bypass -File "${scriptPath}"`;
  const command = [
    `$process = Start-Process -FilePath "powershell.exe" -ArgumentList ${psQuote(argumentList)} -Verb RunAs -Wait -PassThru`,
    "exit $process.ExitCode"
  ].join("; ");

  await execFileAsync(
    "powershell.exe",
    [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-Command",
      command
    ],
    {
      windowsHide: false,
      timeout: 120000
    }
  );
}

export async function checkFirewallRule(): Promise<"present" | "missing" | "unknown"> {
  if (process.platform !== "win32") {
    return "unknown";
  }

  try {
    const command = [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-Command",
      `if (Get-NetFirewallRule -DisplayName '${FIREWALL_RULE_NAME}' -ErrorAction SilentlyContinue) { 'present' } else { 'missing' }`
    ];
    const { stdout } = await execFileAsync("powershell.exe", command, {
      windowsHide: true,
      timeout: 7000
    });
    return stdout.includes("present") ? "present" : "missing";
  } catch {
    return "unknown";
  }
}

export async function openFirewallRule(confirm: boolean): Promise<{ ok: boolean; message: string }> {
  if (!confirm) {
    return {
      ok: false,
      message: "ต้องยืนยันก่อนเปิด Inbound Rule สำหรับ TCP Port 1935"
    };
  }

  if (process.platform !== "win32") {
    return {
      ok: false,
      message: "คำสั่งเปิด Firewall รองรับเฉพาะ Windows"
    };
  }

  try {
    const existingRule = await checkFirewallRule();
    if (existingRule === "present") {
      return {
        ok: true,
        message: "พบ Inbound Rule สำหรับ TCP Port 1935 อยู่แล้ว"
      };
    }

    if (await isAdministrator()) {
      await openFirewallRuleDirect();
    } else {
      await openFirewallRuleElevated();
    }

    const finalRule = await checkFirewallRule();
    if (finalRule !== "present") {
      return {
        ok: false,
        message: "Windows ยังไม่พบ Firewall rule หลังรันคำสั่ง อาจต้องกด Yes ในหน้าต่าง Administrator หรือเปิดด้วยคำสั่งแบบ Run as administrator"
      };
    }

    return {
      ok: true,
      message: "เปิด Inbound Rule สำหรับ TCP Port 1935 แล้ว"
    };
  } catch (error) {
    const details = formatExecError(error);
    return {
      ok: false,
      message: `เปิด Firewall rule ไม่สำเร็จ: ${details}`
    };
  }
}
