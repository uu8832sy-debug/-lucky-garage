小宇微電｜幸運車庫 電影級 UI/UX v6

【這版新增】
1. 全站黑金玻璃質感、動態光暈、手機版重新排版
2. 三段式流程指示：驗證資格 → 選擇車庫 → 開出優惠
3. 車庫 3D 光效、選定聚焦、全螢幕電影級開庫過場
4. 3、2、1 倒數、鐵門升起、火花、金色粒子、彩帶特效
5. Web Audio 即時合成：驗證音、倒數音、金屬升門聲、中獎和弦
6. 音效開關、震動回饋、低動態模式支援
7. 結果頁依 500／1000／2000／3000 顯示不同稀有度氛圍
8. 管理後台改為營運儀表板，加入統計卡片與更清楚的操作流程
9. 可選擇接入 Veo 通用開庫過場影片，沒有影片時自動使用原生動畫

【GitHub 要覆蓋的檔案】
index.html
styles.css
app.js
config.js
owner.html
owner.js
admin.css

firebase-config.js、draw-core.js、Firestore 規則不需要更改。

【網址】
抽獎頁：原網址/?v=6
管理頁：原網址/owner.html?v=6

【Veo 影片接法（選配）】
1. 用 VEO_PROMPT.txt 產生 4～6 秒 9:16 通用開庫影片。
2. 將影片命名為 garage-open.mp4。
3. 上傳到 GitHub 的 assets 資料夾。
4. 打開 config.js，把：
   cinematicVideoUrl = "";
   改成：
   cinematicVideoUrl = "assets/garage-open.mp4";

注意：Veo 只當華麗過場，不要在影片中生成獎項金額或兌換序號。
真正結果仍由 Firebase 即時計算，這樣才有可信度，也不會發生影片文字錯誤。
