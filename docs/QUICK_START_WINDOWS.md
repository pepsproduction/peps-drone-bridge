# Quick Start Windows

ใช้สำหรับเครื่อง Windows เครื่องอื่นที่ต้องการเปิด PEPS LIVE Drone RTMP Bridge ให้เร็วที่สุด

## วิธีใช้งานแบบไม่กี่คลิก

1. ดาวน์โหลดโปรเจกต์จาก GitHub ด้วยปุ่ม `Code` → `Download ZIP`
2. แตกไฟล์ ZIP
3. ดับเบิลคลิก `PEPS-LIVE-START.cmd`

ถ้าเครื่องยังไม่มี Node.js หรือเวอร์ชันต่ำกว่า `22.12` ระบบจะเปิดหน้า download ให้เอง ติดตั้ง Node.js แล้วกลับมาดับเบิลคลิก `PEPS-LIVE-START.cmd` อีกครั้ง

หลังจากนั้นระบบจะทำให้อัตโนมัติ:

```text
npm install
ดาวน์โหลด MediaMTX
build ระบบ
เปิด local server
เปิด browser ไปที่ http://127.0.0.1:19555
```

ถ้า build ไม่ผ่าน ระบบจะเปิดไฟล์ log นี้ให้ทันที:

```text
logs/windows-launcher-setup.log
```

ส่งไฟล์นี้ให้ผู้ดูแลเพื่อดูสาเหตุจริง เช่น Node.js เก่า, npm download ไม่สำเร็จ, antivirus block หรือ network download ล้มเหลว

ถ้าไม่ต้องการเห็นหน้าต่าง command ให้ใช้:

```text
PEPS-LIVE-START-SILENT.vbs
```

## เปิด Firewall

ถ้า DJI Fly ส่ง RTMP เข้าเครื่องไม่ได้ ให้ลองกดปุ่ม `เปิด Firewall` ในหน้าเว็บก่อน

ถ้ายังไม่สำเร็จ ให้ดับเบิลคลิก:

```text
PEPS-LIVE-FIREWALL-ADMIN.cmd
```

Windows จะถามสิทธิ์ Administrator ให้กด `Yes`

## ปิดระบบ

ดับเบิลคลิก:

```text
PEPS-LIVE-STOP.cmd
```

หรือแบบเงียบ:

```text
PEPS-LIVE-STOP-SILENT.vbs
```

## URL ที่ใช้

DJI Fly ใช้ URL ที่หน้าเว็บแสดง เช่น:

```text
rtmp://192.168.1.40:1935/live/drone1
```

OBS บนเครื่องเดียวกันใช้:

```text
rtmp://127.0.0.1:1935/live/drone1
```
