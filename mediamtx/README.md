# MediaMTX runtime

วาง `mediamtx.exe` ไว้ในโฟลเดอร์นี้ หรือรันคำสั่งนี้จาก root project:

```powershell
npm run setup:mediamtx
```

ระบบจะใช้ไฟล์นี้เพื่อเปิด RTMP listener ที่พอร์ต `1935` และจะ bind Control API เฉพาะ `127.0.0.1` เท่านั้น
