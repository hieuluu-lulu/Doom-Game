# DoomZone

Game bắn súng góc nhìn thứ nhất chạy trên trình duyệt, không cần cài đặt.

**Chơi ngay:** https://hieuluu-lulu.github.io/Doom-Game/

- **4 map:** cảng, sa mạc (rộng 3 km: 11 cứ điểm để chiếm, 2 thị trấn, trang trại, hơn 60 ngôi nhà vào được, 22 núi), phố Crossroads, trạm nước Waterworks
- **Chơi một mình:** nhiệm vụ cắt relay, hoặc **Sinh tồn** (robot đến theo đợt, lưu kỷ lục); 3 độ khó Easy / Normal / Hard
- **Thống kê và 14 thành tích**, lưu ngay trên máy; đổi phím trong Settings
- **Chơi offline và cài như app** (Settings → Offline play): map đã chơi mở được khi mất mạng
- **Chơi nhiều người** (PeerJS): co-op, Sinh tồn chơi chung, đấu đội Blue vs Red tính theo ván, free-for-all
- **Súng và đồ:** súng trường, súng lục, shotgun, súng tỉa, phụ kiện, giáp, balo; lái xe (nhìn từ ghế lái hoặc từ sau xe, phím C), mech, trực thăng, máy bay

## Điều khiển

WASD đi · chuột ngắm/bắn · chuột phải ngắm · R nạp đạn · 1/2/3 đổi súng · Q/E nghiêng · F tương tác · B đổi ống ngắm · M bản đồ (đổi được trong Settings → Controls)

## Build

```bash
cd tools && npm install && cd ..   # một lần
python3 -I build.py                # → dist/: index.html, assets/, sw.js, manifest (chạy qua web server)
python3 -I build.py --single       # → một file dist/index.html, mở thẳng, chơi offline
```

Ghi chú kỹ thuật: [docs/NOTES.md](docs/NOTES.md) · Model 3D: [CREDITS.md](CREDITS.md)
