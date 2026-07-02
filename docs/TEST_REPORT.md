# Test Report

วันที่ทดสอบ: 2026-07-02

## Environment

- OS target: Windows local machine
- Node.js: installed and used through npm
- MediaMTX: downloaded by `npm run setup:mediamtx`
- MediaMTX release used by setup: `v1.19.2`
- ffmpeg: found, used for RTMP test pattern

## Commands

```text
npm run lint
npm run typecheck
npm run test
npm run build
npm run test:bridge
```

## Results

```text
PASS npm run lint
PASS npm run typecheck
PASS npm run test
PASS npm run build
PASS npm run test:bridge
```

## Bridge Test Details

```text
PASS detects error when port 1935 is already in use
PASS started MediaMTX
PASS API health check passes
PASS port 1935 is open
PASS state reaches WAITING_FOR_STREAM
PASS state changes to RECEIVING_STREAM
PASS state changes to STREAM_LOST or WAITING_FOR_STREAM after test stream stops
```

## Low Latency Config Check

```text
PASS generated MediaMTX config enables only RTMP + loopback Control API
PASS generated MediaMTX config disables RTSP/HLS/WebRTC/SRT/MoQ
PASS no auto.crt / auto.key files are generated after MediaMTX starts
```

## Not Tested

- ยังไม่ได้ทดสอบกับ DJI Mavic Air 2 จริง
- ยังไม่ได้ทดสอบ OBS ด้วยภาพจาก DJI Fly จริง
- ยังไม่ได้ทดสอบกรณี router เปิด client isolation

## Notes

- RTMP source test ใช้ ffmpeg test pattern ไม่ใช่โดรนจริง
- ระบบยังไม่ถูกแพ็กเป็น `.exe`
- ไม่มีการ deploy ไป GitHub, GitHub Pages หรือ cloud server
