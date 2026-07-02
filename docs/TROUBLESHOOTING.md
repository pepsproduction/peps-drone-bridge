# Troubleshooting

## Port 1935 already in use

อาการ: กดเปิด Server แล้วขึ้นว่าพอร์ต `1935` ถูกใช้งาน

วิธีตรวจ:

```powershell
netstat -ano -p tcp | findstr :1935
```

ปิดโปรแกรมที่จับพอร์ตอยู่ หรือเปลี่ยน config ในรอบพัฒนาถัดไป

## Firewall blocked

อาการ: Server พร้อมแล้ว แต่ DJI Fly ส่ง stream ไม่เข้า

แนวทาง:

- กด `ตรวจสอบ Network`
- เปิด Inbound Rule สำหรับ TCP `1935`
- ยืนยันก่อนใช้ปุ่ม `เปิด Firewall`
- ถ้าขึ้น `Command failed` หรือ Windows ไม่แสดง UAC ให้ดับเบิลคลิก `PEPS-LIVE-FIREWALL-ADMIN.cmd`

## No usable LAN IP

อาการ: UI แสดงว่า `หา IPv4 LAN ไม่พบ`

แนวทาง:

- ตรวจว่า Wi-Fi/LAN ต่ออยู่จริง
- ปิด VPN ชั่วคราวถ้าทำให้เลือก adapter ผิด
- เปิด Advanced Settings แล้วเลือก adapter เอง

## DJI Fly stream does not start

แนวทาง:

- ใช้ URL รูปแบบ `rtmp://<LAN-IP>:1935/live/drone1`
- ตรวจว่ามือถือและคอมอยู่ Wi-Fi วงเดียวกัน
- ตรวจว่า router ไม่เปิด client isolation
- ตรวจ Firewall inbound TCP `1935`

## Server ready but no incoming stream

อาการ: UI อยู่ที่ `พร้อมรับสัญญาณภาพโดรน`

ความหมาย: MediaMTX พร้อมรับแล้ว แต่ยังไม่พบ publisher ที่ `live/drone1`

แนวทาง:

- ตรวจ URL ใน DJI Fly ว่าตรงกับ UI
- เลือก adapter LAN/Wi-Fi จริง
- ดู logs ใน `logs/`

## OBS cannot read RTMP

แนวทาง:

- ใช้ URL บนเครื่องเดียวกันก่อน: `rtmp://127.0.0.1:1935/live/drone1`
- รอให้ UI ขึ้น `รับสัญญาณภาพโดรนแล้ว`
- ตรวจว่า source ใน OBS อ่าน network stream ได้

## MediaMTX process exits unexpectedly

แนวทาง:

- เปิด `logs/` แล้วดูไฟล์ `*-mediamtx.log`
- ตรวจว่า `config/mediamtx.yml` ถูกสร้าง
- ตรวจว่า binary เป็น Windows build ที่ถูก architecture
- รัน `npm run setup:mediamtx` ใหม่ถ้าไฟล์เสีย
