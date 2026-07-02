import { API_PORT, STREAM_PATH, type MediaMtxPathSnapshot, type StreamInfo } from "./types.js";

const API_BASE_URL = `http://127.0.0.1:${API_PORT}`;

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord | undefined {
  return value && typeof value === "object" ? value as UnknownRecord : undefined;
}

function asArray(value: unknown): UnknownRecord[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is UnknownRecord => Boolean(asRecord(item)));
  }
  return [];
}

function listItems(payload: unknown): UnknownRecord[] {
  const record = asRecord(payload);
  if (!record) {
    return [];
  }

  return asArray(record.items)
    .concat(asArray(record.data))
    .concat(asArray(asRecord(record.data)?.items));
}

function stringValue(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return undefined;
}

function firstString(record: UnknownRecord | undefined, keys: string[]): string | undefined {
  if (!record) {
    return undefined;
  }
  for (const key of keys) {
    const value = stringValue(record[key]);
    if (value) {
      return value;
    }
  }
  return undefined;
}

function remoteIp(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  if (value.startsWith("[")) {
    return value.slice(1, value.indexOf("]"));
  }
  return value.split(":")[0];
}

function formatDurationSince(value: string | undefined, now = Date.now()): string | undefined {
  if (!value) {
    return undefined;
  }

  const started = Date.parse(value);
  if (!Number.isFinite(started)) {
    return undefined;
  }

  const totalSeconds = Math.max(0, Math.floor((now - started) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, "0")).join(":");
}

function readTracks(pathItem: UnknownRecord | undefined): string | undefined {
  if (!pathItem) {
    return undefined;
  }

  const tracks = asArray(pathItem.tracks);
  if (tracks.length > 0) {
    const values = tracks
      .map((track) => firstString(track, ["codec", "type", "format", "name"]))
      .filter((value): value is string => Boolean(value));
    return values.length > 0 ? values.join(", ") : undefined;
  }

  const directTracks = Array.isArray(pathItem.tracks)
    ? pathItem.tracks.map((track) => stringValue(track)).filter((value): value is string => Boolean(value))
    : [];
  return directTracks.length > 0 ? directTracks.join(", ") : undefined;
}

function hasPublisher(pathItem: UnknownRecord | undefined, rtmpConn: UnknownRecord | undefined): boolean {
  if (!pathItem && !rtmpConn) {
    return false;
  }

  if (rtmpConn) {
    const state = firstString(rtmpConn, ["state"]);
    if (!state || /publish|readpublish|write/i.test(state)) {
      return true;
    }
  }

  if (pathItem?.ready === true) {
    return true;
  }

  const source = asRecord(pathItem?.source);
  const sourceType = firstString(source, ["type"]);
  const sourceId = firstString(source, ["id"]);
  return Boolean(sourceType || sourceId);
}

function pathName(item: UnknownRecord): string | undefined {
  return firstString(item, ["name", "path", "confName"]);
}

function connectionPath(item: UnknownRecord): string | undefined {
  return firstString(item, ["path", "pathName", "name"]);
}

function normalizeStreamInfo(pathItem: UnknownRecord | undefined, rtmpConn: UnknownRecord | undefined): StreamInfo {
  const source = asRecord(pathItem?.source);
  const startedAt = firstString(pathItem, ["readyTime", "created", "createdAt"])
    ?? firstString(rtmpConn, ["created", "createdAt"]);

  return {
    path: STREAM_PATH,
    protocol: firstString(rtmpConn, ["type", "protocol"]) ?? firstString(source, ["type"]) ?? "RTMP",
    sourceIp: remoteIp(firstString(rtmpConn, ["remoteAddr", "remoteAddress", "clientAddr"])),
    codec: readTracks(pathItem),
    resolution: firstString(pathItem, ["resolution", "videoResolution"]),
    fps: firstString(pathItem, ["fps", "videoFps"]),
    bitrate: firstString(pathItem, ["bitrate", "bitrateKbps", "bytesRate"]),
    connectionDuration: formatDurationSince(startedAt),
    lastUpdate: new Date().toISOString()
  };
}

async function apiJson(endpoint: string, timeoutMs = 1500): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      signal: controller.signal
    });
    if (!response.ok) {
      throw new Error(`MediaMTX API ${endpoint} returned ${response.status}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

export async function readMediaMtxSnapshot(): Promise<MediaMtxPathSnapshot> {
  const pathsPayload = await apiJson("/v3/paths/list");
  const pathItems = listItems(pathsPayload);
  const pathItem = pathItems.find((item) => pathName(item) === STREAM_PATH);

  let rtmpItems: UnknownRecord[] = [];
  try {
    rtmpItems = listItems(await apiJson("/v3/rtmpconns/list"));
  } catch {
    try {
      rtmpItems = listItems(await apiJson("/v3/rtmpsessions/list"));
    } catch {
      rtmpItems = [];
    }
  }

  const rtmpConn = rtmpItems.find((item) => connectionPath(item) === STREAM_PATH)
    ?? rtmpItems.find((item) => /publish|readpublish|write/i.test(firstString(item, ["state"]) ?? ""));

  const publisherFound = hasPublisher(pathItem, rtmpConn);

  return {
    apiOk: true,
    hasPublisher: publisherFound,
    stream: publisherFound ? normalizeStreamInfo(pathItem, rtmpConn) : undefined
  };
}

export async function mediaMtxApiHealthy(): Promise<boolean> {
  try {
    await apiJson("/v3/paths/list");
    return true;
  } catch {
    return false;
  }
}
