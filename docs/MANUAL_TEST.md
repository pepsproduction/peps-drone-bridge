# Manual Test Checklist

## DJI Fly + Mavic Air 2

```text
[ ] คอมและมือถืออยู่ Wi-Fi เดียวกัน
[ ] เปิด Drone RTMP Bridge
[ ] Server state เป็น READY หรือ WAITING_FOR_STREAM
[ ] คัดลอก RTMP URL
[ ] วาง URL ใน DJI Fly
[ ] กด Start Livestream
[ ] UI เปลี่ยนเป็น RECEIVING_STREAM
[ ] OBS รับภาพจาก RTMP URL ได้
[ ] หยุด Live จาก DJI Fly
[ ] UI แจ้ง STREAM_LOST หรือ WAITING_FOR_STREAM ถูกต้อง
```

## OBS

```text
[ ] เปิด OBS บนเครื่องเดียวกัน
[ ] เพิ่ม Media Source หรือ VLC Source
[ ] ใช้ rtmp://127.0.0.1:1935/live/drone1
[ ] เริ่ม stream จาก DJI Fly
[ ] ภาพแสดงใน OBS
```

## Network

```text
[ ] เลือก adapter เป็น Wi-Fi/LAN จริง
[ ] ไม่ได้เลือก VPN/Tailscale/VirtualBox/VMware/Hyper-V
[ ] กดตรวจสอบ Network แล้วไม่มี fail สำคัญ
[ ] Firewall อนุญาต inbound TCP 1935
```
