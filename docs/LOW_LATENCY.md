# Low Latency Guide

เป้าหมายของ bridge นี้คือให้ภาพจาก DJI Fly เข้า MediaMTX แล้ว OBS อ่านต่อด้วย delay ต่ำที่สุดเท่าที่ network จริงยังนิ่ง ไม่ใช้วิธีบีบ buffer แบบเสี่ยงจนภาพกระตุก

## สิ่งที่แก้ในระบบแล้ว

MediaMTX config ที่ระบบสร้างจะเปิดเฉพาะส่วนที่จำเป็น:

```yaml
api: yes
apiAddress: 127.0.0.1:9997
rtmp: yes
rtmpAddress: :1935
rtsp: no
hls: no
webrtc: no
srt: no
moq: no
metrics: no
pprof: no
playback: no
```

เหตุผล:

- RTMP ingest จาก DJI Fly ยังเปิดที่ `:1935`
- Control API ยังอยู่เฉพาะ `127.0.0.1`
- ไม่เปิด protocol ที่ไม่ได้ใช้ เพื่อลด port/process surface และไม่ให้เกิดไฟล์ cert อัตโนมัติจาก protocol อื่น
- ไม่ลด `writeQueueSize` ต่ำเกินไป เพราะถ้า OBS อ่านสะดุด queue เล็กเกินจะทำให้ packet drop ง่ายขึ้น

## ค่า OBS ที่แนะนำ

ใช้ OBS บนเครื่องเดียวกับ bridge ให้ใช้ URL นี้ก่อน:

```text
rtmp://127.0.0.1:1935/live/drone1
```

ใน OBS:

1. Add Source → Media Source
2. ปิด `Local File`
3. วาง OBS RTMP URL
4. ถ้ามีช่อง `Network Buffering` ให้เริ่มที่ `0 MB` หรือค่าต่ำสุด
5. ถ้าภาพกระตุก ให้เพิ่มทีละน้อย เช่น `1 MB` แล้วทดสอบใหม่
6. เปิดตัวเลือก restart/reconnect ของ source ถ้ามี เพื่อให้กลับมารับภาพหลัง DJI Fly หยุดแล้วเริ่มใหม่

อย่าใส่ FFmpeg options แรง ๆ เป็นค่าเริ่มต้น เช่น `fflags=nobuffer` หรือ `analyzeduration=0` จนกว่าจะทดสอบหน้างาน เพราะลด buffer ได้จริงบางเคส แต่ทำให้ decode/เริ่ม stream เปราะขึ้นได้

## ค่า Network ที่มีผลกับ delay มากที่สุด

- ให้คอมต่อสาย LAN เข้า router ถ้าทำได้
- มือถือ DJI Fly ใช้ Wi-Fi 5 GHz ใกล้ router
- หลีกเลี่ยง guest Wi-Fi, client isolation, extender คุณภาพต่ำ, VPN และ Tailscale ในเส้นทางหลัก
- ถ้า stream หลุด ให้ลด bitrate/resolution ใน DJI Fly ก่อนเพิ่ม buffer ใน OBS
- อย่าเปิด download/upload หนักบนเครือข่ายเดียวกันระหว่างทดสอบ

## สิ่งที่ไม่ควรทำ

- ไม่ควรลด queue/buffer ทุกจุดพร้อมกัน
- ไม่ควรเปิดหลาย protocol ใน MediaMTX ถ้าใช้งานแค่ RTMP
- ไม่ควรอ่าน OBS ผ่าน LAN IP ถ้า OBS อยู่เครื่องเดียวกัน ใช้ `127.0.0.1` จะสั้นและนิ่งกว่า
- ไม่ควรสรุปว่า bridge ช้า จนกว่าจะวัดแยก DJI Fly → MediaMTX และ MediaMTX → OBS

## วิธีทดสอบ delay แบบง่าย

1. เปิด DJI Fly ให้เห็นนาฬิกาหรือ stopwatch จริงในภาพ
2. ส่ง RTMP เข้า bridge
3. เปิด OBS แล้วเทียบเวลาจริงกับภาพใน OBS
4. จด delay และสภาพ network
5. เปลี่ยนทีละอย่างเท่านั้น เช่น OBS buffer หรือ bitrate แล้ววัดใหม่

ถ้า delay ต่ำแต่ภาพกระตุก ให้เพิ่ม buffer เล็กน้อย ถ้า delay สูงแต่ภาพนิ่ง ให้ลด buffer/bitrate ทีละขั้น
