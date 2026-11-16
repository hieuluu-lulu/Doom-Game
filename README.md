# DoomZone

Game bắn súng góc nhìn thứ nhất chạy trên trình duyệt. Chỉ một file HTML, không cần cài đặt.

**Chơi ngay:** https://hieuluu-lulu.github.io/Doom-Game/

- **4 map:** cảng, sa mạc, phố Crossroads, trạm nước Waterworks
- **Chơi một mình:** cắt relay, đánh robot, boss và lính
- **Chơi nhiều người** (PeerJS): co-op, đấu đội Blue vs Red tính theo ván, free-for-all
- **Súng và đồ:** súng trường, súng lục, shotgun, súng tỉa, phụ kiện, giáp, balo; lái xe, mech, trực thăng, máy bay

## Điều khiển

WASD đi · chuột ngắm/bắn · chuột phải ngắm · R nạp đạn · 1/2/3 đổi súng · Q/E nghiêng · F tương tác · B đổi ống ngắm · M bản đồ

## Build

```bash
cd tools && npm install && cd ..   # một lần
python3 -I build.py                # → dist/index.html
```

Ghi chú kỹ thuật: [docs/NOTES.md](docs/NOTES.md) · Model 3D: [CREDITS.md](CREDITS.md)
