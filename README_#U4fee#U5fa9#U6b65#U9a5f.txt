幸運車庫 緊急修復 v7

原因：網站目前混用了不同版本的 index.html / app.js / config.js。

請把這 5 個檔案全部上傳到 GitHub 儲存庫最外層，覆蓋同名檔案：
- index.html
- styles.css
- app.js
- config.js
- draw-core.js

請保留既有的 firebase-config.js 與 garage-open.mp4，不要刪除。
提交後等待 Vercel 部署完成，再開：https://lucky-garage.vercel.app/?v=7
