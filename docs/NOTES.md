# DoomZone — ghi chú kỹ thuật

Ghi chú chi tiết từng phần (map, súng, robot, chơi mạng, công cụ xử lý model). Phần giới thiệu ngắn: [README](../README.md).

Mã nguồn đầy đủ của game **DoomZone**: game gốc (đã mở ra dạng dễ đọc) cùng mọi phần mod. Build ra **một file HTML duy nhất** (`dist/index.html`, chỉ nằm trong thư mục này; đặt tên index.html để host tĩnh như Vercel mở ngay ở địa chỉ gốc; thêm `--copy` nếu muốn chép ra `../doomzone.html`), mở bằng trình duyệt là chơi, chạy offline được (chỉ chơi mạng mới cần internet).

```bash
cd tools && npm install && cd ..       # một lần: esbuild (nén code) + công cụ xử lý model
python3 -I build.py                     # bản phát hành: code được nén → dist/index.html
python3 -I build.py --debug             # code để nguyên, dễ dò lỗi trong DevTools
python3 -I build.py --features arsenal --out /tmp/t.html   # build thử riêng một phần
```

## Cấu trúc

| Thư mục / file | Nội dung |
|---|---|
| `game/shell.html` | Khung trang; `/*@@CSS@@*/` và `//@@JS@@` là chỗ build chèn CSS và code. |
| `game/style.css` | CSS của game gốc. |
| `game/favicon/` | Biểu tượng tab và màn hình chính (`doomzone-32/64/180.png`: chữ DOOM cam trên ZONE trắng, font logo Big Shoulders Display, nền tối). Build nhúng thẳng vào `<head>` chỗ `<!--@@ICON@@-->` trong `game/shell.html`. Vẽ lại bằng `node tools/favicon.cjs game/favicon`. |
| `game/js/00_three.js` | Engine three.js r180 (như game gốc đóng gói). |
| `game/js/10_game.js` | Code game gốc: level, người chơi, súng, robot, nhiệm vụ, HUD, menu, âm thanh. Các bản vá cũ và tên "DoomZone" đã được sửa thẳng vào đây. |
| `game/js/90_boot.js` | Hàm khởi động `QC()`. |
| `<feature>/` | Từng phần mod (map, súng, xe, máy bay, chơi mạng…), xem bảng dưới. |
| `models/` | Model gốc tải về (nguồn, không đưa vào build). |
| `tools/` | Script xử lý model (gltf-transform: nén, đổi màu, tách phần) và esbuild. |
| `dist/` | Kết quả build. |
| `CREDITS.md` | Tác giả các model (giấy phép CC-BY). |

- **Ba file trong `game/js/` là ba đoạn của cùng một script.** Build nối chúng theo thứ tự tên file, code mod chèn giữa `10_game.js` và `90_boot.js`. Vì vậy mod dùng chung scope với game: three.js là `lt`, cùng các hàm dựng hình của game.
- **Tên biến trong code game gốc vẫn ngắn** (`lt`, `Ee`, `QC`…) vì tên thật đã mất khi game gốc được nén. Code đã được định dạng lại (xuống dòng, thụt lề) để đọc và sửa thẳng được.
- **Cài đặt đã lưu:** khoá lưu cũ (trước khi đổi tên game) được tự chép sang khoá `doomzone.*` lần đầu mở bản mới (`common/common.js`), nên không mất cài đặt đồ hoạ, map đã chọn và tên người chơi.

- **Dung lượng:** bản phát hành khoảng 18,5 MB (trước khi nén model là 26 MB). Gần như toàn bộ là model và texture nhúng; code chỉ khoảng 2 MB.
  - Model được nén hình khối và chuyển động bằng meshopt (`EXT_meshopt_compression`). Game giải nén bằng `common/lib/05_meshopt_decoder.js`, bộ đọc `SX_GLTFLoader` dùng sẵn.
  - Texture dùng WebP.
  - Khi thêm model mới: tối ưu như các model khác (script trong `tools/`), rồi chạy `node tools/compress_assets.mjs <feature>/assets/<file>.glb`.
    - Script tự bỏ qua model chưa lượng tử hoá, vì nén sẽ dời tỉ lệ toạ độ vào node và làm hỏng code đọc thẳng hình khối (như shotgun KR-12). Thêm `--force` nếu code của model đó dùng toạ độ của node.

Mỗi thư mục feature có thể chứa:

| File | Vai trò |
|---|---|
| `<feature>.js` | Code của feature, chèn vào script của game (giữa `10_game.js` và `90_boot.js`). |
| `<feature>.css` | Nối sau CSS của game. |
| `lib/*.js` | Code lấy từ bên ngoài, chèn (theo thứ tự tên file) ngay trước `<feature>.js`. |
| `assets/*` | File nhị phân, nhúng thành chuỗi base64 `var SX_ASSET_<tên file> = "…"`, nên file game chạy được offline. |

Thứ tự build nằm ở `FEATURES` trong `build.py`. `common/` luôn build đầu tiên (kể cả khi dùng `--features`): GLTFLoader của three.js r180 (`common/lib/10_gltfloader.js`, đã sửa để dùng three.js có sẵn trong game), các hàm đọc model/ảnh nhúng `SX_parseGLB`, `SX_image`, `SX_timeout`, và bước chuyển cài đặt cũ.

## Chơi nhiều người (`net/`)

Số người một phòng tuỳ map và do host chọn. Ở màn hình chính bấm **Multiplayer** (nút ghi "Up to N" theo map đang chọn).

- **Không có nhiệm vụ cắt relay khi chơi nhiều người** (chơi một mình vẫn y như cũ):
  - Relay vẫn đứng trên map làm cảnh, nhưng đứng cạnh giữ F không hiện "Cut relay" và không cắt được. Thuyền / xe EVAC không kết thúc trận. Bộ đàm mở màn nói về relay cũng bỏ.
  - Giữ nguyên khung OBJECTIVE trên HUD, chỉ đổi nội dung theo chế độ phòng: "Squad up — fight the machines together" (co-op), "Blue team — first team to 20 kills" / "Red team — …" (Blue vs Red), "Free-for-all — first to 15 kills". Đổi tự động khi chia đội thay đổi.
  - Dòng đếm RELAYS □□□ 0/3, dấu A/B/C trên la bàn, trên màn hình và trên minimap, dấu thuyền đều ẩn.
  - Không còn đồng bộ relay/rút quân giữa các máy: host bỏ luôn gói `cut` và `end` (máy sửa đổi gửi lên cũng bị bỏ).
  - Boss vẫn tới theo số robot bị hạ như trước (chỉ là không còn kiểu "cắt relay gọi boss").

- **Hiệu năng phòng đông người:**
  - Mỗi máy tự render phần hình của mình (trình duyệt ai người nấy vẽ). Phần chung chỉ có dữ liệu: host chạy robot, kiểm tra sát thương, chuyển tiếp vị trí và phát bắn của khách này cho khách kia.
  - **Host gom tin:** mọi thứ host chuyển tiếp cho một khách trong 1/30 giây (vị trí, phát bắn, trạng thái thế giới) đi chung một gói `{t:'b'}` (`SXN_TUNE.batchHz`). Tin "trúng đạn" vẫn gửi ngay. Đo với 8 người cùng chạy và bắn: host gửi 167 gói/s thay vì 1.289; dung lượng giữ khoảng 134 KB/s.
  - **Avatar người khác:** bộ xương cập nhật mỗi khung hình khi ở gần và trước mặt; mỗi 2 khung khi xa hơn 30 m; mỗi 3 khung khi xa hơn 60 m hoặc ở sau lưng (`SXN_TUNE.lodNear/lodFar`). Vị trí vẫn đi mỗi khung hình. Đo với 7 avatar: 32 → 19 ms mỗi giây.
  - **Đo:** mở game với `?netprof=1` rồi gọi `__sxnProf.report()` trong console: số gói gửi/nhận mỗi giây, KB/s, và ms mỗi giây cho từng phần (render, avatar, xử lý tin, robot…).
  - Giao thức hiện là `sxn5` (thắng theo ván, xem dưới): máy dùng bản cũ không vào được phòng của bản mới (báo "Different game version").
- **Tối đa theo map** (`maxPlayers` trong dữ liệu level; port lấy từ `SX_MAP_MAX` trong `desert/desert.js`): Crossroads 10 (5 vs 5), Waterworks 10 (5 vs 5), DoomZone Port 12, Dust Basin 16. Trần tuyệt đối là 16 (`SXN_TUNE.max`). Phòng trên 8 người gửi vị trí 10 lần/giây thay vì 15 để máy host đỡ tải. Crossroads có 12 chỗ xuất phát Free-for-all.
- **Host chỉnh trong sảnh chờ:** dòng "Players − N +", từ 2 tới mức tối đa của map; mặc định bằng mức tối đa. Không giảm được xuống dưới số người đang trong phòng. Khách chỉ xem, không có nút −/+.
- **Mỗi đội tối đa** = nửa số người của phòng, làm tròn lên (phòng 4 → 2 người/đội, phòng 8 → 4 người/đội). Free-for-all chỉ giới hạn tổng số người.

- **Tạo phòng:** game cho một mã 5 ký tự (ví dụ `JLFAY`). Gửi mã đó cho bạn bè. Người tạo phòng là host.
- **Vào phòng:** chỉ cần nhập mã. Người mới vào được xếp vào đội đang ít người hơn.
- **Bắt đầu trận (chỉ host):**
  - Khách chỉ có nút **Ready** (bấm lần nữa để huỷ). Danh sách hiện "ready" (xanh lá) / "not ready" bên cạnh tên.
  - Nút **Start** của host ghi "Start · 1/2 ready" và chỉ mở khi mọi khách đã Ready. Nút Start ở màn hình chính và phím Enter cũng bị chặn theo cùng luật: khách bấm thì được nhắc "Only the host starts the match".
  - Host bấm Start thì mọi khách đã Ready tự vào trận. Ai vào phòng khi trận đang chạy chỉ cần bấm Ready là vào luôn.
- **Đổi map (chỉ host, ở sảnh chờ):**
  - Dòng **Map** trong phòng là ô chọn DoomZone Port / Dust Basin / Crossroads. Map không đủ chỗ cho số người đang trong phòng bị khoá.
  - Chọn map khác thì mọi máy tải lại map đó, host mở lại phòng **cùng mã**, khách tự vào lại (khoảng 7 giây). Chế độ, số robot và đội được giữ. Phòng đang để mức tối đa thì lấy mức tối đa của map mới.
  - Ô chọn map ở màn hình chính cũng đi theo luật này khi đang trong phòng: host đổi cho cả phòng, khách không đổi được.
- **Chọn đội (sảnh chờ):**
  - Phòng có hai cột: **Blue** và **Red**. Ai cũng tự bấm "Join Blue" / "Join Red" để đổi đội, kể cả host. Mọi người thấy danh sách cập nhật ngay.
  - Chỉ đổi được khi chưa vào trận. Đang trong trận thì tạm dừng → thoát ra màn hình chính rồi đổi.
- **Số robot (host chọn trong sảnh chờ):** **Many** (như chơi một mình), **Few** (mặc định), **Off** (không robot, chỉ người chơi đấu nhau).
  - Few: lính robot tối đa khoảng 40% (2 người: 4 thay vì 9), mỗi đợt ít lính hơn, đợt tiếp viện thưa hơn khoảng 2,5 lần; Gull/Hound chỉ 2/5 số con.
  - Off: không lính robot, không Gull/Hound. Ụ súng cố định ở cứ điểm vẫn còn, boss không ra (vì không có robot để hạ).
  - Chỉnh tỉ lệ: `SXN_TUNE.bots`.
- **Hồi sinh = bộ đồ ban đầu:** mỗi lần hồi sinh, súng, đạn (đầy băng, đạn dự trữ theo cỡ như lúc bắt đầu), phụ kiện, mũ, áo giáp, balo, lựu đạn, túi máu đều về như lúc vào trận (`resetKit` trong `arsenal/`). Đồ nhặt trên map không bị đặt lại.
- **Bất tử khi hồi sinh:** 2,5 giây không mất máu lúc bắt đầu trận và sau mỗi lần hồi sinh (`SXN_TUNE.protect`, mọi map). Nổ súng là hết bảo vệ ngay, để không lợi dụng. Màn hình hiện "SPAWN PROTECTION 3"; người khác thấy dấu ⛨ trước tên, và bắn vào lúc đó không tính.
- **Thắng theo ván (đối kháng: Blue vs Red, hoặc Free-for-all có từ 2 người):** không tính theo kill nữa (kill vẫn được đếm để xem).
  - **Blue vs Red — mỗi ván mỗi người một mạng.** Chết thì không tự hồi sinh; màn hình hiện "You are out — back next round" kèm số người còn sống mỗi bên.
  - **Xem đồng đội khi đã chết (spectate):** camera bám theo một đồng đội còn sống, đứng sau vai (cách khoảng 2,4 m, tự kéo lại gần khi có tường chắn, không xuyên tường). Chuột trái hoặc Space: đồng đội tiếp theo; chuột phải: người trước. Súng trên tay bạn được cất đi; thanh nhỏ dưới màn hình ghi "Spectating <tên>" và số người còn sống mỗi bên. Ván mới bắt đầu thì về góc nhìn của mình. Chỉnh khoảng cách/độ cao ở `SXN_TUNE.spectate`. Đội nào không còn ai sống thì đội kia ăn 1 ván. Chết vì robot, rơi… cũng tính. Hai đội cùng hết người một lúc = hoà, không ai được điểm. **Hết giờ** mà chưa đội nào bị xoá sổ: đội còn nhiều người sống hơn ăn ván ("BLUE WINS ROUND 3 on time (BLUE 2 v 1 RED alive)"), bằng nhau thì hoà.
  - **Free-for-all — mỗi ván theo số phút host đặt (mặc định 3), có hồi sinh** (chết thì 5 giây sau hồi sinh ở chỗ xa người khác). Hết giờ, ai hạ được nhiều người chơi nhất **trong ván đó** thì ăn ván (hạ robot không tính). Bằng nhau ở vị trí cao nhất, hoặc chưa ai hạ được ai, thì hoà. HUD hiện đồng hồ của ván, số người bạn đã hạ trong ván và số cao nhất ("ROUND 2 · 1:47 · KILLS 3 / TOP 4").
  - **Hết ván:** banner ("BLUE WINS ROUND 3 — BLUE 3 : 2 RED"), nghỉ 4 giây, rồi mọi người hồi sinh ở căn cứ với bộ đồ ban đầu, đồ nhặt trên map đặt lại, bất tử 2,5 giây ("ROUND 4 — …").
  - **Thắng trận:** đạt số ván host đặt **và hơn bên kia ít nhất 2 ván**. Ví dụ đặt 5: 5:4 thì đánh tiếp, 6:4 mới thắng.
  - **Màn hình kết quả** (mọi người, khi thắng trận): "VICTORY"/"DEFEAT" theo phe của bạn, tiêu đề "BLUE TEAM WINS" (Free-for-all: "YOU WIN THE MATCH" / "<tên> WINS THE MATCH"), tỉ số và số ván đã đánh.
    - **Bảng thành tích:** mỗi người một dòng — hạ người chơi (Kills), chết (Deaths), K/D, hạ robot (Robots); Free-for-all thêm cột số ván thắng. Đội thắng xếp trước, trong đội xếp theo kill; dòng của bạn được tô sáng; người nhiều kill nhất (ít chết hơn nếu bằng) có ★ MVP. Số liệu tính riêng từng trận.
    - **Nút:** "Main menu" (mọi người) rời phòng và về màn hình chính — link không còn mã phòng nên không tự vào lại; "Next match" (chỉ host) bắt đầu trận mới ngay. Không ai bấm thì 20 giây sau trận mới tự bắt đầu (`SXN_TUNE.rounds.matchPause`), tỉ số và bảng thành tích về 0.
    - Trong lúc xem bảng: chuột được nhả ra để bấm nút (game không tự tạm dừng), không di chuyển được và không ai mất máu.
  - **Ô "Rounds to win" trong sảnh chờ:** host nhập số ván (1–15, mặc định 5, máy host nhớ cho lần sau), khách chỉ xem. Chỉ đổi được khi chưa vào trận.
  - **Ô "Minutes per round":** host nhập số phút tối đa của một ván (0,5–15, bước 0,5, mặc định 3, máy host nhớ cho lần sau), khách chỉ xem. Free-for-all: ván kéo dài đúng chừng đó. Blue vs Red: thời gian tối đa (xoá sổ đội kia trước thì hết ván sớm). HUD của cả hai chế độ hiện đồng hồ đếm ngược của ván ("ROUND 2 · 1:47 · …").
  - **HUD dưới la bàn:** số ván thắng mỗi bên và "ROUND n · FIRST TO N · BY 2" (Free-for-all: "YOU x · <người dẫn đầu> y" cùng đồng hồ và kill của ván).
  - Host quyết định mọi thứ (ai còn sống, kill trong ván, đồng hồ, ai ăn ván) và gửi cho cả phòng; ván Blue vs Red không kết thúc trong 3 giây đầu (mọi người còn đang xuất phát). Chỉnh ở `SXN_TUNE.rounds`.
  - Nếu bên kia rời phòng hết (không còn đối kháng) thì người đang chết hồi sinh sau 5 giây như co-op.
- **Chế độ (host chọn trong sảnh chờ):** **Blue vs Red** (hai đội, như dưới) hoặc **Free-for-all** (mỗi người một phe).
  - **Free-for-all:** ai cũng là địch của nhau, robot đánh tất cả. Hai cột đội được ẩn, thay bằng một danh sách chung. Người chơi khác đều hiện kính đỏ, không ai có tên xanh hay chấm trên minimap.
    - Xuất phát: người thứ 1 ở cổng tây, người thứ 2 ở Camp Mirage, những người sau ở điểm spawn xa hai chỗ đó nhất (test 3 người: cách nhau 70–196 m). Hồi sinh ở điểm xa người chơi khác đang sống nhất.
    - Mốc boss tính theo người hạ nhiều robot hình người nhất.
  - Khách chỉ xem được chế độ, không đổi được. Host chỉ đổi được khi chưa vào trận.
- **Hai kiểu trận ở chế độ Blue vs Red (tự động theo cách chia đội):**
  - **Cả hai đội đều có người → Blue vs Red:**
    - Robot đánh cả hai đội, hai đội bắn nhau (không bắn trúng đồng đội), bắn robot để nhặt đồ rơi.
    - Thắng theo ván như trên: xoá sổ đội kia để ăn ván.
  - **Tất cả cùng một đội → co-op:** cùng đánh robot. Trận không tự kết thúc; thoát bằng pause → quit.
- **Căn cứ:**
  - Blue xuất phát ở cổng tây (điểm xuất phát nhiệm vụ, gần Warden, Kestrel, Sandcat, Talon).
  - Red xuất phát ở Camp Mirage (map sa mạc, cách khoảng 140 m, có Harrow đỗ sẵn).
  - Map cảng không có trại phe mình, nên Red ở điểm spawn robot xa Blue nhất.
  - Đối kháng: hồi sinh ở căn cứ đội mình khi ván mới bắt đầu. Co-op: hồi sinh sau 5 giây.
- **Robot ở cả hai phe:**
  - Mỗi robot nhắm người chơi gần nó nhất, bất kể đội nào.
  - Host lần lượt thả các đợt lính robot quanh từng người chơi. Đợt quân đến nhanh và đông hơn khi phòng nhiều người: tối đa 6 + 3 lính cho mỗi người thêm.
  - Cứ điểm thức dậy khi bất kỳ người chơi nào lại gần.
- **Đếm kill:**
  - Kill của bạn: góc trên phải, cạnh minimap.
  - Mỗi lần hạ địch (người hay robot) hiện popup "YOU KILLED …" kèm vũ khí và tổng kill.
  - Số ván thắng (BLUE x : y RED) hiện dưới la bàn; kill không quyết định thắng thua.
  - Danh sách phòng bên trái hiện kill/chết từng người.
  - Host giữ điểm cho cả phòng: robot tính cho người bắn trúng nó cuối cùng (trong 4 giây). Người chơi bị hạ tính cho người bắn trúng gần nhất (trong 10 giây).
- **Phòng đầy:** người vượt số host chọn bị từ chối, kèm thông báo "Room … is full (4/4)". Đội đủ người thì nút "Join" của đội đó tắt ("… is full"); người mới vào luôn được xếp vào đội ít người hơn.
- **Robot khi đông người:** lính robot tối đa 16 con cùng lúc dù phòng đông tới đâu (mức Many).
- **Nghe tiếng bước chân người khác** (`SXN_footstep`, chỉnh ở `SXN_STEP` trong `net/net.js`):
  - Phát đúng chỗ người đó đứng (âm thanh 3D), mỗi bước một tiếng theo nhịp bước như của chính mình (đi 1,55 m, chạy 2,1 m một bước).
  - Bê tông nghe khoảng 15 m, sàn thép (cầu thép, cầu thang) to hơn một chút. Đi khom trên nền khô thì im lặng.
  - **Lội nước** (ngã tư ngập ở Crossroads, bể lắng ở Waterworks): tiếng to gấp 2,5 lần và nghe tới khoảng 30 m, đi khom vẫn có tiếng (nhỏ hơn), nên lội qua là lộ vị trí.
  - Không có tiếng khi người đó đang nhảy/rơi, đã chết, hoặc đang lái xe.
- **Điểm xuất phát rải trong bán kính 3 m** quanh căn cứ; map có thể đặt nhỏ hơn (`teamSpawns.<đội>.r`, Waterworks 1,4 m để luôn nằm sau tường chắn).
- **Vào giữa trận:** được.
- **Map khác host:** game tự tải lại đúng map của host rồi vào lại phòng.
- **Bạn bè cần gì:** cùng bản game (file `index.html`, hoặc cùng link nếu đã deploy) và có internet.
- **Kết nối:**
  - WebRTC P2P qua thư viện PeerJS (`net/lib/10_peerjs.min.js`).
  - Máy chủ miễn phí `0.peerjs.com` chỉ dùng để bắt cặp lúc vào phòng (trao đổi mã phòng và thông tin kết nối, trong đó có địa chỉ IP). Dữ liệu trận đấu đi thẳng giữa các máy.
  - Tìm đường nối thẳng bằng STUN của Google và Cloudflare (`SXN_TUNE.ice.stun`).
  - **TURN (đường chuyển tiếp khi không nối thẳng được):** máy TURN miễn phí của PeerJS (`eu-0`/`us-0.turn.peerjs.com`) đã ngừng hoạt động (tên miền không còn), nên mặc định **không có TURN**. Khi đó người dùng VPN (Cloudflare WARP / 1.1.1.1), 4G hoặc mạng công ty chặt thường không vào được phòng: thấy phòng nhưng không nối được, sau khoảng 15 giây báo "Found room … but there is no direct path between your networks…". Cách xử lý:
    - Tắt VPN rồi vào lại, hoặc
    - Dùng một máy TURN riêng (ví dụ tài khoản miễn phí của Metered hay ExpressTURN, lấy `urls`, `username`, `credential`). Có 2 cách đặt:
      - Trong code: điền vào `SXN_TUNE.ice.turn` ở `net/net.js`, ví dụ `turn: [{ urls: ['turn:host:80', 'turn:host:443?transport=tcp', 'turns:host:443?transport=tcp'], username: '…', credential: '…' }]`, rồi build lại. Áp dụng cho mọi người dùng bản đó.
      - Qua link: mở game một lần với `?turn=<url>,<url>&turnuser=<user>&turnpass=<mật khẩu>` (mã hoá `?` trong url thành `%3F`). Trình duyệt đó nhớ cấu hình; `?turn=off` để xoá.
    - Bảng Multiplayer ghi rõ đang có TURN hay không ("TURN relay: …" / "No TURN relay set…"). Thông tin TURN nằm công khai trong trang (như mọi cấu hình TURN chạy trên trình duyệt), nên dùng tài khoản có hạn mức bạn chấp nhận chia sẻ.
  - Muốn dùng máy chủ PeerJS riêng thì thêm `?peerhost=…&peerport=…&peerpath=…` vào đường dẫn.
- **Host làm chủ thế giới:**
  - Robot (Gull, Hound, lính, robot to, máy bay địch) chỉ do host sinh ra. Máy khách tạo bản sao và ghim theo vị trí host gửi 10 lần/giây.
  - Bản sao trên máy khách vẫn tự nhắm và bắn người chơi ở máy đó.
  - Sát thương máy khách gây cho robot được gửi về host; máu và cái chết theo host.
  - Cứ điểm bị chiếm (map sa mạc) được đồng bộ cho mọi người.
- **Người chơi:**
  - Trạng thái gửi 15 lần/giây và được vẽ bằng model Soldier (đội Blue kính xanh, đội Red kính đỏ), có tên trên đầu.
  - Tên kẻ địch bị ẩn khi bị tường che.
  - Đồng đội hiện trên minimap.
  - Danh sách phòng (K/D, máu đồng đội) nằm bên trái màn hình.
- **Bắn nhau:**
  - Máy người bắn kiểm tra trúng trên avatar của đội kia, rồi gửi sát thương ×0,6 (`SXN_TUNE.pvpScale`) cho nạn nhân. Giáp của nạn nhân vẫn được tính.
  - Thanh kill feed hiện "A ✕ B".
- **Chết:** không có màn hình thua. Đối kháng: chờ hết ván rồi hồi sinh. Co-op: hồi sinh sau 5 giây ở căn cứ đội mình. Chết thì mất giáp.
- **Xe:**
  - Người lái gửi vị trí và hướng thật của xe, các máy khác thấy xe chạy theo.
  - Xe đang có người khác lái thì không lên được.
- **Rời phòng:** dùng nút Leave room. Người rớt mạng bị tính là rời phòng sau khoảng 10 giây.
- **Hạn chế:**
  - Robot cỡ lớn và lính robot đi về phía người gần nhất, nhưng Gull và Hound (robot gốc của game) vẫn chỉ đuổi theo host. Trên máy khách, bản sao của chúng vẫn bắn người chơi ở máy đó khi tới gần.
  - Đồ rơi từ robot hiện trên máy của mọi người, và mỗi người nhặt bản của mình, nên hai người có thể cùng nhặt một món.
  - Lựu đạn chưa gây sát thương lên người chơi khác.
  - Host bấm tạm dừng thì robot của mọi người cũng dừng.
- **Chống gian lận (host làm trọng tài, `SXN_GUARD` trong `net/net.js`):** mọi gói tin từ khách được kiểm tra kiểu, phạm vi, tần suất và hợp lý trước khi áp dụng hay chuyển tiếp.
  - Chỉ nhận đúng các loại khách được phép gửi (vị trí, bắn, trúng đạn, chết, sát thương robot, đổi đội, ready). Điểm, kill robot, thắng round, danh sách phòng chỉ host gửi được.
  - Sát thương một phát lên người tối đa 320 (headshot SR-3 khoảng 160, tên lửa khoảng 300), tổng tối đa 650 mỗi giây từ một người; người bắn phải còn sống, khác phe và cách nạn nhân không quá 700 m. Người bị bắn cũng tự chặn phát vượt mức.
  - Kill chỉ được tính khi người đó thật sự vừa bắn trúng nạn nhân trong 10 giây; mỗi mạng chỉ chết một lần.
  - Sát thương lên robot tối đa 1.200 mỗi gói, robot phải ở trong 1.600 m.
  - Dịch chuyển nhanh hơn 210 m/s bị bỏ qua (hồi sinh và lag dài vẫn được).
  - Tọa độ, góc, tên vũ khí, mã xe được kiểm tra; giá trị rác bị bỏ. Mỗi loại gói có giới hạn số gói/giây; quá 260 gói/giây thì bị đá khỏi phòng.
  - Test: bắn một phát 5.000, gửi điểm/kill/thắng giả, cắt relay từ xa, lên thuyền giả, dịch chuyển 1.270 m, tọa độ rác, tặng kill giả và spam 600 gói đều bị chặn; bắn hợp lệ vẫn hạ được và được tính kill.
  - Giới hạn: đây là game chạy trên trình duyệt, nên không chặn được gian lận chỉ trên máy người chơi (ví dụ nhìn xuyên tường); lớp này chỉ ngăn chúng phá game của người khác.
- **Chỉnh số liệu:** `SXN_TUNE` ở đầu `net/net.js` (tần suất gửi, thời gian hồi sinh, hệ số sát thương bắn nhau, `rounds`: số ván mặc định, cách biệt cần có, thời gian nghỉ giữa ván/trận).
- **Bản giao thức:** `sxn2`. Bản `doomzone.html` cũ (`sxn1`) không vào chung phòng được.

## Boss xuất hiện dần và đếm kill (`score/`, `units/`)

Áp dụng cho cả chơi một mình lẫn chơi nhiều người, chỉ trên map sa mạc. Lúc bắt đầu không có boss nào. Boss lần lượt xuất hiện theo số robot hình người (lính trooper) bị hạ:

| Robot bị hạ | Xuất hiện |
|---|---|
| 5 | Colossus (walker to) từ đồi cát phía đông |
| 10 | Petrel (máy bay phản lực địch) từ hướng đông bắc |
| 15 | Skua (gunship) từ phía bắc |
| 20 | Colossus thứ hai từ phía nam và Petrel thứ hai |

- **Cắt relay cũng gọi boss (chỉ khi chơi một mình):** mỗi lần cắt một relay, boss kế tiếp chưa xuất hiện sẽ tới ngay (test: relay A → Colossus, B → Petrel, C → Skua; mốc cuối 20 robot vẫn theo số robot bị hạ). Boss nào đã tới vì relay thì không tới lần nữa khi đủ số robot; dòng "… NEXT" trên HUD nhảy sang boss tiếp theo.
- **Đếm thế nào:** chơi một mình thì đếm mọi lính robot bị hạ. Chơi nhiều người thì lấy số của đội đang dẫn đầu, mỗi đội chỉ tính robot do chính người trong đội hạ.
- **Cứ điểm:** lính gác lớn ở cứ điểm cũng chờ tới mốc tương ứng: Colossus ở Ridge Post từ 5, Skua ở Radar Station từ 15.
- **HUD:**
  - Dòng "ROBOTS DOWN x / y · … NEXT" dưới bộ đếm kill cho biết boss kế tiếp.
  - Bộ đếm kill và popup "YOU KILLED" cũng có khi chơi một mình: robot tính là của bạn nếu bạn bắn trúng nó trong 4 giây trước khi nó chết.
- **Robot rơi đồ** (có từ trước, trong `arsenal/`): đạn, lựu đạn, túi máu; lính robot còn rơi giáp và phụ kiện súng. Boss rơi túi máu lớn, đạn, lựu đạn và giáp cấp 3.
- **Chỉnh mốc:** bảng `LADDER` trong `units/units.js` (và `RUNG` cho lính gác cứ điểm).

## Đạn không mắc vật cản vô hình (`shots/`)

Khối va chạm của map vừa dùng để chặn người đi vừa chặn đạn, nhưng nhiều khối to hơn hình nhìn thấy (bao cát, thùng, xe) hoặc lấp kín những công trình nhìn xuyên được (khung cần cẩu, tháp lưới, hàng rào lưới, cột). Khi tính đường đạn (súng người chơi, súng trên xe và máy bay, súng robot), module này:
- **Cho đạn sượt mép:** đạn chạm trong khoảng 10 cm sát mép mặt bị trúng mà chỉ cắt qua góc (đi trong khối ≤ 0,35 m) thì bay tiếp. Cạnh hẹp dưới 0,8 m như cột giữa hai cửa sổ thì vẫn chặn đủ.
- **Cho đạn xuyên vật nhìn xuyên được:** khối có nhãn `backdrop` (cần cẩu ở cảng), tấm kim loại mỏng ≤ 0,12 m cao ≤ 2,5 m dài ≥ 8 m (hàng rào lưới), khối kim loại mảnh cao trên 6 m mặt đáy gần vuông ≤ 3 m (tháp lưới, cột điện, cột ăng-ten), và khối nào map đánh dấu `bulletPass: true`.
- **Đi lại, tầm nhìn của robot, bánh xe, camera:** vẫn dùng va chạm cũ, không đổi.
- **Đo bằng 400–700 tia ngẫu nhiên, đếm tia bị chặn trước vật nhìn thấy gần nhất hơn 1,5 m:** Port 49 → 16, Dust Basin 56 → 40, Crossroads 23 → 19. Phần còn lại là các vật có khối va chạm lớn hơn hình (xe, máy bơm dầu, lan can…), cần sửa riêng từng chỗ.
- Chỉnh số: `SXB_TUNE` trong `shots/shots.js`.

### Đường đạn trúng người: đã kiểm tra

- **Đạn của mình (bắn robot, bắn người chơi khác):** đạn bay từ mắt theo tâm màn hình. Đã đo:
  - **Hitbox so với model:** lệch tối đa khoảng 6 cm, tâm lệch dưới 2 cm, kể cả khi người kia đang chạy, ở 8 / 25 / 40 m.
  - **Ống ngắm:** red dot sẵn và 4x của PAC-9, điểm ruồi, red dot, holo của M7, đầu ruồi KR-12 đều nằm đúng tâm màn hình.
  - **Độ toả là cố ý:** bắn hông, vừa chạy vừa bắn, đang nhảy thì đạn toả rộng hơn, và khe hở của tâm ngắm cho thấy độ toả đó.
- **Robot bắn mình (lính, tháp súng, xe, máy bay, chó robot):** người chơi giờ là một khối viên nang như thân người (`SXU_PHIT` trong `units/units.js`: bán kính 0,34 m, cao 1,85 m, ngồi xuống còn 1,2 m, đầu đi theo mắt nên nghiêng người thì đầu ra khỏi đường đạn).
  - Trước đây là ống tròn bán kính 0,42 m (chó robot 0,38 m), luôn cao 1,9 m kể cả khi ngồi, nên đạn sượt cách người 10 cm hoặc bay qua đầu lúc ngồi vẫn tính là trúng.
- **Chơi nhiều người, vệt đạn của người khác:** vệt vẽ từ súng của họ tới đúng chỗ đường đạn thật dừng lại (tường, mình, hoặc người khác).
  - Trước đây vệt chạy song song với đường đạn thật nhưng xuất phát từ nòng súng, nên lệch 20–30 cm: nhìn thì như bắn trượt mà mình vẫn mất máu.
  - Người bắn vẫn thấy mình chậm khoảng 0,12 s (nội suy, `SXN_TUNE.interp`) cộng thêm độ trễ mạng. Vì vậy khi đang chạy ngang, có thể bị trúng ở chỗ vừa rời đi một chút.

## Nghiêng người (`view/`)

- **Phím:** giữ Q để nghiêng trái, giữ E để nghiêng phải (giống PUBG). Trên điện thoại có nút L / R.
- **Phím đã dời để nhường Q/E:** tương tác (cắt relay, lên/xuống xe) chuyển sang **F**, cận chiến chỉ còn **V**, về súng trước chuyển sang **X**. Tay cầm không đổi.
- **Hiệu ứng:**
  - Mắt dịch ngang tối đa 0,38 m, camera nghiêng khoảng 12°, súng nghiêng theo.
  - Đạn bắn ra từ vị trí mắt đã nghiêng.
- **Chặn tường:** không nghiêng xuyên tường; gần tường thì dừng cách tường 0,24 m.
- **Tắt khi:** chạy nước rút, đang chết, hoặc đang lái xe/máy bay.
- **Khi chơi nhiều người:** độ nghiêng được gửi cho người khác. Avatar nghiêng thân trên và dịch hông, đầu lệch khoảng 0,3 m, nên vùng trúng đạn cũng lệch theo.
- **Hạn chế:** robot vẫn bắn vào vị trí chưa nghiêng của bạn.

## Trực thăng Kestrel: model Gazelle SA342M

- **Nguồn:** `sa342m_dcs_world.glb`.
- **Thu gọn:** file gốc 95 MB, 415 nghìn đỉnh, 107 texture. Bản trong game `aircraft/assets/gazelle.glb` còn 2,8 MB, 61 nghìn đỉnh. Cách làm:
  - Bỏ nội thất buồng lái nằm gọn trong bong bóng kính; qua kính vẫn thấy ghế và bảng điều khiển.
  - Giảm đa giác bằng meshoptimizer.
  - Texture thu về tối đa 768 px dạng WebP.
  - Lượng tử hóa đỉnh (KHR_mesh_quantization).
  - Công cụ là gltf-transform (chạy một lần, không nằm trong game).
- **Phần chuyển động:**
  - Cánh quạt chính (lá + moay-ơ) quay quanh trục đo được từ model, có đĩa mờ khi quay nhanh.
  - Quạt đuôi lồng (fenestron) quay quanh trục ngang.
- **Lối chơi giữ nguyên:**
  - Tháp súng dưới mũi (thu nhỏ còn 85%).
  - Hai ống rocket đặt ở giàn tên lửa HOT hai bên.
  - Vùng trúng đạn dựng lại theo thân Gazelle: cabin, nóc và động cơ, đuôi, vây và quạt đuôi, giàn tên lửa.
- **Dự phòng:** nếu model chưa tải xong lúc trực thăng xuất hiện, game dùng hình Kestrel cũ rồi tự đổi sang Gazelle ngay khi tải xong. Nếu model lỗi thì giữ hình cũ.
- **Chỉnh vị trí:** `SXH_GZT` trong `aircraft/aircraft.js` (độ cao càng, tâm cánh quạt, bán kính đĩa mờ).

## Súng ngắn M7: model Desert Eagle

- **Nguồn:** `desert_eagle.glb`.
- **Thu gọn:** file gốc 106 MB (texture 4096 px). Bản trong game `arsenal/assets/deagle.glb` còn 1,1 MB: bỏ viên đạn rời, texture 1024 px WebP, lượng tử hóa đỉnh. Hình học giữ nguyên (khoảng 14 nghìn đỉnh).
- **Căn chỉnh:** model tính bằng cm, mũi nòng hướng +Z. Mũi nòng đặt đúng chỗ của khẩu M7 cũ, nên tư thế cầm và ngắm giữ nguyên. Đường ngắm theo thước ngắm sau (cao 0,0377, gần như trùng khẩu cũ).
- **Phần chuyển động:**
  - Cụm khóa nòng (`Group001`) giật lùi 3,4 cm mỗi phát, và kẹt lại phía sau khi hết đạn.
  - Băng đạn (thân, đế) tuột ra theo trục nghiêng 9,2° khi nạp rồi lắp lại.
  - Cò nhích khi bóp; búa và nút bấm đứng yên.
- **Tay phải:** găng tay chuyển từ báng cũ sang báng Desert Eagle.
- **Phụ kiện:**
  - Red dot / holo gắn trên khóa nòng và chạy theo khóa nòng.
  - Giảm thanh gắn ở mũi nòng.
  - Băng mở rộng gắn ở đế băng đạn.
- **Tên và số liệu:** vẫn giữ tên M7 Tern và các thông số cũ (12 viên, sát thương 34).
- **Chỉnh vị trí:** `SXA_TUNE.pistolModel` (độ cao lỗ nòng, vị trí cầm hông, độ xa khi ngắm, chỉnh tay).
- **Dự phòng:** nếu model không tải được thì dùng lại khẩu M7 cũ.

## Shotgun KR-12: model "Shotgun" (DJMaesen)

- **Nguồn:** model "Shotgun" trên Sketchfab của DJMaesen, giấy phép CC-BY-4.0 (ghi công trong `CREDITS.md`). Shotgun pump có báng súng ngắn kiểu pistol grip.
- **Tối ưu (làm một lần):** `tools/shotgun_opt.mjs` (gltf-transform) bỏ phần thừa, gộp trùng, đổi texture sang WebP 2048 px, nén hình khối bằng meshopt → `arsenal/assets/shotgun.glb` (0,96 MB). Dùng: `node tools/shotgun_opt.mjs <vào.glb> <ra.glb>`.
- **Đo model:** `tools/sg_profile.mjs` in mặt cắt của model (độ cao nòng, đầu ruồi, ống tiếp đạn, ốp pump, tay cầm) để lấy số đo cho `SXA_TUNE.shotgunModel`.
- **Đưa vào game** (`SXA_loadShotgunModel` trong `arsenal/arsenal.js`): quay 180° cho nòng theo trục -Z, đổi sang mét (`s` = 0,0057 m mỗi đơn vị, súng dài khoảng 0,79 m), gốc toạ độ ở cò súng nằm trên trục nòng (`boreY`, `triggerZ`). Dùng vật liệu riêng của model (màu, kim loại/độ nhám, normal map).
- **Phần chuyển động:**
  - Mesh `pump` (ốp + thanh trượt) là phần pump, trượt lùi 8,5 cm mỗi lần lên đạn.
  - Mesh `trigger` là cò, nhích khi bóp.
  - Mesh `slug` (viên đạn rời đi kèm model) bị bỏ.
  - Tay phải nắm tay cầm pistol grip, tay trái nắm ốp pump và đi theo pump.
- **Ngắm (ADS):** nhìn dọc thân súng tới đầu ruồi ở mũi nòng (`beadY`). Shotgun không gắn ống ngắm nào (kể cả red dot/holo), chỉ ngắm bằng đầu ruồi; băng mở rộng là đoạn nối dài ống tiếp đạn, gắn ở đầu ống (`magZ`, `magY`).
- **Súng trên đất (để nhặt):** cũng dùng model này.
- **Chỉnh vị trí:** `SXA_TUNE.shotgunModel`: số đo của model (`boreY`, `triggerZ`, `muzzleZ`, `rearZ`, `beadY`, `magZ/magY`, `forendZ/forendY`, `gripZ/gripY`, `ejectZ`) và vị trí cầm hông, độ xa khi ngắm, hành trình pump, chỉnh tay trái/phải.
- **Dự phòng:** nếu model không tải được (quá 8 giây hoặc lỗi), game dùng lại khẩu KR-12 dựng bằng khối như cũ.

## arsenal (vũ khí, bom, nhặt đồ)

- **Vũ khí:**
  - Ô 1 là PAC-9, khẩu rifle gốc.
  - Ô 2 là KR-12 Breakwater, shotgun pump. Không có sẵn, phải nhặt trên map.
  - Ô 3 là M7 Tern, súng ngắn.
  - Đổi súng bằng phím 1 / 2 / 3, con lăn chuột, hoặc X để về khẩu trước. Khi khẩu đang cầm hết sạch đạn, game tự chuyển sang khẩu còn đạn.
- **Bom (G để ném, T để đổi loại):**
  - Frag: nổ sau 2,2 giây, bán kính 6,5 m.
  - EMP: hạ drone ngay lập tức và làm robot chó (Hound) đứng im 5 giây.
  - C4: dính vào tường, sàn hoặc địch. Bấm G lần nữa để kích nổ.
- **Nhặt đồ:** đi qua là tự nhặt.
  - Thùng đạn (cột sáng cam) nạp đạn cho mọi súng đang có.
  - Thùng lựu đạn (cột sáng đỏ) cho thêm bom.
  - Thùng hồi lại sau 60 giây.
  - Địch bị diệt có thể rơi túi đạn hoặc lựu đạn. Đồ rơi biến mất sau 45 giây.
- **Máu:**
  - Thanh máu luôn hiện, có vạch đánh dấu ở mức 80%.
  - Tự hồi máu chỉ lên tới 30%, bắt đầu sau 10 giây không trúng đạn và hồi chậm.
  - Túi máu nhỏ: +20%, nhưng không vượt quá 80%.
  - Túi máu thường: hồi lên 80%.
  - Túi máu lớn: hồi đầy 100%.
  - Máu từ 80% trở lên thì chỉ túi lớn còn tác dụng.
  - **Đi qua túi máu khi đang mất máu:** dùng luôn tại chỗ, máu tăng ngay (ví dụ đang 30% nhặt túi thường thì lên 80%).
  - **Túi đồ y tế (kiểu PUBG):** túi máu chưa cần dùng (đang đầy máu, hoặc túi đó không hồi thêm được) thì cất vào túi đồ.
    - Mang tối đa: 6 túi nhỏ, 4 túi thường, 2 túi lớn. Khi bắt đầu có sẵn 1 túi nhỏ.
    - Khi đang mất máu mà trong túi đồ có túi dùng được, cạnh thanh máu hiện nhắc nhở nhấp nháy "H — use …".
    - **H:** game tự chọn loại hợp với lượng máu hiện tại. **7 / 8 / 9:** chọn hẳn túi nhỏ / thường / lớn.
    - Thời gian dùng: 1,5 / 3 / 4,5 giây. Trong lúc đó súng hạ xuống; bắn, đổi súng, ném bom hoặc lên xe là huỷ.
    - Trên điện thoại có nút MED, tay cầm dùng nút Back.
  - Túi máu tự đặt quanh các relay, cover point, điểm xuất phát và điểm rút quân. Địch thỉnh thoảng rơi túi nhỏ, robot to thì rơi túi lớn.
- **Chỉnh số liệu:** `SXA_TUNE` ở đầu file `arsenal/arsenal.js` (gồm cả `med` và `regen`).
- **Vị trí đồ trên map:**
  - Nếu level có `pickupSpots` thì dùng danh sách đó.
  - Nếu không thì tự đặt quanh điểm xuất phát, các relay và điểm rút quân.
- **Hình đồ nhặt (model 3D, `arsenal/assets/prop_*.glb`, tổng 1,34 MB):**

  | Đồ | Model |
  |---|---|
  | Thùng đạn | hai thùng đạn kim loại xanh; túi đạn rơi ra là một thùng nhỏ |
  | Thùng lựu đạn | hai thùng gỗ dài xếp chồng |
  | Lựu đạn rơi ra và lựu đạn ném | lựu đạn quả dứa |
  | Túi máu nhỏ | túi cứu thương rằn ri chữ H |
  | Túi máu thường / lớn | hộp cứu thương xanh (bản lớn to hơn 1,5 lần) |
  | Mũ cấp 1 / 2 / 3 | mũ chiến thuật có tai nghe, màu cát / olive / đen |
  | Áo giáp cấp 1 / 2 / 3 | áo chống đạn, màu cát / olive / đen |
  | Phụ kiện súng | vali đựng súng, nắp đóng |

  - Kích thước khớp với đồ cũ nên cột sáng, vòng sáng và tầm nhặt không đổi.
  - Model tải chưa xong thì tạm hiện hình khối cũ rồi tự đổi.
  - Chỉnh cỡ và màu: `SXA_TUNE.props`.

## crossroads (map phố Crossroads)

Map đấu tay đôi/đấu đội nhỏ gọn, thiết kế riêng (không chép map của game nào). Mở bằng `index.html?map=crossroads`, hoặc ở màn hình chính bấm nút **Map** để mở danh sách 4 map (tên, mô tả, số người tối đa; map đang chọn có viền cam) rồi bấm map muốn chơi (trang tải lại). Bấm ra ngoài, hoặc Esc khi đang chọn trong danh sách, để đóng. Tối đa 10 người một phòng (5 vs 5). Code: `crossroads/crossroads.js` (dựng map; phần nối vào game nằm trong `game/js/10_game.js`).

- **Kích thước:** vùng chơi 84×59 m trong một vòng tường gạch 5,5 m, đối xứng trái–phải, bắc là phía −z. Chỗ nào nhìn thấy là tới được. Hai điểm xuất phát cách nhau 52 m.
  - **Chỉ có 4 tòa nhà**, mỗi bên 2 tòa nằm giữa căn cứ và ngã tư: CAFE 24 / NOODLE BAR ở phía bắc, HARDWARE / TAILOR ở phía nam đường chính. Các dãy nhà viền, nhà quanh căn cứ, nhà góc HOTEL và ki-ốt đã bỏ.
  - Chỗ nhà cũ đã lát lại mặt đường bằng bộ Street: hai dải sát tường bắc/nam lát đá nối liền hẻm chợ và phố nam; quanh hai căn cứ là bãi nhựa đường; chỗ nhà góc HOTEL và ki-ốt lát đá như quảng trường.
  - Phần còn lại là sân trống có vật cản: container gỉ, chồng pallet, thùng gỗ, bao cát, rào bê tông; hẻm chợ (sạp hàng) ở phía bắc, phố nam (cây xăng, xe tải) ở phía nam.
  - Sau mỗi căn cứ là **bãi container**. Căn cứ có tường lưng riêng, không bị bắn sau lưng từ bãi.
  - **Căn cứ Blue** (sân phía tây) và **Red** (sân phía đông): mỗi sân có 3 lối ra (đường chính, hẻm lên chợ, hẻm xuống phố nam), có rào bê tông và bao cát ở cửa. Tường và cờ sơn màu đội.
  - **Đường chính** nối hai căn cứ, xuyên qua **quảng trường ngã tư** 18×18 m: đài phun nước nhỏ có tượng đài gãy, hai xe cháy, hai ụ bao cát, cột đèn.
  - **Đường ngắm dài:** mép bắc đường chính (dọc z = −3,5) để trống từ căn cứ này sang căn cứ kia, nhìn thông khoảng 83–86 m. Đây là đường cho súng tỉa.
  - **Hẻm chợ (bắc):** rộng 6 m, lát gạch đá, có sạp hàng, thùng gỗ, thùng phuy.
  - **Phố nam:** rộng 10 m, vỉa hè hai bên, cây xăng ở giữa (mái che, cột bơm), xe tải, bồn cây thấp. MINI MART là tòa nhà giữa dãy phía nam.
  - **Nhà góc 2 tầng** (HOTEL WEST/EAST) ở hai góc bắc quảng trường: 3 cửa, cầu thang trong nhà, tầng 2 có súng tỉa SR-3, ban công lan can thấp nhìn xuống quảng trường.
  - Bản to cũ có hẻm sau căn cứ; bản nhỏ bỏ phần này, lối ra bắc/nam của căn cứ dẫn thẳng vào hai làn.
- **Chơi một mình:** cắt 3 relay (chợ, quảng trường, cây xăng) rồi chạy tới xe EVAC trong sân phía đông. Ít điểm sinh robot hơn các map khác, tất cả ở mép các làn, không có trong căn cứ. Không có xe, máy bay, cứ điểm hay boss.
- **Nhà vào được:** cả 4 tòa đều vào được, số tầng bên trong bằng số tầng nhìn thấy bên ngoài (4 tầng + mái), cầu thang lên tới mái. Súng tỉa SR-3 nằm ở tầng 3 hai tòa phía bắc. Cửa sổ nhìn thẳng vào căn cứ thì bị đóng hoặc có vách chắn.
  - Mặt ngoài: tường gạch dựng thủ tục (texture gạch cắt từ atlas model chung cư) có khung, bậu, lanh tô; vẫn giữ mái hắt, gân đứng, gờ mái, mái che cửa của model (bỏ mặt tường, kính, cửa lõm, mặt mái của model). Bên trong: tường dày 20 cm, sàn mỗi tầng cao khoảng 3,0–3,3 m, cầu thang gấp hai làn sát tường sau lên tới mái có lan can 1 m. Mọi bậc trên map cao đúng 0,295 m (bằng nhà góc, dưới mức bước 0,42 m), nên sàn các tầng làm tròn theo số bậc. Mỗi tầng một thùng gỗ, phòng sâu từ 6 m có thêm bàn thấp 0,8 m cách cửa sổ 1,35 m; tầng trệt cửa hàng có quầy, kệ, thùng các-tông. Vài tầng trên có đồ nhặt.
  - **Cửa sổ bắn được:** 1,3 × 1,4 m, bậu cao 1,0 m so với sàn, mọi tầng, đặt theo cột cửa sổ của model (mái hắt nằm ngay trên). Đứng thì bắn qua bậu, chúc xuống được khoảng 50°; ngồi (cao 1,15 m) thì từ đường bên dưới không thấy (tầng trên, nhờ bậu và độ dày tường; ở tầng trệt người bắn đứng ngang tầm vẫn thấy đỉnh đầu).
  - Cửa sổ bị đóng bằng cửa chớp thép (tường trong để kín) khi: nhìn sang tòa bên cạnh, nhìn ra ngoài tường bao, nằm sau tấm rào ở phố nam, hoặc (tầng trệt) nhìn thấy điểm xuất phát. Ở tầng trên, cửa sổ nào nhìn chéo được tới điểm xuất phát thì có vây bê tông một bên (dày 0,12 m, sâu 0,25–1,2 m, cao một tầng, có va chạm) chắn đúng góc nhìn đó. Mái nào đứng ở lan can mà nhìn thấy điểm xuất phát thì cạnh đó có tường chắn 2,3 m. Từ tầng trên và mái không chỗ nào nhìn thấy điểm xuất phát (kiểm bằng tia vật lý).
  - Đạn xuyên qua cửa sổ, dừng ở tường. Đường ngắm z = −3,5 vẫn trống.
  - Khối va chạm khớp với hình vẽ: xe cháy, xe tải, cột bơm xăng, tượng đài, cột đèn, cột chắn được thu lại theo hình; xe xoay xiên dùng nhiều khối nhỏ; lan can mái nhà góc (đã thay bằng mái ngói của model) không còn va chạm. Khối bậc cầu thang ẩn dưới model cầu thang giữ nguyên.
- **Đường phố (bộ "Street"):** đường chính, phố nam, đường bắc/nam của quảng trường có vỉa hè lát đá, bó vỉa, rãnh, vạch sơn; quảng trường là ngã tư nhựa đường với 4 góc vỉa hè; hẻm chợ lát gạch đá; đèn đường của bộ thay cột đèn cũ; nắp cống, cột chắn. Chỉ là hình: mặt đất vẫn phẳng, vỉa hè cao khoảng 7 cm (đường chính có khối va chạm 7 cm như trước), không vấp chân. Cả bộ 0,35 MB (texture 1024 webp).
- **Chơi mạng:** `teamSpawns` (Blue ở sân tây, Red ở sân đông) và 12 điểm `ffaSpawns` (2 căn cứ, 4 đầu làn, giữa chợ, giữa phố nam, 4 điểm giữa làn) để Free-for-all không xuất phát chồng lên nhau.
- **Ngã tư trũng ngập nước:** quảng trường giữa là một lòng chảo vuông bo góc, sâu 0,6 m, dốc thoai thoải từ cả bốn đường xuống. Nước đục ngập 0,3 m, có gợn sóng và phản chiếu (`CXR_POOL`).
  - Lòng chảo là địa hình thật, dùng chung lưới độ cao với map sa mạc (`SXD_HG`/`SXD_TH`), nên đi lại, đạn, lựu đạn và robot đều theo đúng độ trũng. Đi trong nước có tiếng lội; đạn trúng mặt nước bắn tung bọt nước.
  - Chỗ nấp trong nước: 2 xe cháy gỉ, ụ bao cát, chồng thùng gỗ, chồng pallet. Relay B đứng trên bệ bê tông nhô khỏi mặt nước. Đài phun nước và tượng đài cũ đã bỏ.
  - Pallet trên vỉa hè phía nam đường chính; container trong bãi sau căn cứ giờ gỉ sét. Mép bắc đường chính (z = −3,5) vẫn để trống như cũ.
- **Ánh sáng:** trời âm u ban ngày, mặt trời cao, ánh sáng lạnh và tán xạ, sương bụi xám (trước là nắng chiều ấm).
- **Kính cửa sổ:** mọi cửa sổ mở của nhà vào được (428 ô, không tính cửa ra vào) đều có kính, một InstancedMesh chung (`CXR_glassBuild`).
  - Đạn đi qua kính trước khi trúng vật khác thì làm vỡ kính, đạn vẫn bay tiếp. Áp dụng cho đạn của mình, của robot (qua `SXB.trace` trong `shots/`) và của người chơi khác trong phòng (`net/`). Lựu đạn nổ gần cũng làm vỡ kính.
  - Mảnh kính văng theo hướng đạn, rơi xuống sàn hoặc đường rồi mờ dần, có tiếng kính vỡ. Kính lắp lại khi bắt đầu lượt chơi mới.
- **Trèo qua cửa sổ:** đứng sát cửa sổ (trong hoặc ngoài, đúng tầng), nhìn qua nó và bấm **Space**. Màn hình hiện "SPACE · Vault through window". Nhân vật cúi người trèo qua bậu; kính còn thì lao qua làm vỡ. Từ tầng trên thì rơi xuống, mất máu khi rơi như nhảy từ chỗ cao (tầng 2: khoảng 1 máu). Chỉnh trong `CXR_GLT`.
- **Đồ nhặt** đối xứng mỗi bên: đạn, lựu đạn, túi máu, giáp cấp 1 trong căn cứ; shotgun và tay cầm ở chợ; súng tỉa trên tầng 2 nhà góc; áo giáp cấp 2, băng đạn mở rộng ở phố nam; báng súng ở hẻm bắc của căn cứ. Giữa quảng trường có túi máu lớn và lựu đạn làm mồi.
- **Model 3D (chỉ là hình, vật lý giữ nguyên các khối thủ tục):**
  - Nhà: model chung cư gạch cũ, mỗi tòa một bản kéo theo mặt bằng (instancing); các khối ngoài tường vẫn dùng bản đầy đủ.
  - Hẻm chợ: hai dãy mặt tiền cửa hàng dọc hai bên hẻm, chỉ giữ dải biển hiệu và mái che (phần cửa cuốn dưới 2,3 m bỏ đi để thấy cửa và cửa sổ thật của tòa nhà).
  - Hàng rào gỗ graffiti (10 mẫu) dọc tường sau căn cứ, cuối các làn và bờ nam phố nam.
  - Hai nhà góc: giữ nguyên tường, cửa, cầu thang thủ tục; ốp ngoài bằng texture cắt từ model nhà gạch (gạch, viền đá ở góc, gờ trắng, khung cửa, cửa sổ giả) và mái ngói của model. Bên trong có sàn gỗ, len chân tường, đèn, tranh, vài món đồ (không thêm vật cản).
  - Model tải chưa xong thì hiện hình thủ tục cũ rồi tự đổi (nhà vào được thì lúc đó chỉ thấy tường trong). Tổng tài nguyên 2,8 MB (`crossroads/assets/`).
  - Cầu thang (nhà góc và mọi tòa): model cầu thang thép chữ C, mỗi bậc va chạm một tấm bậc, dầm thép kéo dài theo từng đợt; màu xám bê tông/thép và đá bó vỉa như bộ Street. Khối bậc va chạm giữ nguyên (ẩn). 22 KB, thêm 3 draw call.
  - Tên tác giả trong `CREDITS.md` (CC-BY).
- **Kỹ thuật:** dùng bộ dựng level của game (gộp theo vật liệu), mặt đất là tấm nhựa đường phẳng có sẵn, trời u ám chiều muộn. Giới hạn vật lý, lưới tìm đường robot và khung đổ bóng theo khu phố (`CXR_B`). 60 fps khi test headless.
- **Mẹo:** quảng trường trống, nên đi vòng qua chợ (đánh gần) hoặc phố nam (nấp sau xe tải, cột xăng). Ban công khống chế quảng trường nhưng lộ lưng với người lên từ cầu thang.

## waterworks (map trạm xử lý nước Waterworks)

Map đấu đội nhỏ, bố cục tự thiết kế (không chép map nào của game khác: không 4 silo quanh ngã tư, không 2 hành lang biên, không cốt truyện hay bộ súng của game khác). Mở bằng `index.html?map=waterworks` hoặc chọn **Waterworks** trong nút **Map**. Tối đa 10 người (5 vs 5). Code: `waterworks/waterworks.js`, chỉ dùng hình khối dựng bằng code và prop sẵn có, không thêm model.

- **Kích thước:** 50×46 m trong vòng tường bê tông rêu cao 7 m, chỉ đối xứng trái–phải, bắc là phía −z. Hai điểm xuất phát cách nhau 46 m; chạy từ cửa khu hồi sinh tới bể giữa mất khoảng 2 giây.
- **Khu hồi sinh (Blue tây, Red đông):** sân dài có tường 4 m (không nhảy qua, không ném lựu đạn thẳng vào). Ba cửa: ra hành lang ống, ra mép bể, vào sảnh bơm. Trong cửa ra bể và cửa ra hành lang có tường chắn, người ngoài không nhìn hay bắn thẳng vào chỗ xuất phát. Dải sơn xanh/đỏ và chữ BLUE/RED để nhận ra phía mình.
- **Phía bắc, hành lang ống (Gallery B):** rộng 7 m, dài 48 m từ đầu này tới đầu kia, là tuyến bắn tỉa dài nhất. Có dãy ống sát tường (núp ngồi), hai trạm van nhô ra từ tường trong, một khối bê tông thấp ở giữa. Dầm thép phía trên đổ bóng thành vạch trên sàn.
- **Giữa, bể lắng:** trũng 0,5 m, dốc thoải 1,8 m ở mép, đáy có vài cm nước (bước chân và đạn bắn tóe nước). Giữa bể là bồn lắng (Clarifier 2) đặt trên bệ tròn 2 bậc, quanh bệ có 4 hộp van tạo góc ngồi núp. Phía bắc bể có 2 cụm ống thấp và ống dẫn lớn từ bồn sang tường hành lang. Một cầu thép cao 2,6 m chạy ngang bể phía nam bồn, cầu thang bậc thật ở hai đầu, hai bên cầu thang có lan can chặn (đi ngang trên bậc không rơi xuống, không bước lên cầu thang từ bên hông). Trên cao là khung thép lộ trời.
- **Phía nam, sảnh bơm:** có mái, 3 ô kính lấy sáng, 3 máy bơm trên bệ, tủ điện dọc tường, đèn trần. Là đường đánh gần (2 shotgun đặt ở cửa hông). Cửa chính giữa có khối bê tông chắn phía ngoài.
- **Chơi nhiều người: vào trận chỉ có dao và súng lục** (`mpKit: 'pistol'` trong dữ liệu level, xử lý ở `arsenal/arsenal.js`). Hồi sinh cũng về lại dao + súng lục và không còn đạn 5.56. Chơi một mình vẫn có súng trường như thường.
  - **Súng nhặt trên map** (đối xứng hai bên, súng của DoomZone): súng trường PAC-9 ngay trước chỗ xuất phát (lối giữa tường chắn và cửa), trong hành lang, trong sảnh bơm cạnh cửa hông và ở mép bắc của bể; súng tỉa ngay trong cửa ra hành lang; shotgun ở cửa hông sảnh bơm và ở góc mép bể. Nhặt PAC-9 được đầy băng + 60 viên.
  - **Súng trên map không mất đi khi nhặt** (mọi map khi chơi nhiều người; mỗi người có bộ đồ nhặt riêng): chưa có loại súng đó thì nhặt được súng; đang có rồi thì không nhặt súng nữa, chỉ lấy đạn như trước (PAC-9 +60 viên 5.56, shotgun/súng tỉa một hộp). Sau mỗi lần lấy, chỗ đó 90 giây sau mới cho đạn lại (`p.ammoT`). Chết hồi sinh, mất súng, thì nhặt lại súng được ngay. Chơi một mình vẫn như cũ (nhặt xong súng biến mất, 90 giây sau mới có lại).
  - Game chưa có súng máy và tiểu liên; chỗ "súng máy ở mép nước" đặt một khẩu PAC-9.
- **Khu tiếp tế trong khu hồi sinh:** nhìn ra phía địch thì **bên trái là khu ĐẠN** (vạch vàng, biển AMMO, kệ hòm đạn: 2 thùng đạn, thùng lựu đạn, hộp 5.56, hộp 12 GA), **bên phải là khu GIÁP · MÁU** (vạch xanh, biển ARMOUR · MEDICAL: áo giáp, mũ, túi cứu thương, túi nhỏ). Blue: đạn phía bắc, giáp phía nam; Red ngược lại.
- **Đồ nhặt khác:** túi máu lớn dưới cầu thép; phụ kiện rải ngẫu nhiên khắp map (xem "Phụ kiện" ở phần súng).
- **Chi tiết:** tường bê tông đổ ván khuôn (đường ghép ván, lỗ ty), rêu và vệt bẩn chân tường, vệt rỉ dưới mép tường; hàng rào lưới + dây thép gai trên đỉnh tường bao; sàn có đường cắt mỗi 3 m, rãnh thoát nước có nắp lưới, nắp cống, vết dầu; đáy bể có vệt rong ở mép nước và bùn ở đáy, mặt nước có váng trôi; bồn lắng có mối hàn, cửa người chui, ống nhánh có van, thước đo mực nước, cầu gạt bùn và bộ truyền động trên nóc; khung thép có giằng chéo, đèn pha treo, móc cẩu; hành lang có máng cáp, tủ vòi chữa cháy, van tay, đèn có lồng bảo vệ, số khoang B-01…B-08; sảnh bơm có ốp chân tường, vì kèo thật, khung ô kính, máy bơm có bệ thép, khớp nối, đồng hồ áp, van tay, ống luồn dây, tủ điện MCC có biển điện áp, cửa cuốn. Phần chi tiết chỉ để nhìn, không thêm vật cản.
- **Chơi một mình:** cắt 3 relay (trong hành lang, giữa bể phía bắc bồn, trong sảnh bơm) rồi tới xe EVAC ở khu phía đông. Robot xuất hiện ở hành lang, mép bể, sảnh bơm và khu phía đông.
- **Map có tường bao** (`arena` trong dữ liệu level = mép trong tường bao): chỗ đặt robot và người chơi khi xuất hiện (`spotOutside` trong `units/units.js`, có truyền độ cao sàn) chỉ tính vật cản ở tầm người, nên mái sảnh bơm không đẩy chỗ xuất hiện ra ngoài; và chỗ đó luôn nằm trong tường bao. Trước đây lính xuất hiện ở sảnh bơm bị đẩy ra ngoài tường bao phía nam, trông như robot đi xuyên tường. Map khác không có `arena` nên vẫn như cũ.
- **Chó robot (hound, mọi map):** bị người chơi hoặc con khác đẩy trong lúc đang vướng vật cản trước mặt thì không bị đẩy ra khỏi lưới đi lại nữa (trước đây có thể bị đẩy lọt qua tường; sửa trong `game/js/10_game.js`).
- **Free-for-all:** 14 điểm xuất phát (hai khu hồi sinh, hành lang, góc mép bể, góc sảnh bơm).
- **Minimap:** vẽ bể nước, bỏ mái sảnh bơm để thấy máy bơm bên trong.
- **Test:** 45 lính gọi ra ở cả 15 điểm xuất hiện đều nằm trong map (lính ở sảnh bơm ở lại trong sảnh), theo dõi robot từng khung hình không con nào lọt vào hay cắt qua vật cản; đi ngang trên cầu thang và trên cầu thép không rơi; nhiệm vụ một mình chạy trọn; đi bộ bằng phím qua cả 3 cửa khu hồi sinh, leo cầu thang lên cầu thép, đi hết cầu và xuống đầu bên kia, lội xuống bể (tiếng bước là nước); 49/49 đồ nhặt và mọi điểm xuất phát tới được, không món nào nằm trong vật cản; vào phòng 2 đội thì Blue/Red xuất phát đúng khu của mình, cả hai vào trận chỉ có súng lục và bất tử 2,5 s, nhặt PAC-9 thì có súng trường, chết hồi sinh lại về súng lục; tiếng bước chân người khác: đi bộ có, đi khom trên nền khô không có, lội nước có (cả khi khom), trên cầu thép là tiếng thép.

## desert (map sa mạc)

Mở `index.html?map=desert`, hoặc chọn map ngay ở menu đầu game. Chi tiết xem trong `desert/`.

- **Đi lại trên địa hình:** đê cát và đồi cát leo được. Vật lý của game (đi lại, đạn, lựu đạn, tầm nhìn của địch, đồ rơi) dùng độ cao địa hình `SXD_TH`. Độ cao này được nướng sẵn thành lưới 1,25 m từ `SXD_terrainHeight` lúc tải map.
- **Vùng được đi:** toàn map, bán kính `SXD_PLAY_R` = 560 m quanh trạm bơm. Đi tới gần mép thì game cảnh báo. Sườn dốc hơn `SXD_MAX_SLOPE` (khoảng 46°, ví dụ vách núi mesa) không leo được.
- **Dữ liệu độ cao:** lưới 2 m phủ ±600 m. Mặt đất gần người chơi được dựng thành các khối 100 m từ chính lưới này, nên phần nhìn thấy khớp với phần va chạm. Có 2 mức chi tiết, đổi ở khoảng cách 200 m.
- **Bóng mặt trời:** khi ra xa trạm, vùng đổ bóng đi theo người chơi.
- **Địch:** robot chó vẫn tìm đường trong khu trạm. Drone thì bay theo người chơi.
- **Quốc lộ (`SXD_ROAD_PTS`):**
  - Đường nhựa 2 làn, dài khoảng 2,3 km, chạy bắc–nam ở phía tây map. Đi qua thung lũng giữa Fuel Depot và Ridge Post, dưới đường dây điện, cạnh Camp Mirage, cắt ngang đường tây (đường băng Talon) rồi đi tiếp về nam giữa Radar Station và núi mesa lớn phía tây.
  - Texture mặt đường (`desert/assets/road_ludlow.webp`, 31 KB) cắt từ bản scan `terrain_model_and_rock_features_near_ludlow_ca.glb`, gồm vạch vàng giữa, vạch trắng hai mép và lề sỏi. Tác giả ghi trong `CREDITS.md`.
  - Đường là một phần của mặt đất: `SXD_terrainHeight` san phẳng nền đường (dốc tối đa 5%, taluy 1:2), nên đi bộ, bánh xe và đạn đều khớp với mặt đường nhìn thấy. Chỗ cắt đường băng, mặt đường bằng đường băng.
  - Cột điện gỗ dọc lề đông, có dây võng. Minimap vẽ đường.

## units (khung cho robot to và xe lái được)

`units/units.js` định nghĩa `SXU` và các loại unit đăng ký vào `SXU_TYPES` (`walkers/`, `aircraft/`). Hợp đồng của một unit ghi ở đầu file.

- **Lên/xuống xe:** đứng gần xe, bấm F để lên. Bấm F lần nữa để xuống.
- **Khi đang lái:**
  - Robot thường bắn vào xe, và sát thương lẽ ra vào người chơi sẽ chuyển sang xe.
  - Camera chuyển sang góc nhìn thứ ba.
  - HUD của xe thay cho ô đạn.
- **Robot to của địch:**
  - Trúng đạn, lựu đạn, EMP và C4 như robot thường.
  - Có thanh máu boss ở trên cùng màn hình.
  - Khi chết hiện trong bảng kill.
- **Map sa mạc:**
  - Xe đồng minh đỗ ngoài cổng tây.
  - Robot khổng lồ, gunship và máy bay địch xuất hiện theo số lính robot bị hạ, không theo relay nữa (xem "Boss xuất hiện dần" ở trên).

## outposts (cứ điểm trên map sa mạc)

`outposts/outposts.js`, danh sách `SXO_SITES`. Mỗi cứ điểm nằm trong một lòng chảo phẳng được khoét vào giữa đồi cát.

- **Camp Mirage (đồng minh, phía tây):**
  - Có 3 robot Sentinel đồng minh tự bắn máy địch.
  - Tiếp tế gồm đạn, lựu đạn, túi máu và túi máu lớn.
  - Có xe Rhino và Sandcat (nếu feature `cars` có mặt).
- **Ridge Post, Radar Station, Fuel Depot (của địch):**
  - Lại gần dưới 150 m (400 m nếu đang lái máy bay) thì lính gác xuất hiện: ụ súng, drone Gull, và robot to nếu có (Colossus ở Ridge Post, gunship Skua ở Radar Station).
  - Hạ hết lính gác thì chiếm được cứ điểm: đồng minh kéo tới và có thêm đồ tiếp tế.
- **Marker trên màn hình:** đỏ là của địch, xanh là của mình. Kèm khoảng cách và số lính gác còn lại.

## troopers (lính địch hình người, cả 2 map)

`troopers/troopers.js` (AI, loại lính, đợt xuất hiện) và `troopers/lib/20_soldier.js` (model và animation).

- **Model:** con Soldier, file `troopers/assets/soldier.glb`, được nhúng vào file game. Bộ đọc là GLTFLoader dùng chung trong `common/lib/10_gltfloader.js`.
- **Animation:**
  - Trộn 3 clip Idle / Walk / Run theo tốc độ như trong ví dụ. Tốc độ clip khớp tốc độ chạy thật (Walk khoảng 1,6 m/s, Run khoảng 4,2 m/s) nên chân không trượt.
  - Hông quay theo hướng di chuyển khi đi ngang hoặc lùi, lưng quay lại hướng ngắm.
  - Hai tay bám vào súng bằng IK. Khi đi tuần thì cầm súng chúc xuống; khi giao chiến thì giương súng lên vai, chĩa vào người chơi.
  - Ngồi xuống bằng IK chân, và chân bám theo dốc cát.
  - Chết thì ngã ra đất, súng rơi theo tay.
- **Loại lính:**
  - Trooper: súng trường, bắn từng loạt.
  - Heavy: giáp màu tối, dùng súng máy LMG, trâu hơn.
  - Marksman: giáp màu cát, súng tỉa có ống ngắm. Bắn 1 phát mạnh sau khi tia laser đỏ nhắm vào người chơi.
- **Nhận diện:** kính mũ của lính địch phát sáng đỏ cam.
- **Trúng đạn:** hitbox bám theo xương. Bắn trúng đầu thì sát thương mạnh nhất; tay chân nhận ít sát thương hơn thân.
- **AI:**
  - Nhìn thấy người chơi, hoặc nghe tiếng súng, thì chuyển sang giao chiến.
  - Biết nấp, đánh vòng sườn, đi ngang và ngồi bắn.
  - Tối đa 3 lính cùng bắn một lúc.
- **Xuất hiện:**
  - Một tổ lính khoảng 9 giây sau khi vào trận, mỗi lần cắt relay, và khi cắt hết relay. Có quân tiếp viện khi còn ít lính.
  - Trên map sa mạc, các cứ điểm của địch có thêm 3–5 lính gác.
- **Chỉnh số liệu:** `SXT_TUNE` (máu, tốc độ, sát thương, tầm bắn) và `SXS_TUNE` (tốc độ clip, độ ngồi thấp, màu giáp).
- **Hiệu năng:** lính xa hơn 60 m chỉ cập nhật animation cách một khung hình; xác nằm yên sau khi ngã xong. 14 lính tốn khoảng 1–2 ms mỗi khung hình trên máy Mac M-series.
- **Dự phòng:** nếu model không tải được thì lính dùng lại hình robot cũ.

## minimap (bản đồ kiểu PUBG)

- **Minimap:** ở góc trên bên phải, hướng bắc luôn ở trên, đi theo người chơi. Bấm vào minimap là mở bản đồ lớn. Trên điện thoại, minimap nhỏ hơn và nằm bên trái.
- **Bản đồ lớn (phím M):** game vẫn chạy khi đang mở.
  - Cuộn chuột để phóng to/thu nhỏ, kéo để di chuyển.
  - Click để cắm điểm đánh dấu (hiện trên minimap và trong khung nhìn 3D), chuột phải để xoá.
  - M hoặc Esc để đóng.
  - Lưới ô vuông đánh chữ A–F và số 1–6, mỗi ô 200 m trên map sa mạc.
- **Hình nền bản đồ:**
  - Map sa mạc: vẽ một lần lúc tải map, từ lưới độ cao (đổ bóng đồi) cộng với vị trí các công trình (lấy từ hộp va chạm).
  - Map cảng: vẽ từ container trên nền nhựa đường và mặt biển.

## Xe, robot, máy bay (map sa mạc)

| Loại | Phe | File | Điều khiển chính |
|---|---|---|---|
| Warden (mech 2 chân) | mình, lái được | `walkers/walkers.js` | WASD đi, Shift chạy, chuột trái bắn pháo, chuột phải bắn tên lửa |
| Colossus (robot 6 chân khổng lồ) | địch, boss | `walkers/walkers.js` | điểm yếu là lõi nhiệt phát sáng phía sau |
| Kestrel (trực thăng) | mình, lái được | `aircraft/aircraft.js` | W/S tới/lùi, A/D bay ngang, Space lên, C/Ctrl xuống, chuột trái bắn súng máy, chuột phải bắn rocket. Chỉ xuống được khi đã gần mặt đất. |
| Skua (gunship) | địch, boss | `aircraft/aircraft.js` | model AH-64 Apache sơn xám tối; điểm yếu là đầu trục cánh quạt chính, cánh quạt đuôi và cảm biến ở mũi |
| Sandcat (buggy), Rhino (xe bọc thép) | mình, lái được | `cars/cars.js` | W/S ga/phanh, A/D lái, Space phanh tay, **giữ Shift (không cần W): tự chạy tới và tăng tốc**, R lật xe lại, chuột trái/phải bắn |

| Talon (tiêm kích) | mình, lái được | `jets/jets.js` | xem phần máy bay phản lực bên dưới |
| Harrow (cường kích cất cánh thẳng đứng) | mình, lái được | `jets/jets.js` | xem phần máy bay phản lực bên dưới |
| Petrel (tiêm kích đánh chặn) | địch, boss | `jets/jets.js` | 950 máu, bắn hạ được bằng súng và tên lửa |

Đứng gần xe bấm F để lên, bấm F lần nữa để xuống. Xe đỗ ở ngoài cổng tây (Warden, Kestrel, Sandcat), ở Camp Mirage (Rhino, Sandcat), và hai máy bay phản lực đỗ quanh map.

### Tăng tốc xe (Shift)

- Chỉ cần giữ Shift: xe tự chạy tới hết ga và tăng tốc, tay còn lại lo A/D. Giữ S thì vẫn phanh/lùi như thường.
- Buggy: tốc độ tối đa ×1,35 (khoảng 100 → 135 km/h), lực kéo ×2. Rhino: ×1,25 và lực kéo ×1,8.
- Test leo đồi cát dốc 24–25° từ chỗ đứng yên trong 8 giây:
  - Buggy lên tới đỉnh (14–17 m) cả khi giữ W lẫn Shift, nhưng giữ Shift đi được gần gấp đôi quãng đường.
  - Rhino giữ Shift lên 15–17 m ở 72 km/h; giữ W chỉ bò lên ở 22–28 km/h.
- Vách đá của các mesa (dốc khoảng 60°) thì không xe nào leo được.
- **Mép map:** xe bị chặn ở bán kính 554 m quanh tâm map sa mạc, sát giới hạn đi bộ 560 m (`SXD_PLAY_R`). Trước đây xe tăng tốc leo được dãy núi viền rồi ra ngoài vùng có mặt đất và kẹt lơ lửng; xe nào đã lỡ ra ngoài sẽ được kéo về mép trong.
- Chỉnh: `boostMul` (tốc độ tối đa) và `boostAccel` (lực kéo) trong `SXC_SPECS`.

### Xe Sandcat: model Buggy_2

- **Nguồn:** `buggy_2.glb`.
- **Thu gọn:** file gốc 9,6 MB. Bản trong game `cars/assets/buggy.glb` còn 1,8 MB (texture 1024 px WebP, lượng tử hóa đỉnh).
- **Màu đỏ:** sơn cam của model được xoay sang đỏ (dịch màu −36°, đậm hơn) để giữ màu đỏ của Sandcat. Các phần đen, trắng, xám không đổi.
- **Kích thước:** thu theo bánh xe để bán kính đúng 0,46 m như cũ; xe dài 4,5 m, rộng 2,2 m.
- **Vật lý theo model:** vị trí 4 bánh (trục trước/sau cách nhau 2,9 m, hai bánh cách nhau 1,88 m), hộp va chạm và các khối cầu thân xe được cập nhật khi model tải xong. Tốc độ tối đa và lực tông giữ như cũ (test: 19,4 m/s, tông Rhino tương đương).
- **Bánh xe:** mesh bánh (`BAN`) được tách thành 4 bánh riêng: quay theo tốc độ, bánh trước đánh lái. Đĩa phanh (`REM`) đi theo hệ treo và đánh lái nhưng không quay.
- **Súng máy:** giữ súng máy trên trụ của Sandcat, đặt sau ghế lái.
- **Dự phòng:** nếu model tải xong muộn, xe tạm dùng hình cũ rồi tự đổi sang Buggy.
- **Chỉnh vị trí:** `SXC_BGT` trong `cars/cars.js`.

### Xe Rhino: model TMV 6x6

- **Nguồn:** `tmv_6x6.glb`. File gốc 21 MB, texture 4096 px; bản trong game `cars/assets/tmv.glb` còn 0,71 MB (texture 1024 px WebP, khoảng 19 nghìn đỉnh).
- **Tách phần:** thân model là một khối liền, nên code cắt theo vùng thành 6 bánh (quay, trục trước đánh lái, nhún theo giảm xóc), vòng khiên tháp súng (xoay ngang) và súng máy đôi (ngóc lên xuống).
- **Súng:** dùng luôn tháp súng đôi trên nóc của model. Hai nòng là hai điểm bắn; chuột trái súng máy, chuột phải đạn pháo như cũ.
- **Kích thước:** phóng ×1,29 để chiều dài, khoảng cách trục và cỡ bánh khớp xe cũ. Hộp va chạm giữ nguyên, tốc độ lái giống hệt (test: 25 km/h sau 3 giây, 33 km/h sau 5 giây, như cũ).
- **Dự phòng:** model tải muộn thì xe tạm dùng hình cũ rồi tự đổi.

### Máy bay phản lực (`jets/`, chỉ map sa mạc)

- **Model của Talon: Su-57**
  - **Nguồn:** `sukhoi_su-57_felon_-_fighter_jet_-_free.glb`.
  - **Thu gọn:** file gốc 23 MB, 40 nghìn đỉnh, texture 4096 px. Bản trong game `jets/assets/su57.glb` còn 0,9 MB, 34 nghìn đỉnh: bỏ 3 bộ UV thừa và tangent, giảm nhẹ đa giác, texture 1024 px WebP, lượng tử hóa đỉnh.
  - **Kích thước:** thu về 16,4 m cho khớp đường cất cánh và va chạm cũ (Su-57 thật dài 20 m). Bánh xe chạm đất đúng độ cao cũ.
  - **Càng đáp:** bộ càng hạ của model co lên bụng khi thu; khi đã thu thì hiện bộ cửa càng khép.
  - **Lửa afterburner:** đặt đúng hai miệng xả động cơ.
  - **Vũ khí:** 4 tên lửa treo dưới cánh; súng bắn ra cạnh buồng lái bên phải.
  - **Vùng trúng đạn:** dựng lại theo thân, cánh, cánh đuôi ngang và hai cánh đuôi đứng nghiêng.
  - **Dự phòng:** nếu model tải xong muộn, Talon tạm dùng hình cũ rồi tự đổi sang Su-57, giữ nguyên số tên lửa còn lại.
  - **Chỉnh vị trí:** `SXJ_SUT` trong `jets/jets.js`.
  - Petrel (máy bay địch) vẫn dùng hình cũ.

- **Model của Harrow: AV-8B Harrier II** (`jets/assets/harrow.glb`, 0,4 MB). Hai cặp miệng phụt tách riêng: thả nổi thì quay xuống, bay bằng cánh thì hướng ra sau, mỗi miệng có lửa. Càng đáp thu lên bụng. Bỏ bom của model, treo 8 tên lửa AGM của game.
- **Model của Petrel (địch): F-2A** (`jets/assets/petrel.glb`, 0,2 MB), sơn lại xám than, bỏ phi công. Mắt cảm biến đỏ trong buồng lái là điểm yếu.
- Tên tác giả các model nằm trong `CREDITS.md` (giấy phép CC-BY yêu cầu ghi), không hiện trong game.

- **Talon:**
  - Đỗ ở đoạn đường xẻ phía tây, khoảng (-68, 6), mũi hướng tây.
  - Cất cánh bằng đường băng: tăng ga, khi qua 158 km/h thì bấm Space hoặc kéo chuột về để ngóc mũi. Ngay sau khi rời đất, hướng ngắm đặt sẵn chếch lên 17°. Phía trước khoảng 230 m có một núi mesa cao 52 m, nên vẫn nên kéo ngắm lên cao thêm.
  - Chậm quá thì mũi chúc xuống và máy bay tụt độ cao.
  - Có afterburner và súng 20 viên/giây (dùng lâu sẽ quá nhiệt). Súng bắn theo mũi máy bay (dấu + vàng), không theo vòng tròn.
  - **Ống ngắm tên lửa (giữ chuột phải, chỉ khi đang bay):**
    - Camera nhìn từ trước buồng lái theo hướng ngắm, zoom khoảng 4×, khung xanh lá, không lọc xám.
    - Vòng tròn giữa màn hình là vùng khoá. Đưa máy bay địch vào vòng: vòng chuyển cam (đang khoá) kèm tiếng bíp, sau 0,6 giây chuyển đỏ và hiện LOCK. Tầm khoá 2.000 m.
    - Chuột trái phóng tên lửa tầm nhiệt vào mục tiêu đã khoá. Chưa khoá thì không phóng, có báo "No lock".
    - Trong ống ngắm chuột chậm lại theo độ zoom, máy bay vẫn tự lái theo hướng ngắm.
    - Khoá được Skua, Petrel và Gull. Ngoài ống ngắm, hình thoi cam chỉ đánh dấu máy bay địch trước mũi, không khoá.
  - 4 tên lửa, mỗi quả trừ khoảng 500 máu khi trúng (Petrel có 950 máu, nên 2 quả hạ một chiếc). R để nạp lại, mất 12 giây.
  - Test: khoá Petrel sau 0,85 giây ở 660 m; 2 quả hạ được.
- **Harrow:**
  - Đỗ trên bãi trực thăng ở Camp Mirage.
  - Khi treo lơ lửng (hover) thì lái như trực thăng. Shift để chuyển sang bay bằng cánh; giữ S khi dưới 115 km/h để quay về hover.
  - **Giữ chuột phải để mở camera ngắm (pod):** zoom khoảng 6×, màn hình xám tương phản cao. Khung chuyển đỏ khi tâm nằm trên mục tiêu.
  - Chuột trái phóng tên lửa AGM dẫn đường vào mục tiêu đó (8 quả, nổ bán kính 8 m). Không có mục tiêu thì tên lửa bay vào điểm mặt đất dưới tâm.
  - Test: từ khoảng 175 m, 4 quả hạ hết 4 ụ súng của Ridge Post.
- **Petrel (địch):**
  - Không có lúc đầu trận. Chiếc đầu tiên tới khi hạ đủ 10 lính robot, chiếc thứ hai khi đủ 20.
  - Bổ nhào xả súng, bắn tên lửa (bắn hạ được), không bay ra ngoài map và không đâm xuống đất.
- **Phím khi bay bằng cánh (lái theo chuột):**
  - Chuột: di chuyển vòng tròn ngắm. Camera nhìn theo vòng tròn, chân trời giữ thẳng. Máy bay tự nghiêng cánh và bẻ lái để mũi (dấu + vàng) đuổi theo vòng tròn: lệch 60° thì khoảng 1,5 giây là bắt kịp.
  - Hướng ngắm giới hạn khoảng 63° lên hoặc xuống. Muốn nhào lộn thì dùng Space/C (dòng dưới).
  - A/D: lăn thân bằng tay, thắng tự lái khi đang giữ phím.
  - W/S: tăng/giảm ga (S khi hết ga trên mặt đất là phanh). Shift: afterburner.
  - **Space/C (nhào lộn):** khi giữ phím, tự lái tắt và bạn điều khiển trực tiếp như kiểu cũ: Space kéo mũi lên hết cỡ, C đẩy xuống, chuột chỉnh ngóc/quay, A/D lăn. Camera bám theo thân máy bay và xoay theo nó.
    - Giữ Space liên tục: vòng lộn tròn, khoảng 3 giây ở 450 km/h.
    - Immelmann: giữ Space tới lúc lộn ngửa ở đỉnh rồi thả. Máy bay tự lật thẳng và bay theo hướng ngược lại.
    - Thả phím: vòng ngắm đặt lại theo mũi, tự lái bật lại.
  - Chuột phải: Talon mở ống ngắm tên lửa, Harrow mở pod. Chuột trái: súng, hoặc phóng tên lửa khi đang ngắm.
  - R: nạp lại tên lửa.
  - Harrow khi treo lơ lửng vẫn lái như trực thăng. Khi mở pod, Harrow tự giữ cánh thăng bằng; đóng pod thì hướng ngắm quay về theo mũi.
- **Xuống máy bay (F):** chỉ được khi đã đáp và dừng, hoặc khi Harrow treo thấp dưới 3,5 m. Máy bay nổ trên không thì người chơi rơi xuống đất và mất 35 máu.
- **Giới hạn bay:** trần khoảng 350 m. Cách tâm map khoảng ±575 m thì máy bay tự quay đầu vào.
- **Cứ điểm địch:** khi đang lái máy bay, cứ điểm tỉnh dậy từ khoảng cách 400 m (đi bộ hoặc đi xe là 150 m), nên bắn được từ xa.
- **Minimap:** máy bay có icon hình máy bay xoay theo hướng bay. Của mình màu xanh; của địch màu đỏ, hiện khi trong vòng 400 m.
- **Chỉnh số liệu:** `SXJ_TUNE` ở đầu `jets/jets.js`.

## menu

Nút "Main menu" có ở menu tạm dừng, màn hình khi chết và màn hình hoàn thành nhiệm vụ. Bấm vào thì game tải lại về màn tiêu đề, vẫn giữ map đang chơi. Đang ở trong phòng multiplayer thì nút này cũng rời phòng và bỏ mã phòng khỏi link (trước đây link còn `?join=`/`?host=` nên tải lại là tự vào lại phòng).

## Va chạm, âm thanh, hiệu năng

- **Va chạm:** mỗi xe, robot, máy bay, robot Sentinel và ụ súng có một khối trụ va chạm (`SOLID` trong `units/units.js`).
  - Hai khối chạm nhau thì bị đẩy ra theo khối lượng. Đâm nhau nhanh hơn 6,5 m/s thì cả hai mất máu.
  - Người chơi đi bộ không xuyên qua được các khối này, và mất máu khi bị đâm nhanh.
  - Xe đang chạy tông được Gull và Hound. Trực thăng va vào Gull thì cánh quạt chém nát Gull.
- **Colossus:** thân không đi xuyên tường, container hay nhà (hàm `SXW_pushOutBoxes`). Bao cát, barie và thùng thấp thì vẫn bước qua.
- **Tiếng động cơ:** hai mẫu âm tổng hợp được thêm vào bảng âm của game (`Go.sx_engine_buggy`, `Go.sx_engine_diesel` trong `cars/cars.js`). Cao độ thay đổi theo vòng tua, có giả lập chuyển số.
- **Hiệu năng:**
  - Cột sáng đánh dấu đồ được vẽ chung theo từng màu bằng instancing, nên mọi cột sáng cùng màu chỉ tốn một draw call.
  - Đồ nhỏ không đổ bóng.
  - Thùng ở xa quá 70 m chỉ hiện cột sáng.
- **Bắn hạ tên lửa:** tên lửa của Colossus và Skua là mục tiêu bắn được, đăng ký qua `U.addTarget` trong `units/units.js`. Đạn mọi loại súng, súng trên xe và rocket đều bắn trúng được. Trúng thì tên lửa nổ trên không, không gây sát thương xuống đất. Vụ nổ phía người chơi (lựu đạn, rocket) cũng phá được tên lửa nằm trong bán kính nổ.
- **Bàn chân Warden:** áp phẳng theo mặt đất (pháp tuyến của địa hình); khi đang nhấc chân thì trở về tư thế thẳng.
- **Colossus:** 4500 máu. Khi người chơi đang lái xe hoặc mech, nó bắn pháo dày hơn (×0,6 thời gian hồi), phóng tên lửa dày hơn (×0,65), pháo mạnh hơn (×1,6) và tên lửa mạnh hơn (×1,4). Khi người chơi đi bộ thì giữ nguyên như cũ.

## Loé sáng khi bắn (`gunfx/`)

- **Vấn đề trước đây:** mỗi phát bắn có gọi đèn loé (`render.lightPool.flash`), nhưng chỉ khoảng 45 đơn vị trong 0,05 s. Tường cách 5 m gần như không đổi màu giữa ban ngày. Đèn lại nằm ở lớp vẽ thế giới (layer 0), còn khẩu súng trên tay vẽ ở lớp riêng (`zc`), nên súng không bao giờ loé theo phát bắn của chính nó.
- **Đèn loé đầu nòng** (màu cam của súng: súng mình, robot, người chơi khác trong phòng): mạnh hơn, tầm xa hơn 40%, sáng ít nhất 0,07 s, giảm sáng **tuyến tính** theo khoảng cách (decay 1). Tường 5–6 m quanh người bắn loé lên, còn vật sát nòng (cột, mái hiên) không bị cháy trắng. Đèn khác (EMP xanh, nổ) giữ nguyên.
- **Đèn riêng cho khẩu súng:** mỗi phát của chính mình bật thêm một đèn chỉ chiếu lớp súng/tay ở đầu nòng, nên súng và găng tay loé theo từng phát; có giảm thanh thì loé yếu hơn.
- **Lửa đầu nòng** hiện lâu hơn một chút: PAC-9 0,05–0,075 s, M7 0,05–0,07 s, KR-12/SR-3 0,07 s (trước 0,035–0,06 s).
- Chỉnh trong `SXF_TUNE` (`gunfx/gunfx.js`). Vẫn 6 đèn của game + 1 đèn cho súng, không ảnh hưởng FPS (60 fps khi test).

## Dao găm (`arsenal/`)

- **Model:** `arsenal/assets/knife.glb`, nén từ `models/knife_animated.glb` ("knife Animated" của DJMaesen: tay đeo găng có xương cầm dao, một đoạn animation; nguồn trong `CREDITS.md`). Từ 17,9 MB còn 0,59 MB (texture 1024 WebP + meshopt, `tools/knife_opt.mjs`; bản nén giữ ở `models/knife_v1_optimised.glb`). Nếu model không tải được thì dùng dao dựng bằng code.
  - Đã thử bản "knife animated" cũ hơn của cùng tác giả (`models/knife_animated_v2.glb`, có 2 đòn chém/đâm) nhưng quay lại bản này.
- **Rút dao:** bấm **V** hoặc **5** (chuột giữa, nút 5 tay cầm cũng được); dao đưa lên từ dưới. Ô "5 Knife" sáng trên HUD, bộ đếm đạn ẩn đi.
- **Cất dao:** bấm **V** lần nữa, hoặc **1–4**, lăn chuột, X để về súng.
- **Chém:** chuột trái, giữ để chém liên tục. Chém liên tiếp thành **chuỗi 3 nhát**, rồi lặp lại; ngừng quá 0,7 s (`SXA_TUNE.knife.combo`) thì bắt đầu lại từ nhát 1:

  | Nhát | Động tác (đoạn trong clip) | Sát thương |
  |---|---|---|
  | 1 | trái → phải: kéo dao sang trái rồi quét qua (1,36–1,51 s), lưỡi dao chạm sau 0,14 s | 75 |
  | 2 | phải → trái: nhát chém gốc (chém 2,04–2,18 s rồi tay về 2,18–2,72 s), chạm sau 0,13 s | 75 |
  | 3 | **y nguyên động tác của phím R** (2,72–4,3 s, tốc độ gốc, dài 1,58 s); chạm 2 lần: cú hất dao lên cầm ngược (0,08 s) và cú lật về quét lưỡi qua (0,75 s) | 60 mỗi lần |

  - Nhát 1 và 2 chống giật: phần chém phát ở 70% tốc độ, vài phần trăm giây cuối phanh dần về 0 thay vì dừng phắt (`'out'`), khúc đứng im sau cú chém bị cắt. Đo vị trí lưỡi dao từng khung: đỉnh 13–16 cm/khung, tốc độ giữa 2 khung liền nhau đổi tối đa 9 cm.
  - Lính robot 120 máu chết sau 2 nhát (giữ chuột: khoảng 0,55 s).
- **R:** xoay dao ngắm nghía (cùng đoạn 2,72–4,3 s nhưng không gây sát thương). Bấm chém lúc đang xoay thì nhát chém bắt đầu từ đúng tư thế đang hiện.
- **Các đoạn animation** trong `SXA_TUNE.knife.clip`: rút dao 4,54–4,83 s; đứng yên 0–1,33 s (lặp; đoạn 1,36–1,64 s ngay sau là một nhát chém nhanh nên bị loại khỏi vòng lặp); xoay dao 2,72–4,3 s. Vào nhát chém hoà trộn 0,06 s, ra hoà trộn 0,18 s về tư thế đứng yên (đường cong mượt; bộ tay pha được 3 tư thế nên nhát mới luôn bắt đầu từ hình đang hiện). Vị trí bộ tay so với mắt: `SXA_TUNE.knife.vm`.
- **Sát thương:** theo nhát (bảng trên), trúng đầu ×2,2, tầm 2,1 m. Mỗi lần chạm quét một vòng cung trước mặt, nhắm ngang ngực trước. Người chơi khác trong phòng nhận × `pvpScale` (0,6).
- Chém hụt vào tường có tia lửa, không để lại lỗ đạn. Bảng kill ghi "WITH KNIFE".

## Súng: độ giật, súng tỉa, phụ kiện

- **Red dot trên súng lục M7 = ống ngắm của PAC-9** (`pac9Sight` trong `arsenal/arsenal.js`): lấy đúng các tam giác của cụm ống ngắm trên PAC-9 (đế kẹp, vỏ lục giác, khung trước, núm chỉnh, ốc) cùng mặt kính của nó (shader vẽ chấm đỏ ở vô cực theo trục ống ngắm, nên đặt ở đâu cũng đúng tâm), thu nhỏ 80% cho vừa thân trượt (`PAC9_SIGHT.k`), gắn lên thân trượt nên giật theo khi bắn. Nếu không lấy được (model lỗi) thì dùng red dot đơn giản.
- **Holo trên M7:** mặt kính trong suốt hơi ngả màu, vòng tròn + chấm đỏ ở đúng đường ngắm (`SXA_reticle`). Trước đây kính của holo và red dot là một tấm đặc nên ngắm vào thì che kín tầm nhìn.
- **Độ giật:** mạnh hơn trước.
  - PAC-9 đi qua các hệ số trong `SXA_RMOD`, patch vào code gốc. Hệ số cơ bản nằm ở `SXA_TUNE.recoil`.
  - Bắn liên thanh 1 giây thì nòng hất lên khoảng 4,7°, so với 1,4° ở game gốc. Nòng không tự hạ về chỗ cũ (`Mt.recoilKeep` = 0,45).
  - Shotgun, súng ngắn và súng tỉa cũng giật mạnh hơn.
- **SR-3 Albatross (súng tỉa, phím 4):**
  - Khoá nòng kéo tay, băng 5 viên, sát thương 118 (×2,2 khi trúng điểm yếu).
  - Gắn sẵn ống ngắm 8x. Ngắm vào ống thì có màn hình ống ngắm và rung do thở; ngồi xuống thì rung ít hơn.
  - Nhặt trên map (gần relay A) hoặc ở Radar Station.
- **Phụ kiện:** hộp có cột sáng tím. Đi qua là tự lắp lên súng phù hợp, ưu tiên súng đang cầm (`SXA_ATT`, `SXA_COMPAT`).

  | Phụ kiện | Hiệu ứng | Lắp được cho |
  |---|---|---|
  | Red dot, Holo | Thước ngắm gọn hơn | M7 (shotgun KR-12 không gắn ống ngắm nào) |
  | Ống 4x | Zoom 4x | PAC-9 (ống ACOG thay chỗ red dot), SR-3 |
  | Ống 8x | Zoom 8x | SR-3 |
  | Giảm thanh | Gần như không lửa đầu nòng, tiếng nhỏ, địch chỉ nghe thấy trong khoảng 9 m | PAC-9, M7, SR-3 |
  | Bù giật | Giật −28%, lệch ngang −40% | PAC-9, SR-3 |
  | Băng mở rộng | ×1,5 số viên (shotgun +3) | PAC-9, M7, SR-3, KR-12 |
  | Tay cầm | Giật −18%, toả đạn −15% | PAC-9, KR-12 |
  | Báng súng (STK) | Giật −20%, lệch ngang −30%, toả đạn −8% | PAC-9, KR-12, SR-3 |

  - Các món giảm giật cộng dồn: test PAC-9 bắn liên tục 1 giây, nòng nảy 4,7° khi không có gì; báng 4,0°; báng + tay cầm 3,3°; báng + tay cầm + bù giật 2,3° (giảm khoảng một nửa).
  - Báng súng không có hình trên súng (phần báng nằm sau camera, gần như không thấy ở góc nhìn thứ nhất); HUD súng hiện chữ STK.
  - **Rải ngẫu nhiên trên map** (mọi map; chỉnh ở `SXA_TUNE.gear`): quanh các chỗ ẩn nấp, điểm robot xuất hiện và chỗ đặt đồ, mỗi món cách nhau ít nhất 4 m, không nằm trong vật cản (không rải dưới nước). Số lượng: 8 món khi chơi một mình, mỗi người thêm vào phòng có thêm 3 món, tối đa 32 (phòng 3 người: 14). Khoảng 1/5 số món luôn là ống 4x (ít nhất 1), còn lại chọn ngẫu nhiên theo tỉ lệ (4x, giảm thanh, băng mở rộng nhiều hơn; 8x ít hơn).
    - Mỗi ván rải lại chỗ mới. Trong phòng, mọi máy thấy cùng một bố trí (tính từ mã phòng và số ván); chơi một mình thì mỗi lần một khác.
    - Các vị trí phụ kiện cố định cũ của map được bỏ, thay bằng các món ngẫu nhiên. Cứ điểm ở Dust Basin (Camp Mirage, Fuel Depot) vẫn có đồ riêng; lính robot cũng có thể rơi ra.

- **Túi phụ kiện:**
  - Mỗi loại phụ kiện mang dự phòng tối đa 3 cái (`SXA_TUNE.spareMax`). Túi đầy thì phụ kiện bị thay rơi xuống cạnh bạn như trước.
  - Ống ngắm không bao giờ tự thay ống đang lắp trên súng: nếu không có khe trống thì nó vào túi.
  - Phụ kiện khác (giảm thanh, tay cầm, băng đạn) thay vào súng đang cầm, món cũ vào túi.
  - Nhặt được súng mới (shotgun, SR-3) thì súng tự lấy phụ kiện hợp từ túi lắp vào các khe trống.
- **Đổi scope (B):** đổi qua lại giữa các ống ngắm của súng đang cầm, gồm ống đang lắp và ống trong túi.
  - PAC-9: 4x ↔ red dot gắn sẵn.
- **Ống 4x của PAC-9 = ống ngắm kiểu ACOG** (`arsenal/assets/scope4x.glb`, model "4x Scope" của Monstr 3d, CC-BY-4.0, 0,12 MB; chỉnh ở `SXA_TUNE.scope4x`):
  - Gắn lên ray đúng chỗ red dot; red dot gắn sẵn của PAC-9 được tháo ra (cắt khỏi thân súng) khi ống 4x đang lắp, bấm B về RDS thì red dot hiện lại.
  - Kích thước, trục ngắm và chân đế tính từ hình khối của model (trục đi qua 2 mặt kính, chân đế là điểm thấp nhất); kính của model đổi thành kính phủ tối.
  - Ngắm hẳn thì vào khung ngắm riêng kiểu ACOG: ô tròn rộng có vành thị kính tối, chữ V đỏ ở giữa, cột vạch bù đạn bên dưới, 2 vạch ngang ngắn; cảnh phóng 4x. Không dùng khung ngắm đen của súng tỉa.
  - Súng trường không lắp được ống 8x (8x chỉ cho SR-3): nhặt 8x khi đang cầm PAC-9 thì vào balo.
  - SR-3: 8x ↔ 4x (súng tỉa luôn giữ một ống ngắm).
  - M7: red dot ↔ holo ↔ ngắm sắt. KR-12 (shotgun) không có ống ngắm, bấm B chỉ báo không có ống khác.
  - Dòng phụ kiện trên HUD có gợi ý `B ⇄ 4X` cho biết bấm B sẽ chuyển sang ống nào.
  - Tay cầm dùng R3, điện thoại dùng nút OPT.
- **Phím:** 1–4 chọn súng, 7/8/9 dùng túi máu (đã chuyển từ 4/5/6), B đổi scope.

## Hiệu năng (`perf/`)

- **Tự chỉnh chất lượng (có sẵn trong game gốc, chế độ Quality "auto" mặc định):** khung hình chậm hơn khoảng 21 ms thì hạ độ phân giải (tối thiểu 60%); vẫn chậm thì hạ preset ultra → high → medium → low; máy rảnh thì tự nâng lại. Chọn tay một mức trong Settings thì game giữ đúng mức đó.
- **Phần mod tự làm gọn (`perf/perf.js`, chạy vài lần mỗi giây, không chạy mỗi khung hình):**
  - Đồ nhặt chỉ vẽ model trong 35 m (nhìn qua ống ngắm thì 160 m); xa hơn vẫn thấy cột sáng. Đồ nhặt không đổ bóng.
  - Các lưới cùng chất liệu trong một model đồ nhặt được gộp làm một (súng nằm đất 8–12 lưới, balo 12–15 lưới → 1–3), dùng chung cho mọi bản sao.
  - Chi tiết nhỏ hơn 0,3 m không đổ bóng nữa (không thấy khác trên bóng, nhưng mỗi cái tốn một lần vẽ bóng).
  - Chơi mạng: danh sách mục tiêu cho robot dựng một lần mỗi khung hình thay vì mỗi robot một lần; tên trên đầu không tạo vector mới; bảng danh sách phòng cập nhật 4 lần/giây.
- **Giới hạn chống làm nặng game:** đồ rơi trên đất tối đa 24 món (đầy thì bỏ món robot rơi cũ nhất trước, đồ người chơi tự vứt bỏ sau cùng). Khói, tia lửa, mảnh vỡ, đèn nổ dùng bộ đệm cố định của game gốc. Lựu đạn bị giới hạn bởi động tác ném và ngòi nổ; C4 chỉ cài một khối mỗi lúc. Gói tin mạng bị giới hạn tần suất (xem phần chống gian lận).
- **Đo (headless, 1280×720, trung bình 8 giây):**

  | Cảnh | Lần vẽ trước → sau | Khung 1% chậm nhất (ms) | Khung tệ nhất (ms) |
  |---|---|---|---|
  | Port, chơi thường | 775 → 616 | 18,3 → 17,7 | 39 → 37 |
  | Port, 3 tốp lính + nổ liên tục | 862 → 703 | 18,3 → 18,2 | 19 → 22 |
  | Desert, chơi thường | 556 → 465 | 18,1 → 18,5 | 40 → 39 |
  | Desert, 3 tốp lính + nổ liên tục | 604 → 512 | 22,2 → 19,2 | 24 → 20 |
  | Desert, bay Talon thấp + Petrel, Skua, Colossus | 251 → 241 | 21,5 → 18,9 | 54 → 22 |
  | Phòng 3 người (máy host), khách chạy và bắn | 560 → 457 | 18,6 → 18,0 | 25 → 21 |

  Port gốc (chưa mod) đã nặng sẵn: khoảng 2,5 triệu tam giác, 442 lần vẽ; phần mod giờ chỉ thêm khoảng 170 lần vẽ thay vì 330.
- **Chỉnh:** `SXP_TUNE` trong `perf/perf.js` (bán kính hiện đồ nhặt, ngưỡng chi tiết nhỏ), `SXA_TUNE.maxDrops` trong `arsenal/arsenal.js`.

## Balo, tên vật phẩm, súng tỉa mới

- **Balo (Tab, điện thoại: nút BAG):** mọi thứ mang theo chiếm chỗ (túi quần 200 khi chưa đeo balo):
  - Đạn mỗi viên: PAC-9 0,5; M7 0,4; KR-12 và SR-3 1. Lựu đạn Frag / EMP / C4: 12 / 12 / 15. Túi máu nhỏ / thường / lớn: 2 / 10 / 20. Phụ kiện dự phòng 6–15.
  - Giáp đang mặc, súng và phụ kiện đã lắp không tính. Đồ mang sẵn lúc đầu chiếm 147/200.
  - **Balo theo cấp:** không đeo balo thì có túi quần 200; nhặt Balo Lv.1 / Lv.2 / Lv.3 thì sức chứa lên 260 / 320 / 380 (+60 / +120 / +180, `SXA_TUNE.bag.caps`). Balo tốt hơn thay balo đang đeo (balo cũ rơi xuống chân), balo bằng hoặc kém hơn thì bỏ qua. Nút **Take off** trong bảng Tab để cởi balo, chỉ được khi đồ còn vừa túi quần 200 ("Too full to take off"). Balo có ở mọi map (Lv.1 nhiều, Lv.3 hiếm) và các cứ điểm; lính robot thỉnh thoảng rơi Lv.1/Lv.2, boss luôn rơi Lv.3. Hình balo vẽ bằng khối: Lv.1 olive, Lv.2 cát, Lv.3 đen, có nhãn "LV.n". Chơi online chết là mất balo như mất giáp.
  - **Phụ kiện lắp cho súng nào:** tên trên đất, thẻ nhặt và bảng balo đều ghi (ví dụ "4x scope · PAC-9, SR-3"); súng bạn có thì sáng, chưa có thì mờ, ghi "no gun for it" nếu không súng nào của bạn lắp được. Dưới mỗi súng trong bảng ghi các ô còn trống và phụ kiện vừa (★ là món đang có trong balo).
  - Thanh balo cạnh ô súng luôn hiện dung lượng đã dùng, chuyển đỏ khi trên 90%. Balo đầy thì không nhặt thêm (thông báo "Backpack full — … needs N").
  - Bảng balo: xem từng loại, số lượng, chỗ chiếm, đồ đang trang bị. **Drop** / **All** (hoặc chuột phải vào dòng) để vứt ra trước mặt; đồ nằm đó 3 phút, muốn nhặt lại thì bước ra xa khoảng 3 m rồi đi qua.
  - Đóng bằng **Tab**, nút **×** hoặc bấm ra ngoài bảng. **Esc không đóng balo** (đóng bằng Esc thì trình duyệt không khoá lại chuột được và game rơi vào menu tạm dừng).
  - Khi mở balo thì không bắn được, chuột được thả ra để bấm; game không dừng. Chỉnh số: `TU.bag` trong `arsenal/arsenal.js`.
- **Đạn theo cỡ (kiểu PUBG):** đạn nằm trong balo theo từng cỡ: 5.56 (PAC-9, sọc xanh lá), 12 GA (KR-12, sọc đỏ), .50 AE (M7, sọc vàng), .338 (SR-3, sọc xanh dương).
  - Đạn dự trữ của súng chính là số đạn cùng cỡ trong balo: nạp đạn lấy từ đó, HUD hiện đúng số đó. Mang được đạn cho súng chưa có; nhặt súng mới thì được thêm vài băng đạn của nó nếu balo còn chỗ.
  - Hộp đạn trên đất ghi cỡ và súng dùng (ví dụ ".338 ×5 · SR-3"); mỗi hộp: 5.56 ×30, 12 GA ×6, .50 AE ×12, .338 ×5. Thùng "Mixed ammo crate" ở cứ điểm và trên map cho đạn của các súng bạn đang có.
  - Lính robot rơi đúng cỡ đạn của súng nó cầm (súng trường → 5.56, xạ thủ → .338, lính nặng → 12 GA hoặc 5.56); drone và chó rơi ngẫu nhiên (nhiều nhất 5.56); boss rơi đủ bốn cỡ.
  - Trong bảng Tab mỗi cỡ đạn là một dòng riêng, ghi súng dùng nó, vứt ra thành hộp đạn đúng cỡ. Chơi online chết thì đạn về lại số khởi đầu (5.56 ×150, .50 AE ×48).
- **Tên vật phẩm:** hiện tên và khoảng cách trên tối đa 4 món trong vòng 6 m, cộng món đang nhắm vào xa tới 35 m; bị tường che thì ẩn.
- **Thông báo nhặt đồ:** thẻ có hình ở góc trái dưới ("Picked up · 4x scope → PAC-9", "+30 PAC-9", "Dropped").
- **SR-3 dùng model mới** (`arsenal/assets/sniper.glb`, 0,6 MB): khoá nòng kéo lên, kéo lùi và văng vỏ đạn sau mỗi phát; băng đạn rút ra khi nạp; ống ngắm của model dùng cho cả 8x và 4x; súng nằm dưới đất cũng dùng model này.

## Mũ và áo giáp

`SXA_ARMOR` trong `arsenal/arsenal.js`. Đi qua là tự mặc (cột sáng màu vàng nhạt).

| Món | Giảm sát thương | Độ bền |
|---|---|---|
| Mũ Lv.1 / Lv.2 / Lv.3 | 15% / 22% / 30% | 80 / 150 / 230 |
| Áo Lv.1 / Lv.2 / Lv.3 | 25% / 35% / 45% | 100 / 170 / 250 |

- **Cộng dồn:** đội cả mũ và áo thì giảm gộp lại. Lv.1 + Lv.1 giảm 36%, Lv.2 + Lv.2 giảm 49%, Lv.3 + Lv.3 giảm 61%.
- **Độ bền:** mỗi điểm sát thương giáp chặn được làm mất 3 điểm độ bền (`SXA_TUNE.armor.wear`). Hết độ bền thì giáp vỡ và có cảnh báo.
- **Khi nào mặc món mới:** cấp cao hơn, hoặc cùng cấp nhưng món đang mặc đã mòn dưới 70%. Còn lại thì báo "Already wearing …" và không nhặt.
- **Trong xe hoặc máy bay:** giáp không tác dụng, vì xe chịu sát thương thay.
- **HUD:** hai ô ngay trên thanh máu, hiện cấp (Lv1 trắng, Lv2 xanh, Lv3 vàng) và thanh độ bền. Thanh chuyển đỏ khi còn dưới 25%.
- **Vị trí:**
  - Mũ và áo Lv.1 ở ngay điểm xuất phát.
  - Lv.2 ở relay A và B, áo Lv.3 ở relay C, mũ Lv.3 ở điểm rút quân.
  - Map sa mạc: Camp Mirage có thêm Lv.2. Chiếm Ridge Post được mũ Lv.3, Radar Station được áo Lv.3, Fuel Depot được cả hai.
  - Đồ trên map hồi lại sau 150 giây.
- **Rơi từ địch:**
  - Lính Heavy rơi áo Lv.2 (32%), Marksman rơi mũ Lv.2 (28%), Trooper thường đôi khi rơi đồ Lv.1 (10%).
  - Robot khổng lồ và gunship rơi một món Lv.3.
- **Hiệu quả (test đứng giữa trống 12 giây trước 3 lính):** không giáp còn 2–16 máu, Lv.2 còn 29–51, Lv.3 còn 39–48.
