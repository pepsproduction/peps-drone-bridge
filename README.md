# PEPS LIVE — Drone RTMP Bridge (Local Test Build)

ระบบ local web app สำหรับรับภาพโดรนผ่าน RTMP จาก DJI Fly บน LAN เดียวกัน แล้วให้ OBS อ่าน stream จากเครื่อง Windows เครื่องเดียวกันหรือเครื่องในวงเดียวกันได้

> รอบนี้เป็น Local Test Build เท่านั้น: ไม่มีการ deploy GitHub, GitHub Pages หรือ Cloud Server

## เริ่มใช้งานเร็วบน Windows

1. กด `Code` → `Download ZIP` จากหน้า GitHub
2. แตกไฟล์ ZIP
3. ดับเบิลคลิก `PEPS-LIVE-START.cmd`

ระบบจะติดตั้ง dependency, ดาวน์โหลด MediaMTX, build, เปิด local server และเปิด browser ให้เอง

ถ้าเครื่องยังไม่มี Node.js หรือเวอร์ชันต่ำกว่า `22.12` ระบบจะเปิดหน้า download ให้ก่อน ให้ติดตั้ง Node.js แล้วกด `PEPS-LIVE-START.cmd` อีกครั้ง

ไฟล์กดใช้งาน:

```text
PEPS-LIVE-START.cmd          เปิดระบบแบบเห็นหน้าต่าง command
PEPS-LIVE-START-SILENT.vbs   เปิดระบบแบบเงียบ
PEPS-LIVE-STOP.cmd           ปิดระบบ
PEPS-LIVE-FIREWALL-ADMIN.cmd เปิด Firewall TCP 1935 แบบ Administrator
```

คู่มือสั้นสำหรับเครื่องใหม่:

```text
docs/QUICK_START_WINDOWS.md
```

## สิ่งที่ต้องติดตั้ง

- Windows 10 หรือ Windows 11
- Node.js 22.12 ขึ้นไป
- MediaMTX runtime (`mediamtx.exe`)
- OBS สำหรับรับภาพ RTMP
- ffmpeg เฉพาะกรณีต้องการรัน bridge test ด้วย test pattern

## วิธีติดตั้ง MediaMTX

จาก root project รัน:

```powershell
npm install
npm run setup:mediamtx
```

สคริปต์จะดาวน์โหลด MediaMTX release ล่าสุดสำหรับ Windows และวางไฟล์ไว้ที่:

```text
mediamtx/mediamtx.exe
```

หากต้องการติดตั้งเอง ให้วาง `mediamtx.exe` ในโฟลเดอร์ `mediamtx/` ได้โดยตรง

## วิธีรันระบบ

แบบดับเบิลคลิกบน Windows:

```text
PEPS-LIVE-START.cmd
```

ถ้าต้องการกดแล้วไม่เห็นหน้าต่าง command ให้ใช้:

```text
PEPS-LIVE-START-SILENT.vbs
```

ไฟล์นี้จะติดตั้ง dependency ที่ขาด, setup MediaMTX, build ถ้าจำเป็น, เปิด server เบื้องหลัง และเปิด browser ให้เอง

เมื่อต้องการปิด server ที่รันเบื้องหลัง:

```text
PEPS-LIVE-STOP.cmd
```

ถ้าปุ่ม `เปิด Firewall` ในเว็บไม่สำเร็จ ให้ปิด browser ไม่จำเป็น แล้วดับเบิลคลิกไฟล์นี้:

```text
PEPS-LIVE-FIREWALL-ADMIN.cmd
```

Windows จะถามสิทธิ์ Administrator เพื่อเปิด Inbound Rule สำหรับ TCP Port `1935`

โหมดพัฒนา:

```powershell
npm run dev
```

หลัง build แล้วเปิด local app ที่พอร์ตหลัก:

```powershell
npm run build
npm run start
```

เปิดเว็บ:

```text
http://127.0.0.1:19555
```

Backend bind เฉพาะ `127.0.0.1:19555` ส่วน MediaMTX Control API bind เฉพาะ `127.0.0.1:9997` เท่านั้น ไม่เปิดออก LAN

## วิธีเปิด DJI Fly

1. ให้มือถือที่เปิด DJI Fly และคอมอยู่ Wi-Fi วงเดียวกัน
2. เปิด Drone RTMP Bridge แล้วกด `เปิด Server`
3. ตรวจว่า UI แสดง `พร้อมรับสัญญาณภาพโดรน`
4. คัดลอก `DJI Fly RTMP URL`
5. ใน DJI Fly ไปที่ `Transmission` → `Live Streaming Platforms` → `RTMP`
6. วาง URL แล้วกด Start
7. เมื่อ MediaMTX พบ publisher จริง UI จะเปลี่ยนเป็น `รับสัญญาณภาพโดรนแล้ว`

## RTMP URL ที่ระบบสร้าง

สำหรับ DJI Fly ระบบใช้ IPv4 LAN ที่ตรวจเจอหรือที่ผู้ใช้เลือกเอง:

```text
rtmp://<LAN-IP>:1935/live/drone1
```

ตัวอย่าง:

```text
rtmp://192.168.1.100:1935/live/drone1
```

สำหรับ OBS บนเครื่องเดียวกัน:

```text
rtmp://127.0.0.1:1935/live/drone1
```

## วิธีต่อ OBS

1. เปิด OBS
2. เพิ่ม source ที่อ่าน network stream ได้ เช่น Media Source หรือ VLC Source
3. ใช้ URL:

```text
rtmp://127.0.0.1:1935/live/drone1
```

4. เริ่ม stream จาก DJI Fly

## วิธีแก้ Firewall

ถ้า DJI Fly ส่ง stream ไม่เข้า ให้ตรวจ Windows Firewall ว่าอนุญาต inbound TCP port `1935` หรือไม่

ใน UI มีปุ่ม `เปิด Firewall` แต่ระบบจะไม่แก้ Firewall แบบเงียบ ๆ ต้องมีหน้าต่างยืนยันก่อนรันคำสั่ง และ Windows อาจขอสิทธิ์ Administrator

คำสั่งที่ใช้แนวเดียวกัน:

```powershell
netsh advfirewall firewall add rule name="PEPS LIVE Drone RTMP Bridge 1935" dir=in action=allow protocol=TCP localport=1935
```

## วิธีแก้กรณี RTMP URL ใช้ไม่ได้

- ตรวจว่ามือถือและคอมอยู่ Wi-Fi วงเดียวกัน
- ตรวจว่าเลือก adapter ถูกตัว ไม่ใช่ VPN, Tailscale, VirtualBox, VMware หรือ Hyper-V
- กด `ตรวจสอบ Network`
- ตรวจว่า `mediamtx.exe` ทำงานอยู่
- ตรวจว่า port `1935` ไม่ถูกโปรแกรมอื่นใช้
- ถ้า OBS อ่านไม่ได้ ให้ลอง URL `rtmp://127.0.0.1:1935/live/drone1` บนเครื่องเดียวกันก่อน

## ข้อจำกัดของระบบ

- ระบบตรวจได้เฉพาะ RTMP stream ที่เข้ามา ไม่ตรวจแบตเตอรี่, GPS, ระยะบิน หรือสถานะความปลอดภัยของโดรน
- UI จะไม่รายงานว่า `รับสัญญาณภาพโดรนแล้ว` จนกว่า MediaMTX จะพบ publisher ที่ `live/drone1` จริง
- ข้อมูล FPS, bitrate, codec และ resolution จะแสดงเฉพาะเมื่อ MediaMTX API ส่งข้อมูลมาเท่านั้น
- Local web app ยังไม่ใช่ Electron/Tauri และยังไม่แพ็กเป็น `.exe`

## คำสั่งทดสอบ

```powershell
npm run lint
npm run typecheck
npm run test
npm run build
npm run test:bridge
```

`test:bridge` จะรายงาน `SKIPPED: ffmpeg not found` ถ้าเครื่องไม่มี ffmpeg และจะไม่ถือว่า RTMP source test สำเร็จหากไม่มี source จริง

## Low latency / ลดดีเลย์

อ่านแนวทางลด delay แบบไม่ทำให้ stream เปราะได้ที่:

```text
docs/LOW_LATENCY.md
```

สรุปสั้น: ระบบเปิดเฉพาะ RTMP + local Control API, OBS บนเครื่องเดียวกันควรอ่านผ่าน `rtmp://127.0.0.1:1935/live/drone1`, เริ่ม Network Buffering ต่ำสุดก่อน และถ้าภาพกระตุกให้เพิ่ม buffer ทีละน้อยแทนการบีบทุกอย่างพร้อมกัน
