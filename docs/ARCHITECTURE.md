# Architecture

## Runtime Flow

```text
DJI Mavic Air 2
→ DJI Fly RTMP publisher
→ rtmp://<LAN-IP>:1935/live/drone1
→ MediaMTX child process
→ Backend reads MediaMTX Control API on 127.0.0.1
→ Frontend receives status through Server-Sent Events
→ OBS reads rtmp://127.0.0.1:1935/live/drone1
```

## Components

- `frontend/`: Vite + React + TypeScript dashboard
- `server/`: Node.js + TypeScript + Express local API
- `mediamtx/`: expected location for `mediamtx.exe`
- `config/`: generated `mediamtx.yml` and adapter settings
- `logs/`: generated MediaMTX and bridge logs

## Ports

- Web UI/API: `127.0.0.1:19555`
- MediaMTX Control API: `127.0.0.1:9997`
- RTMP listener: `0.0.0.0:1935`

RTMP must listen on LAN-facing interfaces so DJI Fly can publish into the bridge. Control API stays on loopback only.

The generated MediaMTX config disables unused protocols (`RTSP`, `HLS`, `WebRTC`, `SRT`, `MoQ`, metrics, pprof, playback) so the local bridge only exposes what this workflow needs: RTMP ingest/read plus the loopback Control API.

## State Machine

```text
OFF
STARTING
READY
WAITING_FOR_STREAM
RECEIVING_STREAM
STREAM_LOST
ERROR
```

- `OFF`: MediaMTX is not running
- `STARTING`: child process has started but RTMP/API readiness is not complete
- `READY`: RTMP port is open while API readiness is still being confirmed
- `WAITING_FOR_STREAM`: server is ready but no publisher exists at `live/drone1`
- `RECEIVING_STREAM`: MediaMTX reports a publisher at `live/drone1`
- `STREAM_LOST`: a publisher existed before and is no longer present
- `ERROR`: process, port, config, API, or runtime failure

## Adapter Selection

The backend reads IPv4 addresses from active network interfaces and excludes these from the default recommendation:

- Loopback
- VirtualBox
- VMware
- Tailscale
- ZeroTier
- Hyper-V / vEthernet
- APIPA `169.254.x.x`

Advanced Settings still allows the user to select non-recommended adapters manually.
