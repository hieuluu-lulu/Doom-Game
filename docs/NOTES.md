# DoomZone — ghi chú kỹ thuật

Ghi chú chi tiết từng phần (map, súng, robot, chơi mạng, công cụ xử lý model). Phần giới thiệu ngắn: [README](../README.md).

Mã nguồn đầy đủ của game **DoomZone**: game gốc (đã mở ra dạng dễ đọc) cùng mọi phần mod. Kết quả build chỉ nằm trong `dist/` của thư mục này, đặt tên `index.html` để host tĩnh (GitHub Pages, Vercel) mở ngay ở địa chỉ gốc. Có hai kiểu build:

- **Mặc định (tách file):** `dist/index.html` (trang + code) và `dist/assets/` (model, texture). Phải chạy qua web server. Mỗi map chỉ tải model mình dùng, và trình duyệt giữ lại model giữa các lần cập nhật. Xem [Tải model theo map](#tải-model-theo-map-distassets).
- **`--single`:** mọi thứ nhúng vào một file `dist/index.html`, mở thẳng bằng trình duyệt, chơi offline được (chỉ chơi mạng mới cần internet). Thêm `--copy` để chép file đó ra `../doomzone.html` (`--copy` tự bật `--single`).

```bash
cd tools && npm install && cd ..       # một lần: esbuild (nén code) + công cụ xử lý model
python3 -I build.py                     # bản phát hành: code được nén → dist/index.html + dist/assets/
python3 -I build.py --single            # bản một file, chạy offline
python3 -I build.py --debug             # code để nguyên, dễ dò lỗi trong DevTools
python3 -I build.py --features arsenal --out /tmp/t/index.html   # build thử riêng một phần (assets/ nằm cạnh file)
cd dist && python3 -m http.server 8000  # chạy thử bản tách file: http://localhost:8000/
```

## Cấu trúc

| Thư mục / file | Nội dung |
|---|---|
| `game/shell.html` | Khung trang; `/*@@CSS@@*/` và `//@@JS@@` là chỗ build chèn CSS và code, `/*@@PRELOAD@@*/` (trong `<head>`) là chỗ chèn `game/preload.js`. |
| `game/preload.js` | Script nhỏ chạy đầu tiên: bắt đầu tải model của map đang chọn, hiện MB trên thanh loading, đăng ký service worker (bản tách file). |
| `game/sw.js` | Mẫu service worker; build ghi ra `dist/sw.js` kèm phiên bản và danh sách file (chơi offline, cài như app). |
| `game/style.css` | CSS của game gốc. |
| `game/favicon/` | Biểu tượng tab và màn hình chính (`doomzone-32/64/180.png`: chữ DOOM cam trên ZONE trắng, font logo Big Shoulders Display, nền tối). Build nhúng thẳng vào `<head>` chỗ `<!--@@ICON@@-->` trong `game/shell.html`. `doomzone-192/512.png` và `doomzone-512-maskable.png` (nền phủ kín, chữ nằm trong vùng an toàn 80 % cho icon Android) được chép ra `dist/icons/` cho manifest. Vẽ lại bằng `node tools/favicon.cjs game/favicon`. |
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

- **Dung lượng:** `dist/index.html` khoảng 2,4 MB (0,8 MB khi web server nén gzip), `dist/assets/` khoảng 13,5 MB (35 file). Bản `--single` khoảng 20 MB vì model nhúng dạng base64 (to hơn file gốc 1/3).
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
| `assets/*` | File nhị phân (model, texture). Code đọc mỗi file dưới dạng chuỗi base64 `SX_ASSET_<tên file>`. Bản tách file chép chúng ra `dist/assets/`, bản `--single` nhúng thẳng vào script. |

Thứ tự build nằm ở `FEATURES` trong `build.py`. `common/` luôn build đầu tiên (kể cả khi dùng `--features`): GLTFLoader của three.js r180 (`common/lib/10_gltfloader.js`, đã sửa để dùng three.js có sẵn trong game), các hàm đọc model/ảnh `SX_parseGLB`, `SX_image`, `SX_timeout`, phần tải model theo map (`SX_bootAssets`, `SX_afterAssets`), và bước chuyển cài đặt cũ.

## Tải model theo map (`dist/assets/`)

Trước đây mọi model nằm trong một file `index.html` 20 MB (khoảng 13 MB sau gzip): map nào cũng tải hết, và mỗi lần deploy người chơi tải lại cả 13 MB dù chỉ sửa một dòng code. Mỗi lần push cũng thêm khoảng 10 MB vào lịch sử git.

- **Build (`build.py`):** mỗi file trong `<feature>/assets/` được chép ra `dist/assets/<tên>.<hash 10 ký tự>.<đuôi>`. Tên có hash theo nội dung, nên file không đổi thì giữ nguyên tên và trình duyệt dùng lại bản đã lưu; file đổi thì tên mới, không bao giờ lẫn bản cũ. File cũ không còn dùng được tự xoá khỏi `dist/assets/`. Danh sách `[tên, đường dẫn, số byte, feature]` được ghi vào `game/preload.js`.
- **Tải sớm (`game/preload.js`, trong `<head>`):** chạy trước khi code game (2,4 MB) tải xong. Script đọc map đang chọn (cùng quy tắc với `SX_MAP`: `?map=` rồi đến `localStorage`), bắt đầu tải các file map đó cần (song song) và hiện "Downloading models x / y MB" trên thanh loading, chiếm 40% đầu thanh.
- **Map nào tải gì:** file của `desert`, `aircraft`, `cars`, `jets` chỉ tải ở map sa mạc, file của `crossroads` chỉ tải ở Crossroads (bảng `ONLY` trong `game/preload.js`). File của mọi feature khác (`arsenal`, `troopers`…) tải ở mọi map. `?show=` tải tất cả.
- **File mượn của map khác (bảng `ALSO`):** nhà kiểu Crossroads ở sa mạc (`houses/`) dùng model căn hộ `cx_oldap` và texture gạch `cx_skin_oabrick` của Crossroads (0,3 MB). Ở sa mạc hai file này tải muộn; Crossroads vẫn tải chúng như cũ.
- **Tải muộn (bảng `LATE` trong `game/preload.js`: `aircraft`, `cars`, `jets`):** các model trực thăng, xe, máy bay (6,1 MB) không bắt boot chờ. Chúng tải ngầm ngay sau boot (`SX_assetLater` trong `common/common.js`). Trong lúc chờ, xe và máy bay dùng hình dựng bằng code; model về thì tự thay (các đoạn "swap the look" có sẵn trong `aircraft/`, `cars/`, `jets/`). Các hàm `SXH_gzStart`, `SXC_bgStart`, `SXJ_suStart`… chờ `SX_assetLater(tên, SX_ASSET_tên)` thay vì báo hỏng ngay. Bản `--single` có sẵn chuỗi nên chạy như cũ.

  | Map | Phải chờ trước khi vào | Tải ngầm sau đó | Lần đầu tổng cộng (cả trang) |
  |---|---|---|---|
  | Cảng, Waterworks | 4,9 MB (14 file) | — | ≈ 5,7 MB |
  | Crossroads | 7,0 MB (27 file) | — | ≈ 7,7 MB |
  | Sa mạc | 5,0 MB (15 file) | 6,4 MB (9 file) | ≈ 11,9 MB, nhưng chỉ chờ ≈ 5,8 MB |

  Lần sau, kể cả sau khi deploy bản sửa code: chỉ tải lại khoảng 0,8 MB của `index.html`, cộng với model nào vừa đổi.
- **Boot (`SX_bootAssets` trong `common/common.js`, gọi đầu `QC()` ở `game/js/90_boot.js`):** chờ các file tải xong, đổi mỗi file sang base64 và gán vào `window.SX_ASSET_<tên>`, đúng chuỗi mà bản `--single` nhúng sẵn. Nhờ vậy code các feature không phải sửa. `Nr` (`game/js/10_game.js`) xếp các bước boot vào 60% còn lại của thanh.
- **Lỗi tải:** mỗi file thử lại 1 lần. File vẫn lỗi (404, mất mạng, mở bằng `file://`) thì feature đó dùng hình dựng bằng code như khi thiếu model, và console báo `[assets] <tên> not loaded`. Nếu tải đứng yên 30 giây (`SX_BOOT_TUNE.stallMs`), game boot luôn với phần đã có.
- **Code chạy ngay lúc nạp script** (trước `QC()`) mà đọc `SX_ASSET_*` thì phải bọc bằng `SX_afterAssets(fn)`: bản `--single` chạy `fn` ngay, bản tách file chạy sau khi tải xong. Hiện chỉ có `CXR_glbStart` (`crossroads/crossroads.js`). Nếu quên, console báo `[assets] <tên> read before it was downloaded` (getter đặt trong `game/preload.js`). Trước khi sửa, lỗi này làm Crossroads mất toàn bộ model nhà, cửa hàng, đường phố mà không báo gì.
- **Thêm model mới:** đặt vào `<feature>/assets/` như trước. Nếu chỉ một map dùng feature đó, thêm feature vào bảng `ONLY` trong `game/preload.js`.
- **Đã kiểm tra (Chrome headless, qua `python3 -m http.server`):**
  - Cả 4 map ra đúng số mesh và tam giác như bản `--single`.
  - Mỗi map chỉ tải đúng nhóm file của mình.
  - Mạng 8 Mbit/s: thanh chạy từ 0,6 s. Sa mạc vào game sau 11,9 s (bản debug, HTML 3,6 MB chưa nén); các model tải muộn về tới giây 15 và được thay vào, cảnh cuối cùng ra đúng 967 mesh như bản `--single`.
  - Chặn shotgun (404): game vẫn boot, dùng shotgun dựng bằng code.
  - Mở bằng `file://`: boot được với hình dựng bằng code.

### Chơi offline, cài như app (`game/sw.js`, `offline/`)

- **Build tách file ghi thêm:** `dist/sw.js` (từ `game/sw.js`, điền phiên bản = hash của trang + danh sách file), `dist/manifest.webmanifest` (tên, màu nền, `display: fullscreen`, xoay ngang, icon 192/512/maskable) và `dist/icons/`. Trang có thêm `<link rel="manifest">` và các thẻ meta cho iOS. Bản `--single` không có các file này; build `--single` vào `dist/` thì xoá chúng.
- **Service worker** (`game/preload.js` đăng ký sau sự kiện `load`, chỉ khi chạy qua http/https):
  - Trang: lấy từ mạng trước, mất mạng thì dùng bản đã lưu (mọi `?query` dùng chung một bản). Nhờ vậy bản deploy mới hiện ra ngay lần tải sau.
  - `assets/…`: lấy từ bộ nhớ trước (tên có hash, không bao giờ đổi). Google Fonts cũng vậy.
  - PeerJS, STUN và mọi thứ khác: không đụng tới. Chơi mạng vẫn cần internet.
  - Mỗi bản build đổi phiên bản, trình duyệt cài worker mới, worker mới thay ngay và xoá các model mà bản mới không còn dùng.
- **Lần đầu vào:** model tải trước khi worker chạy, nên sau khi tải xong cả file muộn, `SXL.warm()` lấy lại các file của map đó qua worker (từ HTTP cache, không tải lại) để chúng vào bộ nhớ offline. Kết quả: map nào đã chơi thì mở được khi mất mạng.
- **Settings → "Offline play"** (`offline/offline.js`): ghi những map đã mở được offline ("Offline: Port, Waterworks (2/4 maps)"), nút **Save all maps · x MB** tải nốt các file còn thiếu, và nút **Install app** khi trình duyệt cho cài (Chrome, Edge, Android). iPhone/iPad: Safari → Chia sẻ → Thêm vào MH chính.
- **Đã kiểm tra** (Chrome headless qua `http://127.0.0.1`): lần đầu vào map cảng, worker lưu 14 file, trang và 3 file font; tắt mạng rồi tải lại thì game vẫn mở, không cảnh báo; Settings ghi 2/4 map; bấm Save all (7,9 MB) thì đủ 4/4 map (35 file); tắt mạng rồi vào sa mạc thì đủ model thật (967 mesh).

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
  - **Ẩn HUD khi bị hạ:** trong phòng, khi đang xem đồng đội (đấu đội) hoặc chờ hồi sinh (free-for-all), class `body.sxn-down` (`SXN_downClass` trong `net/net.js`) ẩn tâm ngắm, máu, đạn, la bàn, đồ trong người, minimap, điểm đánh dấu trên màn hình và khẩu súng trên tay (CSS cuối `net/net.css`). Hồi sinh thì hiện lại.
    - Vẫn giữ: bảng kill, tin nhắn, nhiệm vụ, điểm đội/ván, danh sách người chơi, thanh "Spectating …" và đồng hồ hồi sinh.
    - Khi camera theo đồng đội thì bỏ lớp màu đỏ máu thấp của mình (`G.render.post.lowHealth/damage = 0` ngay trước khi vẽ). Lúc đếm ngược hồi sinh vẫn giữ lớp đỏ như hiệu ứng chết.
    - Đã thử: 3 trình duyệt headless qua PeerJS, đấu đội (bị hạ → xem đồng đội → ván sau HUD hiện lại) và free-for-all (bị hạ → đếm ngược → hồi sinh).
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
- **Bạn bè cần gì:** cùng bản game (cùng link nếu đã deploy, hoặc file của bản `--single`) và có internet.
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
- **Cứ điểm:** lính gác lớn ở cứ điểm cũng chờ tới mốc tương ứng: Colossus (Ridge Post, Sunken Wells, Bunker Line) từ 5, Skua (Radar Station, West Quarry) từ 15.
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
- **Nạp đạn từng viên:** súng nghiêng sang phải và kéo lại gần cho thấy cửa nạp dưới hộp khoá nòng. Tay trái rời pump, cầm viên đạn đỏ (mesh `slug` có sẵn trong model) đưa lên cửa nạp, đẩy vào lúc 0,27 s của mỗi viên (lúc đó mới cộng đạn), rồi hạ xuống lấy viên tiếp; nạp xong tay về lại pump. Bắn giữa chừng thì dừng nạp như cũ. Chỉnh đường tay ở `SXA_TUNE.shotgunModel.load` (`pick`: chỗ lấy đạn, `entry`: chỗ bắt đầu đẩy, `push`: đoạn viên đạn trượt vào), tư thế súng ở `reload` trong `SXA_shotgunGeoModel` (`loadHand` trong `arsenal/arsenal.js`).
- **Ngắm (ADS):** nhìn dọc thân súng tới đầu ruồi ở mũi nòng (`beadY`). Shotgun không gắn ống ngắm nào (kể cả red dot/holo), chỉ ngắm bằng đầu ruồi; băng mở rộng là đoạn nối dài ống tiếp đạn, gắn ở đầu ống (`magZ`, `magY`).
- **Độ sáng:** texture màu của model rất tối (trung bình 30/255) và độ kim loại cao, nên dưới ánh sáng game súng gần như đen. `SXA_TUNE.shotgunModel.look` nhân màu lên (`bright` 2,4) và hạ độ kim loại (`metal` 0,5), súng thành màu thép xám xanh.
- **Chữ khắc trên súng:** hai mặt phẳng bên hông hộp khoá nòng có chữ "KR-12 BREAKWATER" và dòng nhỏ "12 GA · PUMP · DOOMZONE ARMS", vẽ bằng canvas (font Big Shoulders của HUD) lên một tấm mỏng. Bên trái đọc từ nòng về báng, bên phải đọc ngược lại, nên không bị lật. Có cả trên súng cầm tay lẫn súng nằm đất. Chỉnh chữ, vị trí, cỡ ở `SXA_TUNE.shotgunModel.engrave` (`SXA_engrave` trong `arsenal/arsenal.js`).
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
- **Chi tiết:** tường bê tông đổ ván khuôn (đường ghép ván, lỗ ty), rêu và vệt bẩn chân tường, vệt rỉ dưới mép tường; hàng rào lưới + dây thép gai trên đỉnh tường bao; sàn có đường cắt mỗi 3 m, rãnh thoát nước có nắp lưới, nắp cống, vết dầu; đáy bể có vệt rong ở mép nước và bùn ở đáy, mặt nước có váng trôi; bồn lắng có mối hàn, cửa người chui, ống nhánh có van, thước đo mực nước, cầu gạt bùn và bộ truyền động trên nóc; khung thép có giằng chéo, đèn pha treo, móc cẩu; hành lang có máng cáp, tủ vòi chữa cháy, van tay, đèn có lồng bảo vệ, số khoang B-01…B-08; sảnh bơm có ốp chân tường, vì kèo thật, khung ô kính, máy bơm có bệ thép, khớp nối, đồng hồ áp, van tay, ống luồn dây, tủ điện MCC có biển điện áp, cửa cuốn. Đồ mỏng chỉ để nhìn; đồ nhô ra có va chạm (mục dưới).
- **Va chạm cho đồ gắn tường** (`kitCol` / `kitShot` trong `waterworks/waterworks.js`): đồ nhô ra khỏi tường, bồn hoặc máy bơm giờ có hộp va chạm riêng, nên đạn dừng ở đó và không đi xuyên qua được nữa. Thêm 96 hộp (249 → 344).
  - Chặn cả người lẫn đạn (`kitCol`): 32 cột ốp tường bao, tủ vòi chữa cháy, tay van trên đường ống và trạm van, van cụm ống trong bể, hộp điện ở sân đội, cửa thăm và ống nhánh của bồn lắng, cút hút của máy bơm. Không tính vào lưới đường đi (`noNav`), vì tường bên cạnh đã giữ robot cách xa 0,5 m, nên đường đi của robot không đổi.
  - Chỉ chặn đạn (`kitShot`, `bulletOnly`) cho đồ trên cao, người không chạm tới: máng cáp, ống trên giá ở hành lang, đèn lồng gắn tường, ống góp và ống đứng trong nhà bơm, cuộn cửa cuốn, móc cẩu.
  - Thang của bồn lắng chỉ chặn người (`playerOnly`). Đạn lọt qua giữa các bậc, trúng thân bồn ngay phía sau.
  - Không thêm hộp cho đồ mỏng (nhô ra không quá 10 cm: biển, nẹp, vạch sơn, decal) và dầm thép từ 6,7 m trở lên. Thùng phuy nằm trong bể (không gắn tường) vẫn chưa có va chạm.
  - Đã kiểm tra: lưới đường đi giống hệt trước; đạn dừng đúng trên từng món; người đi vào dừng cách mặt món đồ 0,32 m; chỗ xuất hiện của đội, FFA và lính robot vẫn nằm trong map và không kẹt vào hộp.
- **Chơi một mình:** cắt 3 relay (trong hành lang, giữa bể phía bắc bồn, trong sảnh bơm) rồi tới xe EVAC ở khu phía đông. Robot xuất hiện ở hành lang, mép bể, sảnh bơm và khu phía đông.
- **Map có tường bao** (`arena` trong dữ liệu level = mép trong tường bao): chỗ đặt robot và người chơi khi xuất hiện (`spotOutside` trong `units/units.js`, có truyền độ cao sàn) chỉ tính vật cản ở tầm người, nên mái sảnh bơm không đẩy chỗ xuất hiện ra ngoài; và chỗ đó luôn nằm trong tường bao. Trước đây lính xuất hiện ở sảnh bơm bị đẩy ra ngoài tường bao phía nam, trông như robot đi xuyên tường. Map khác không có `arena` nên vẫn như cũ.
- **Chó robot (hound, mọi map):** bị người chơi hoặc con khác đẩy trong lúc đang vướng vật cản trước mặt thì không bị đẩy ra khỏi lưới đi lại nữa (trước đây có thể bị đẩy lọt qua tường; sửa trong `game/js/10_game.js`).
- **Free-for-all:** 14 điểm xuất phát (hai khu hồi sinh, hành lang, góc mép bể, góc sảnh bơm).
- **Minimap:** vẽ bể nước, bỏ mái sảnh bơm để thấy máy bơm bên trong.
- **Test:** 45 lính gọi ra ở cả 15 điểm xuất hiện đều nằm trong map (lính ở sảnh bơm ở lại trong sảnh), theo dõi robot từng khung hình không con nào lọt vào hay cắt qua vật cản; đi ngang trên cầu thang và trên cầu thép không rơi; nhiệm vụ một mình chạy trọn; đi bộ bằng phím qua cả 3 cửa khu hồi sinh, leo cầu thang lên cầu thép, đi hết cầu và xuống đầu bên kia, lội xuống bể (tiếng bước là nước); 49/49 đồ nhặt và mọi điểm xuất phát tới được, không món nào nằm trong vật cản; vào phòng 2 đội thì Blue/Red xuất phát đúng khu của mình, cả hai vào trận chỉ có súng lục và bất tử 2,5 s, nhặt PAC-9 thì có súng trường, chết hồi sinh lại về súng lục; tiếng bước chân người khác: đi bộ có, đi khom trên nền khô không có, lội nước có (cả khi khom), trên cầu thép là tiếng thép.

## desert (map sa mạc)

Mở `index.html?map=desert`, hoặc chọn map ngay ở menu đầu game. Chi tiết xem trong `desert/`.

- **Độ nét** (sửa vì sa mạc trông nhoè, nhất là trên màn Retina):
  - **Nguyên nhân chính:** game giới hạn số điểm ảnh render theo mức chất lượng (`resize()` trong `game/js/10_game.js`). Trên MacBook Retina (canvas 3024×1964), High chỉ render 1882×1222 (62 %) rồi phóng to, Ultra 79 %.
  - **Nâng giới hạn:** High 2,3 → 3,4 triệu điểm ảnh, Ultra 3,7 → 6,2 triệu. Phần tự hạ độ phân giải sẵn có của game vẫn hạ khi một khung hình quá 21,5 ms (dưới khoảng 46 FPS), nên máy yếu không bị tụt FPS. Đo trên Retina giả lập ở sa mạc: High render 2288×1486 (76 %), FPS ngang bản cũ trong cùng lần đo (khoảng 48); Ultra lúc đầu render đủ độ phân giải ở 30 FPS, rồi tự hạ còn 70 % để giữ 48 FPS.
  - **Phóng to sắc hơn:** pass cuối (`iA`) dùng nội suy Catmull-Rom 5 mẫu thay cho nội suy tuyến tính khi ảnh render nhỏ hơn canvas (`uUp` = bề ngang canvas / bề ngang ảnh render). Mức làm nét tăng theo tỉ lệ phóng: 0,3 + 0,6·(uUp − 1), tối đa thêm 0,45. Không phóng to (màn thường, DPR 1) thì như cũ.
  - **Mặt đất sa mạc** (`SXD_SHARP` trong `desert/desert.js`): lọc dị hướng tối đa 16 (trước 8) cho texture chi tiết, vết bánh xe và đường nhựa; hạt cát tương phản hơn (±16 % thay ±12 %); sương bụi xa bắt đầu từ 140 m (trước 90 m) và mỏng hơn (0,0014/m thay 0,0019/m), nên đồi cát và mesa ở xa rõ hơn.
  - **Motion blur** (nhoè khi xoay camera, có sẵn ở High/Ultra): thêm công tắc trong Settings (`modes/modes.js`), **mặc định tắt** cho hình rõ khi xoay; bật lại thì dùng đúng giá trị của mức chất lượng.
  - So ảnh cắt 1:1 cùng chỗ (Retina giả lập): khung tháp khoan, mép máy bơm dầu và hạt cát trên đồi rõ hẳn so với bản cũ.

- **Đi lại trên địa hình:** đê cát và đồi cát leo được. Vật lý của game (đi lại, đạn, lựu đạn, tầm nhìn của địch, đồ rơi) dùng độ cao địa hình `SXD_TH`. Độ cao này được nướng sẵn thành lưới 1,25 m từ `SXD_terrainHeight` lúc tải map.
- **Vùng được đi:** cả map, bán kính `SXD_PLAY_R` = 1500 m quanh trạm bơm (trước đây 560 m). Đi bộ hay lái xe đều tới được mép; gần mép (còn 22 m) thì game cảnh báo, tới mép thì bị chặn lại. Đi bộ không leo được sườn dốc hơn `SXD_MAX_SLOPE` (khoảng 46°, ví dụ vách núi mesa).
- **Dữ liệu độ cao:** lưới 2 m phủ ±600 m, tạo sẵn lúc tải map (khoảng 0,7 s từ khi có thêm núi và nền nhà). Mặt đất gần người chơi được dựng thành các khối 100 m từ chính lưới này, nên phần nhìn thấy khớp với phần va chạm. Có 2 mức chi tiết, đổi ở khoảng cách 200 m. Mức xa dùng ô 10 m (trước đây bước 4 trên 50 ô lưới ra 12,5 ô, nên khối xa bị dựng lệch tam giác).
- **Ngoài ±600 m (cả map lái được):**
  - **Độ cao:** cùng lưới 2 m, chia thành ô 100 m (`SXD_tile`), mỗi ô tính từ `SXD_terrainHeight` lần đầu có thứ cần tới (bánh xe, chân, đạn, phần hiển thị), khoảng 3 ms một ô, rồi giữ lại. Phủ tới `SXD_WORLD_R` = 1560 m; xa hơn là mặt phẳng.
  - **Hiển thị** (`SXD_streamer`): mọi ô trong 560 m quanh camera có mesh riêng (2 m trong 230 m, 10 m xa hơn), dựng dần mỗi khung hình 1 ô 2 m + 3 ô 10 m, ô gần trước; ô xa quá 720 m thì bỏ. Vòng địa hình thô (lưới cực) bị cắt bỏ (discard) trong vòng tròn mà các ô đã phủ kín (`uSdHide`), nên chỗ đó hiện đúng mặt đất chi tiết, khớp với phần va chạm. Vòng thô giờ không đổ bóng (nó có thể nhô lên trên mặt chi tiết và phủ bóng sai).
  - **Vòng địa hình thô** nới ra khoảng 2,5 km (`NR` 96 → 108), tức mép map 1,5 km cộng tầm nhìn 900 m của camera, nên đứng ở mép map cũng không thấy hết đất.
  - **Đường cao tốc** ngoài ±600 m: mỗi đỉnh có 2 độ cao, trên mặt chi tiết (`aFine`, dùng trong vòng tròn chi tiết) và nhấc lên trên vòng thô (dùng ngoài vòng); shader đỉnh chọn theo vị trí.
  - **Minimap** phủ cả map (`SXD_WORLD_R`, ảnh 2048 px, khoảng 1,5 m/điểm ảnh, lưới vạch 500 m). Ngoài lưới tạo sẵn, độ cao lấy thưa mỗi 4 điểm ảnh rồi nội suy (vẽ mất khoảng 0,3 s lúc tải). Mở bản đồ lớn thì phóng sẵn 3,5×, phóng tối đa 30×.
  - **Đã thử:** đứng ở cách trạm 1,2 km thì đứng đúng trên mặt đất, 108 ô được dựng (15 ô 2 m), vòng chi tiết phủ đủ 552 m, 60 FPS; nhìn 4 hướng không có lỗ hay đường nối. Lái Sandcat (bật tăng tốc) ra mép: dừng ở 1,48 km rồi bị đẩy lại.
- **Đường lên núi** (`SXD_mesaRamps`, `SXD_rampLift`): mỗi núi mesa có một con dốc đắp thẳng từ mặt đất lên mặt đỉnh, dốc 0,32 (khoảng 18°), mặt dốc rộng 8 m, hai bên đổ xuống 1,5 m mỗi mét và phía đỉnh cũng đổ xuống, nên con dốc luôn gặp mặt đất, không thành bức tường. Hướng dốc chọn một lần trong 36 hướng: tránh khu căn cứ, các núi khác, các cứ điểm, nền nhà (`houses/`), đường cao tốc và mép map, rồi ưu tiên hướng nhìn về căn cứ. Cả 22 con dốc đều tìm được hướng không vướng gì; 8 con dốc cũ giữ nguyên hướng. Con dốc nằm trong `SXD_terrainHeight`, nên va chạm, hiển thị, minimap và vòng thô đều thấy giống nhau.
  - **Đã thử:** lái tự động (bám trục con dốc) lên núi phía tây (cao 72 m): Sandcat lên tới đỉnh sau khoảng 12 giây, Rhino khoảng 17 giây. Sau khi đổi hình núi (mục dưới), Sandcat vẫn lên tới đỉnh.
- **Hình núi** (`SXD_mesaH`, chỉnh ở `SXD_MESA_TUNE`; nằm trong `SXD_terrainHeight`, nên va chạm, minimap và vòng thô khớp theo):
  - Mặt đỉnh phẳng tới mép (viền fbm như cũ). Mỗi núi có 4 khe xói khía vào mép đỉnh (sâu 9–22 m, rộng 10–22 m), không có khe nào trong khoảng ±31° quanh hướng con dốc.
  - Vách: trong 40 m (±20 %) hạ 62 % độ cao qua 3–5 tầng. Mỗi tầng một vách dốc (70 % bề rộng tầng) rồi một gờ thoải đọng cát; 70 % độ hạ nằm ở các bậc, 30 % là dốc đều. Mép các gờ uốn ra vào quanh núi.
  - Bậc sắc hơn (vách hẹp hơn ô lưới 2 m) từng được thử: viền cong bị bậc thang thành hàng răng cưa / nếp gấp chữ V, nhất là ở mặt khuất nắng. Vì vậy gờ đá nhỏ là việc của shader.
  - Chân núi: lớp đá vụn gồ ghề (fbm 7 m, cao tới 2,6 m) trên dải dốc 100 m.
  - Tạo lưới độ cao lúc tải map mất khoảng 0,62 s (trước 0,39 s).
- **Shader đá** (`SXD_TERRAIN_BODY`, dùng cho khối gần, ô sinh thêm và vòng thô):
  - Các tầng đá cách nhau khoảng 4,8 m, uốn nhẹ, mỗi tầng một màu (kem, cá hồi, gỉ sắt, nâu sô-cô-la, trắng ngà), dày mỏng khác nhau, có vạch mảnh bên trong.
  - Vệt sẫm (desert varnish) chảy dọc từ mỗi gờ xuống, khe nứt dọc thẳng; cả hai chỉ có trên vách dốc, không có trên gờ.
  - Hốc tối dưới mỗi tầng và trong khe nứt.
  - **Bump bằng đạo hàm màn hình** (cách của Mikkelsen, không cần texture): mỗi tầng phồng ra với chân lõm vào, khe nứt khoét sâu, mặt đá sần. Độ nghiêng của bump tối đa khoảng 40° (cạnh lưới sắc từng làm lóe đốm trắng), mờ dần từ 60 m tới 220 m.
  - Nhiễu chiếu lên hai mặt phẳng X và Z rồi trộn theo hướng vách (`sdFace`), nên không bị nhoè ở chỗ vách đổi hướng. Lớp sần nhỏ mờ dần ở xa (trước đó lấp lánh thành lưới ô vuông).
  - Đá bớt bóng (độ nhám 0,9).
  - Đã thử: chụp 5 góc trước và sau ở chất lượng High (núi phía tây và phía đông, gần, xa, trên đỉnh, ngược nắng).
- **Bóng mặt trời:** khi ra xa trạm, vùng đổ bóng đi theo người chơi.
- **Địch:** robot chó vẫn tìm đường trong khu trạm. Drone thì bay theo người chơi.
- **Quốc lộ (`SXD_ROAD_PTS`):**
  - Đường nhựa 2 làn, dài khoảng 2,3 km, chạy bắc–nam ở phía tây map. Đi qua thung lũng giữa Fuel Depot và Ridge Post, dưới đường dây điện, cạnh Camp Mirage, cắt ngang đường tây (đường băng Talon) rồi đi tiếp về nam giữa Radar Station và núi mesa lớn phía tây.
  - Texture mặt đường (`desert/assets/road_ludlow.webp`, 31 KB) cắt từ bản scan `terrain_model_and_rock_features_near_ludlow_ca.glb`, gồm vạch vàng giữa, vạch trắng hai mép và lề sỏi. Tác giả ghi trong `CREDITS.md`.
  - Đường là một phần của mặt đất: `SXD_terrainHeight` san phẳng nền đường (dốc tối đa 5%, taluy 1:2), nên đi bộ, bánh xe và đạn đều khớp với mặt đường nhìn thấy. Chỗ cắt đường băng, mặt đường bằng đường băng.
  - Cột điện gỗ dọc lề đông, có dây võng. Minimap vẽ đường.
- **Thêm núi** (`SXD_MESAS`, 8 → 22):
  - 14 núi ở vòng ngoài (700–1400 m): 11 mesa bè (bán kính 70–150 m, cao 45–70 m) và 3 núi trụ hẹp, cao (bán kính 45–55 m, cao 70–78 m). Cùng hình vách tầng, khe xói, sườn đá vụn và con dốc lên đỉnh như các mesa cũ.
  - Vị trí kiểm bằng script: chân núi (bán kính ×1,3 + 148 m) không chạm cứ điểm, nền nhà, đường cao tốc hay núi khác.
  - Bake lưới độ cao: các vòng lặp mesa và nền nhà loại nhanh bằng hộp bao trước khi tính khoảng cách.
- **Dãy núi chân trời** (`SXD_PEAKS`, `SXD_peakH`): 17 đỉnh (bán kính 420–600 m, cao 150–270 m, có 2 đèo) ở 1,8–2,2 km quanh map. Chúng chỉ mọc từ `SXD_PLAY_R - 50` trở ra (`SXD_terrainBase` nhân với hệ số tăng dần tới +150 m), nên phần chơi được không đổi; đứng ở vùng ngoài sẽ thấy núi khép kín chân trời.

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

`outposts/outposts.js`, danh sách `SXO_SITES`. Mỗi cứ điểm nằm trong một lòng chảo phẳng được khoét vào giữa đồi cát. Có 11 cứ điểm: 4 cái gần căn cứ (trong 250 m) và 7 cái ngoài sa mạc xa, cách căn cứ 1–1,2 km.

- **Camp Mirage (đồng minh, phía tây):**
  - Có 3 robot Sentinel đồng minh tự bắn máy địch.
  - Tiếp tế gồm đạn, lựu đạn, túi máu và túi máu lớn.
  - Có xe Rhino và Sandcat (nếu feature `cars` có mặt).
- **Camp Oasis (đồng minh, xa về phía tây nam, -760 / 820):** ốc đảo có ao nước, 4 cây cọ, lều, bồn nước, 2 Sentinel, đồ tiếp tế và một xe Sandcat. Lần đầu tới gần thì có lời chào qua radio (trường `hello` của cứ điểm, Camp Mirage cũng dùng trường này).
- **Ridge Post, Radar Station, Fuel Depot (của địch, gần căn cứ):**
  - Lại gần dưới 150 m (400 m nếu đang lái máy bay) thì lính gác xuất hiện: ụ súng, drone Gull, và robot to nếu có (Colossus ở Ridge Post, gunship Skua ở Radar Station).
  - Hạ hết lính gác thì chiếm được cứ điểm: đồng minh kéo tới và có thêm đồ tiếp tế.
- **6 cứ điểm địch ngoài sa mạc xa** (cùng luật thức dậy / chiếm như trên):
  - **Salt Pan Relay** (820 / -520): cột ăng-ten 24 m có dây néo, 2 chảo ăng-ten, nhà thiết bị.
  - **Sunken Wells** (-850 / -700): giếng đá có tời, 2 máy bơm dầu đang chạy, tháp nước, đường ống. Lính gác lớn là Colossus.
  - **Scrapyard** (900 / 520): container gỉ chồng 2–3 tầng, xe cháy, đống xác xe bị ép, cần cẩu có nam châm.
  - **Checkpoint Nine** (-80 / 980): trạm gác cạnh đường cao tốc (cách 130 m về phía đông), 2 tháp canh gỗ, chốt gác, barie, rào chữ chi.
  - **West Quarry** (-1050 / 250): mỏ đá với các khối đá lớn, 2 đống sỏi, băng chuyền, nhà điều hành. Lính gác lớn là gunship Skua.
  - **Bunker Line** (420 / -1120): boongke bê tông vào được (cửa phía nam, khe bắn phía bắc), 2 lô cốt, hàng "răng rồng" chống xe, 6 ụ súng. Lính gác lớn là Colossus.
  - Vị trí được chọn để không đụng đường cao tốc, núi mesa và các cứ điểm khác; con dốc lên núi và cột điện ven đường không đổi.
- **Marker trên màn hình:** đỏ là của địch, xanh là của mình. Kèm khoảng cách và số lính gác còn lại. Hiện cho mọi cứ điểm trên map; cứ điểm xa hơn 650 m thì marker mờ và nhỏ hơn.
- **Hiệu năng** (`SXD_splitGroups` trong `desert/desert.js`, gọi từ `SXD_level` sau bước gộp nhãn; cứ điểm và nhà đều dùng):
  - Mỗi cứ điểm được gộp thành một nhóm mesh riêng (`site-<id>`), không nhập vào mesh chung `level-merged` của cả map. Mesh chung trải khắp sa mạc nên lúc nào cũng phải vẽ (kể cả shadow pass); nhóm riêng thì bị frustum culling bỏ khi nằm ngoài tầm nhìn.
  - Cứ điểm cách camera hơn `SXD_GROUP_DRAW` (1000 m, tính từ mép) thì không vẽ. Ở khoảng đó sương đã che gần hết và đồi cát thường chắn tầm nhìn; marker vẫn hiện.
  - Đo ở điểm xuất phát (4 hướng nhìn): số tam giác mỗi frame giảm từ 1,0–1,8 triệu xuống 0,66–1,4 triệu so với trước khi có 7 cứ điểm mới, dù cả scene có thêm khoảng 400 nghìn tam giác.
- **Hàm dựng riêng của cứ điểm** (`SXO_kit(api)`, feature `houses` dùng lại cây cọ và nước): `watchtower`, `bunker`, `pillbox`, `tooth`, `gravel`, `crushed`, `crane`, `well`, `pond`, `palm` (lá cọ là dải cong thon gập chữ V, vật liệu hai mặt), `conveyor`, `guyWires`. Nước ao và giếng dùng vật liệu `sxo_water` (xanh lục đậm, bóng, gợn sóng cố định). `SXD_level` đưa thêm `pumpjack` vào API cho cứ điểm dùng.

## houses (nhà, thị trấn, trang trại trên map sa mạc)

`houses/houses.js`, danh sách `SXH_SITES`. Mỗi nơi có một nền phẳng san ở độ cao bằng khoảng 85 % độ cao trung bình của đồi cát quanh đó (đào nhiều hơn đắp), rồi hoà dần vào đồi trong 20–30 m (`SXH_pad`, gọi từ `SXD_terrainBase`). Vì vậy nhà không nằm trong hố.

- **Hai loại nhà, đều vào được:**
  - `apt`: đúng khối căn hộ gạch 4 tầng của map Crossroads. Mặt tiền là model `cx_oldap` (cắt bỏ kính, cửa, mặt mái và các mặt tường giống Crossroads), gạch `cx_skin_oabrick` phủ lên tường, có ô cửa sổ. Trước khi model tải xong thì tường màu gạch trơn.
  - `block`: nhà trát vữa 1–5 tầng, 7 màu sa mạc (vật liệu `sxh_stucco`: màu đều, vân nhiễu nhẹ và vệt mưa theo toạ độ thế giới, không cần UV). Có gờ chân tường, gờ từng tầng, gờ mái. Mái bằng có lan can; nhà ở trang trại có mái ngói dốc bốn phía (`hip`) hoặc hai phía (`gable`, đầu hồi trát vữa).
  - Bên trong giống Crossroads: tường có ô cửa sổ (1,3 × 1,4 m, bệ cao 1 m), cửa trước và cửa sau, sàn mỗi tầng, cầu thang gấp khúc 2 làn dọc tường sau (bậc 0,295 m), mái bằng thì có lối lên mái, mỗi tầng một thùng gỗ và một bàn thấp, vài nhà có cửa hàng ở tầng trệt (quầy, kệ, biển hiệu `SXH_SIGNS`, mái hiên).
  - Thêm: bồn nước trên mái (1–2 cái trên chân sắt), máy lạnh, cầu thang thoát hiểm bên hông nhà 3 tầng trở lên (chỉ để nhìn, sàn nghỉ có va chạm), hiên cột (nhà chính trang trại).
- **Các nơi:**
  - **Dustwater** (230 / -640, bán kính 80 m) và **Copper Flats** (380 / 760, 75 m): một phố chính trải nhựa có vỉa hè và một phố cắt ngang; 17–18 nhà quay mặt ra phố, nhà cao (3–5 tầng, căn hộ gạch) ở giữa, nhà thấp ra rìa; cột điện và dây dọc phố, xe đỗ, thùng rác, thùng phuy, cây Joshua và cây cọ.
  - **Old Ranch** (-380 / 1060, 52 m): tường bao 2,6 m có mái ngói, cổng trước có trụ và dầm, cổng sau, cổng hông ra nhà kho; nhà chính 2 tầng mái ngói bốn phía có hiên cột, hai dãy nhà ngang mái hai phía quanh sân trong có đài phun nước, cây cọ, bồn cây; bên ngoài có nhà kho lớn, nhà kho nhỏ, tháp nước, 3 ruộng có hàng rào gỗ, bãi quây, rơm.
  - 4 cụm 2–3 nhà và 12 nhà lẻ (chọn chỗ bằng cách lấy điểm xa nhất trên vùng đất trống).
  - Tất cả được kiểm bằng script để không chạm núi, cứ điểm, đường cao tốc và nhau. Bố cục là của riêng game này: chỉ lấy ý chung "thị trấn sa mạc nhiều nhà tầng" và "trang trại có tường bao", không chép bố cục của game nào.
- **Cách dựng** (`SXH_layout`, gọi từ `SXD_level` sau cứ điểm): dựng mọi thứ ở y = 0 bằng các hàm dựng sẵn có (`SXO_kit`, `api.truck`, `place`…), rồi nhấc cả mesh, prop và collider lên độ cao nền. Phần ngoài của mỗi nơi là một nhóm mesh riêng (`SXD_GROUPS`). Phần trong (tường trong, sàn, cầu thang, đồ đạc) gộp thành nhóm khác, chỉ vẽ khi camera trong `SXH_INSIDE` (220 m); xa hơn thì thay bằng một khối tối trong mỗi nhà, để nhìn qua cửa sổ không thấy xuyên.
- **Va chạm theo khoảng cách** (physics duyệt mọi hộp cho mỗi tia đạn và mỗi bước đi):
  - Vỏ (tường, mái, lan can, bồn nước, tường rào): chỉ có trong physics khi có người chơi trong `SXH_ACTIVE` (450 m) của nơi đó.
  - Bên trong (bậc thang, sàn, bàn, thùng, quầy): chỉ khi trong `SXH_ACTIVE_IN` (160 m).
  - Chơi online: tính theo người chơi gần nhất (`SXN_nearestOps`).
  - Đo: ở điểm xuất phát vẫn là 991 hộp như trước. Đứng giữa Dustwater có 3271 hộp, một tia đạn mất khoảng 18 µs (bình thường khoảng 8 µs).
- **Bản đồ:** nền nhà và tường rào vẽ lên ảnh nền bản đồ như các công trình khác; tên Dustwater, Copper Flats, Old Ranch hiện trên bản đồ lớn (biểu tượng ngôi nhà).
- **Đã kiểm tra** (Chrome headless): đi qua cửa vào nhà, leo hết 5 đoạn cầu thang của một nhà 5 tầng lên mái (16,25 m) và đoạn đầu của căn hộ gạch; cả 4 map chạy nhiệm vụ và Sinh tồn không lỗi; bản tách file tải `cx_oldap` và gạch muộn ở sa mạc, Crossroads không đổi.

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
  - Map sa mạc: vẽ một lần lúc tải map, từ lưới độ cao (đổ bóng đồi) cộng với vị trí các công trình (lấy từ hộp va chạm; nhà thì lấy nền nhà và tường rào từ `houses/`, vì va chạm của nhà chỉ bật khi có người ở gần).
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
- Vách đá của các mesa (dốc khoảng 60°) thì không xe nào leo được; lên đỉnh mesa bằng con dốc đắp sẵn (xem phần desert, "Đường lên núi").
- **Hỗ trợ leo dốc** (`SXC_HILL` = 0,8 trong `cars/cars.js`): khi ga mà mũi xe đang chúc lên, lực kéo cộng thêm 80 % thành phần trọng lực kéo xe tụt xuống (như gài số thấp), vẫn bị giới hạn bởi độ bám của lốp. Nhờ vậy Rhino giữ W cũng leo được đồi cát và con dốc lên núi, không chỉ khi bật tăng tốc.
- **Mép map:** xe bị chặn ở `SXD_PLAY_R` − 6 m (giờ 1494 m quanh tâm map sa mạc; trước đây 554 m). Mặt đất có tới `SXD_WORLD_R` = 1560 m, nên xe không bao giờ ra tới chỗ không có đất.
- Chỉnh: `boostMul` (tốc độ tối đa) và `boostAccel` (lực kéo) trong `SXC_SPECS`.
- **Tên lửa ở đuôi khi tăng tốc** (`cars/lib/30_boost.js`, vị trí `boost.nozzles` trong `SXC_SPECS`): mỗi xe có 2 ống phụt (vỏ thép tối, miệng loe cháy sém) gắn ở đuôi, lúc nào cũng thấy. Giữ Shift thì:
  - **Lửa:** lõi vàng trắng, vỏ cam, vệt mờ dài màu đỏ cam, 3 "vòng sáng" (shock diamond) dọc lõi; màu HDR nên bloom làm chúng phát sáng. Lửa nhấp nháy, dài ra theo mức đốt và theo tốc độ xe. Miệng ống đỏ rực.
  - **Ánh sáng:** đèn chớp cam từ bộ đèn chung của game (`render.lightPool.flash`, không thêm đèn mới nên không phải biên dịch lại shader) hắt xuống đất phía sau xe.
  - **Khói và tia lửa:** khói xám ở đuôi luồng lửa mỗi 0,05 s, thỉnh thoảng có tia lửa bắn theo hướng luồng lửa.
  - **Âm thanh:**
    - Lúc tên lửa vừa cháy: một tiếng "phụt" (`Go.sx_rocket_ignite`, 0,8 s): tiếng uỵch trầm + tiếng gió ngắn. Phát một lần, tắt hẳn rồi mới phát lại.
    - Trong lúc đốt: vòng lặp `Go.sx_rocket` 2 s, gồm 4 lớp nhiễu lọc (rền dưới 95 Hz, gầm dưới 380 Hz, thân 820 Hz, gió 2,3 kHz), mỗi lớp đưa về cùng mức rồi mới trộn. Âm lượng phập phồng theo nhịp cháy 11 Hz và 17,5 Hz (số chu kỳ chẵn trong 2 s nên chỗ nối vòng liền), bóp méo nhẹ.
    - Âm lượng và cao độ đổi mượt theo mức đốt (cao độ 0,88 → 1,1).
    - Bản đầu tiên nghe kỳ, đo lại thì thấy: 48 % năng lượng trên 4 kHz (tiếng xì chói), bước nhảy giữa hai mẫu gần bằng biên độ tối đa (nổ lép bép do tiếng lách tách bật ngẫu nhiên và bóp méo mạnh), chỗ nối vòng hở 0,13 (kêu "tách" mỗi 2 s), cộng với cao độ ngẫu nhiên ±2 % mỗi khung hình (rè rít). Bản mới: 70 % năng lượng dưới 500 Hz, 20 % ở 500–1500 Hz, 2,6 % trên 4 kHz; bước nhảy lớn nhất 0,31; chỗ nối hở 0,006.
  - **Camera:** góc nhìn rộng thêm 8° (camera sau xe) hoặc 9° (ghế lái), ghế lái rung nhẹ.
  - Mức đốt `st.boostK` lên nhanh (9/s) xuống chậm hơn (5/s). Xe người khác lái (chơi mạng): bật lửa khi xe chạy nhanh hơn tốc độ tối đa thường 4 % (chỉ tăng tốc mới vượt được).
  - **Đã thử:** Sandcat và Rhino giữ Shift thì chỉ 2 ống của xe đang lái bật lửa (2/8 ống trong cảnh), nhả ra thì tắt hết (0/8); ảnh từ sau, bên hông và ghế lái.

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

### Người lái và góc nhìn lái xe (`driver/`, `cars/cars.js`)

- **Góc nhìn:** lái Sandcat hoặc Rhino mặc định nhìn từ ghế lái (góc thứ nhất). Phím ngồi (C, đổi được trong Controls) chuyển sang camera bám sau xe (góc thứ ba) và ngược lại; lựa chọn được nhớ (`localStorage` khoá `doomzone.drivecam`). HUD của xe ghi phím đó ("C  CHASE VIEW" / "C  DRIVER VIEW").
  - Góc thứ nhất: camera ở mắt người lái (`cockpit.eye`), nghiêng và lắc theo thân xe, quay theo xe khi xe rẽ. Chuột nhìn quanh được ±126° so với phía trước (`SXC_VIEW.look`); thả chuột khi đang chạy thì góc nhìn tự về phía trước (dùng chung đoạn tự căn của camera bám xe). Lúc vào xe nhìn thẳng, hơi cúi để thấy vô lăng (`cockpit.pitch`). FOV 80°.
  - Súng trên xe vẫn ngắm theo tâm màn hình ở cả hai góc nhìn (`aimPt` lấy từ tia của camera).
  - Trực thăng, máy bay, mech: vẫn chỉ góc thứ ba.
- **Người lái** (`SXDR_make` trong `driver/driver.js`): dùng model lính (`troopers/lib/20_soldier.js`), màu đội khi chơi mạng (xanh khi chơi một mình). Hông đặt trên ghế, chân co lên đạp bàn đạp, hai tay nắm vành vô lăng ở vị trí 10 giờ – 2 giờ và xoay theo vô lăng (IK hai khớp `SXT_ik` cho tay và chân), người hơi ngả ra sau, đầu quay theo hướng nhìn (tối đa ±69° ngang, ±40° dọc). Ở góc thứ nhất đầu được thu nhỏ lại (camera nằm trong đó), nên vẫn thấy tay, vai và bóng của người lái.
- **Vô lăng** (`SXDR_wheel`): vành, 3 nan, trục và cột lái, quay theo góc đánh lái nhân `cockpit.ratio` (Sandcat 2,6; Rhino 2,4). Sandcat ẩn vô lăng có sẵn trong model (phần `STIR`, không xoay được) và dùng cái này; model TMV của Rhino không có vô lăng nên được thêm vào.
- **Vị trí trong xe** (`cockpit` trong `SXC_SPECS`, hệ toạ độ thân xe):
  - Sandcat: model Buggy chỉ có một ghế ở giữa (`KURSI`), vô lăng ở `x = 0`, cao 0,4 m, nghiêng 45°.
  - Rhino: khoang mui trần, ghế trái. Đo bằng tia chiếu dọc thân model: đệm ghế cao 0,45 m (z −1,3 đến −0,85), táp lô 0,96 m (z −1,75 đến −1,45), sàn để chân 0,2 m.
- **Chơi mạng:** người khác lái xe thì máy mình cũng thấy họ ngồi sau vô lăng (`__netPilot` do `net/net.js` đặt; avatar của họ vốn đã ẩn khi ở trong xe). Góc vô lăng của họ được ước lượng từ tốc độ xoay của xe (mô hình xe đạp: góc lái ≈ atan(tốc độ xoay × chiều dài cơ sở / vận tốc)).
- **Đã thử:** ảnh chụp từ góc thứ nhất và từ 4 phía ở góc thứ ba cho cả hai xe: người lái ngồi đúng ghế, tay trên vành, vô lăng xoay khi đánh lái; phím C đổi góc nhìn và được nhớ; xuống xe thì FOV trở lại; 2 trình duyệt qua PeerJS (map sa mạc): host lái Sandcat, máy kia thấy người lái trên xe.

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

## Chế độ Sinh tồn, độ khó, cài đặt thêm (`modes/`)

Nút MODE và độ khó chỉ áp dụng khi chơi một mình; trong phòng nhiều người độ khó luôn là Normal, còn Sinh tồn chọn ở sảnh phòng (mục co-op bên dưới). Lựa chọn lưu ở `localStorage` khoá `doomzone.modes.v1`.

- **Màn hình tiêu đề:** thêm nút **MODE** (Mission ↔ Survival) và **LEVEL** (Easy → Normal → Hard), cùng kiểu nút MAP. Link `?play=survival` / `?play=mission` và `?diff=easy|normal|hard` chọn cho riêng lần mở đó (dùng để test).
- **Độ khó** (`SXQ_TUNE.diff`):

  | | Sát thương nhận | Sát thương gây ra | Số robot mỗi đợt Sinh tồn |
  |---|---|---|---|
  | Easy | ×0,5 | ×1,25 | ×0,75 |
  | Normal | ×1 | ×1 | ×1 |
  | Hard | ×1,5 | ×0,8 | ×1,3 |

  - Bọc `G.player.damage` (mọi nguồn sát thương lên người chơi) và `G.combat.playerShot` (mọi viên đạn của người chơi, kể cả dao và súng trên xe). Lựu đạn, C4 không đổi.
  - Đổi trong Settings có hiệu lực ngay từ phát bắn sau.
- **Sinh tồn (Survival):** không relay, không xe/thuyền thoát. Robot đến theo đợt, đợt sau đông hơn; chết là hết lượt.
  - Đợt n: tổng `4 + 2(n−1)` con (nhân hệ số độ khó). Đợt 1: chó robot + 1 lính. Từ đợt 2 có drone (20 %) và lính nhiều dần (15 % + 5 %/đợt, tối đa 50 %), lính bắn tỉa từ đợt 3. Đợt 5, 10, 15…: lính nặng (Heavy).
  - Robot xuất hiện ở các điểm sinh robot của map (`enemySpawns`), ưu tiên chỗ cách 18–75 m và khuất tầm nhìn. Tối đa 12 con của đợt cùng lúc, số còn lại chờ (lính còn bị giới hạn 6 con của `troopers/`).
  - Từ đợt 2, đạn của người chơi yếu đi 4 % mỗi đợt (tối đa −45 %), tức robot trâu dần.
  - Hết đợt: nghỉ 15 giây, hồi 35 máu, đạn mỗi súng đang có được nạp đủ 2 băng dự trữ.
  - Robot còn sót sau 150 giây mà ở xa hơn 60 m thì không tính nữa (tránh kẹt đợt vì robot mắc kẹt).
  - Dòng nhiệm vụ trên HUD: "Survival · wave 3 · 7 machines left" / "Wave 3 cleared · next wave in under 15 s". Đồng hồ nghỉ nhảy theo bước 5 giây, vì mỗi lần chữ đổi HUD gõ lại và nháy cả dòng (đếm từng giây thì dòng không bao giờ gõ xong). Ẩn hàng Relays.
  - Màn hình chết: số đợt đã qua, số kill, kỷ lục (hoặc "New best!"). Kỷ lục theo map + độ khó, lưu ở `doomzone.survival.v1` (hơn nhau ở số đợt, rồi số kill). Màn hình tiêu đề hiện kỷ lục của map và độ khó đang chọn khi chọn Survival ("Best here on Hard: 3 waves cleared · 12 kills · 4:05"); chưa có thì ghi "No Survival run on this map at Hard yet…".
  - Lượt bỏ dở cũng được tính (`SXQ_leave`): Restart, Main menu hoặc đóng tab giữa lượt thì lượt đó vẫn lưu, miễn đã tới đợt 1. Trước đây chỉ lưu khi chết, nên thoát giữa chừng thì màn hình tiêu đề vẫn báo chưa có lượt nào.
  - Cách nối với game: cờ `window.SXQ_SURV` làm luồng nhiệm vụ trong `game/js/10_game.js` bỏ relay, điểm đánh dấu, lời radio mở đầu và dòng nhiệm vụ; `troopers/troopers.js` không gửi đội lính của nhiệm vụ. Robot boss của sa mạc và lính đồn trú ở cứ điểm vẫn ra như thường.
  - Sự kiện cho phần khác: `survival:wave`, `survival:cleared`, `survival:over`.
- **Sinh tồn chơi chung (co-op):**
  - **Chọn ở phòng chơi mạng:** host bấm **Survival · Co-op waves** (cạnh Blue vs Red, Free-for-all). Mọi người vào chung đội Blue, ẩn chọn đội, số ván, phút mỗi ván và mục Robots (`SXN.mode 'surv'` trong `net/net.js`).
  - **Chỉ host chạy các đợt** (code Sinh tồn của `modes/modes.js`, `SXQ_survOn` đúng cho host trong phòng Survival). Đợt to theo số người: ×(1 + 0,5·(số người − 1)); tối đa min(20, 12 + 3·(số người − 1)) robot cùng lúc. Độ khó luôn Normal. Robot được gửi lần lượt tới từng người còn sống.
  - **Host gửi trạng thái đợt** (`'sv'` mỗi 0,5 s và khi đổi): đợt, đánh/nghỉ, thời gian, số robot còn lại, số đợt đã qua. Máy khách giữ bản sao (`SXQ_mirror`), hiện cùng dòng nhiệm vụ, tự nhận hồi máu và đạn khi hết đợt, phát `survival:wave` / `survival:cleared` (thống kê đếm đúng).
  - **Bị hạ:** xem đồng đội (ẩn HUD như đấu đội), "You are down — back when this wave is cleared". Hết đợt thì hồi sinh cạnh một đồng đội còn đứng (`SXN_survNear`).
  - **Cả đội cùng gục:** hết lượt. Mọi máy hiện bảng kết quả (đợt, số đợt qua, robot và số lần chết từng người, MVP) và lưu kỷ lục co-op theo map (`doomzone.survival.v1`, khoá `<map>|coop`). Lượt mới tự bắt đầu sau 20 s, hoặc host bấm Play again: dọn robot, cả đội về căn cứ.
  - **Còn hạn chế:** người vào giữa lượt xuất hiện ngay ở căn cứ (không chờ hết đợt); hồi sinh thì về bộ đồ ban đầu (mất súng đã nhặt); host rời phòng giữa lượt thì lượt dừng; boss sa mạc vẫn ra theo số kill của phòng.
  - **Đã thử:** 3 trình duyệt qua PeerJS (Crossroads và Port). Đợt 1 cả 3 máy thấy cùng số robot và dòng nhiệm vụ; một người bị hạ thì xem đồng đội, hết đợt hồi sinh cách đồng đội 2–5 m; cả đội gục thì cả 3 máy hiện kết quả và lưu kỷ lục; Play again chạy lại. Chơi một mình và đấu đội không đổi.
- **Settings thêm 3 dòng:** Difficulty; **Aim sensitivity** (0,3–1,5×, nhân vào mức giảm độ nhạy khi ngắm `Mt.adsLook` = 0,6 của game); **FPS counter** (góc trên trái). Bảng Settings có sẵn của game đã có chất lượng đồ hoạ (low/medium/high/ultra), độ nhạy chuột, đảo trục Y, âm lượng, FOV, toàn màn hình.
- **Đã kiểm tra:** cả 4 map ở cả 2 chế độ không lỗi console; đợt 1 có robot ở mọi map; đợt 1→9 tăng 4, 6, 8…20 con, đợt 5 có lính nặng, không quá 12 con cùng lúc, vẫn 60 FPS; chết thì lưu kỷ lục, màn hình chết đúng số. Sát thương nhận / gây ra khi bắn thân: Easy 10 / 37,5, Normal 20 / 30, Hard 30 / 24.

## Thống kê và thành tích (`stats/`)

Lưu trên máy người chơi (`localStorage` khoá `doomzone.stats.v1`), không gửi đi đâu. Nút **STATS** ở màn hình tiêu đề và menu tạm dừng mở bảng "Service record"; Esc hoặc Close để đóng (đang tạm dừng thì vẫn tạm dừng). Có nút Reset (bấm 2 lần).

- **Số liệu:** robot đã hạ, người chơi đã hạ (online), số lần chết, K/D, độ chính xác, kill bắn đầu (và % trên tổng kill), kill xa nhất, súng hay dùng nhất, nhiệm vụ đã xong (và trên Hard), lượt Sinh tồn tốt nhất, thời gian chơi.
  - Kill khi chơi một mình: viên đạn, vụ nổ hoặc súng trên xe của người chơi hạ robot (`player:hitEnemy` có `killed`). Online: theo điểm host tính (`net:myKill`, phát ra trong `net/net.js`), hạ người chơi tính riêng.
  - Kill bắn đầu: phát hạ trúng điểm yếu (`part 'weak'`).
  - Độ chính xác: mỗi tia của `G.combat.playerShot` là một phát, giống cách tính Accuracy ở màn hình tổng kết của game (shotgun tính từng viên đạn chì).
- **14 thành tích:** First blood, Scrap dealer (100 robot), Machine breaker (500), Sharpshooter (25 kill bắn đầu), Long shot (kill từ 100 m), Up close (kill bằng dao), Triple (3 kill trong 4 giây), Lights out (xong 1 nhiệm vụ), World tour (xong nhiệm vụ ở cả 4 map), The hard way (xong nhiệm vụ ở Hard), Steady hands (xong nhiệm vụ với độ chính xác ≥ 50 %, tối thiểu 20 phát), Holding the line (qua 5 đợt Sinh tồn), Last one standing (qua 10 đợt), Rival (hạ một người chơi online). Mở khoá thì hiện thông báo ở trên giữa màn hình.
- **Đã kiểm tra:** bắn hạ lính bằng `playerShot` thì đếm đúng kill, kill bắn đầu, số phát, phát trúng, khoảng cách; mở khoá First blood và Triple; chết thì tăng số lần chết; dữ liệu còn sau khi tải lại trang. Kill bằng dao ghi đúng "Knife" (trước đây `SXK_weapon` trong `score/score.js` chỉ nhận ra dao sau phát chém đầu tiên, nên kill một nhát ghi tên khẩu súng đang cầm; giờ nhận ra cả lúc đang chém hoặc đang cầm dao).
- Bộ đếm kill góc trên phải ẩn khi bảng Settings/Controls đang mở (trước đây đè lên tiêu đề tab).

## Đổi phím (`keys/`)

- **Đổi phím:** Settings → Controls → "Keyboard · Mouse" là danh sách 27 thao tác. Bấm vào phím của một dòng, rồi bấm phím mới (Esc để huỷ). Phím đã dùng cho thao tác khác thì hai thao tác đổi phím cho nhau. Có nút "Reset to defaults". Lưu ở `localStorage` khoá `doomzone.keys.v1` (chỉ ghi phím đã đổi). Esc (tạm dừng) và các nút chuột không đổi được.
- **Cách làm:** mọi phím của game (trừ bản đồ M) đi qua một bảng `h_` trong `game/js/10_game.js` (mã phím → thao tác). `keys/keys.js` chụp bảng gốc sau khi game khởi động rồi ghi lại bảng đó theo phím đã chọn, nên người chơi, súng, nghiêng người và xe đều theo phím mới mà không phải gửi lại sự kiện. Thao tác đổi phím thì bỏ luôn phím phụ của nó (Shift phải, Ctrl, phím số bên phải).
- **Bản đồ:** `minimap/minimap.js` đọc thẳng phím M, nên một bộ nghe phím chạy trước mọi bộ khác chuyển phím đã chọn thành M, và chặn M thật khi bản đồ đã đổi phím. Nếu M được gán cho thao tác khác thì vẫn chạy thao tác đó (qua mã thay thế `SXKB_KeyM`). Đang gõ trong ô nhập (tên, mã phòng) thì không đụng tới.
- **Gợi ý phím trên màn hình:** dòng "Hold F" khi đứng cạnh relay hoặc xe và bảng phím ở màn hình tiêu đề hiện phím đã chọn. Dòng hướng dẫn 5 giây đầu trận của arsenal ("G — grenade…"), chân trang balo và phím Space đổi người khi xem đồng đội (`net/net.js`) vẫn theo phím gốc.
- **Đã kiểm tra:** headless, đổi phím qua chính giao diện: R→K, Space→J, W→↑, Q→Z, M→N. Phím mới chạy đúng thao tác (nạp đạn, nhảy 1 m, đi tới 3,1 m mà không ngửa camera, nghiêng, mở bản đồ), phím cũ không còn tác dụng. Đổi chéo hai phím, Esc huỷ, Reset đều đúng. Gõ trong ô nhập không kích hoạt game. Không có lỗi console.

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
  - Hộp đạn trên đất ghi cỡ và súng dùng (ví dụ ".338 ×5 · SR-3"); mỗi hộp: 5.56 ×30, 12 GA ×10, .50 AE ×12, .338 ×8. Thùng "Mixed ammo crate" ở cứ điểm và trên map cho đạn của các súng bạn đang có (5.56 +60, 12 GA +18, .50 AE +24, .338 +15).
  - Shotgun / súng tỉa: nhặt súng mới được +24 viên 12 GA / +20 viên .338; đã có súng thì trạm súng cho +18 / +15 (`TU.shotgun` / `TU.sniper`: `pickup`, `crate`).
  - Cỡ hộp đạn robot rơi (`TU.dropCal`, tỉ lệ): lính súng trường 5.56 60% / 12 GA 20% / .338 20%; xạ thủ .338; lính nặng 12 GA 60% / 5.56 40%; drone và chó 5.56 35% / .50 AE 15% / 12 GA 25% / .338 25%; boss rơi đủ bốn cỡ (mỗi cỡ 2 hộp).
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
