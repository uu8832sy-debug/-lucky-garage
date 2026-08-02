# 小宇微電｜幸運車庫＋訂單保固系統

這個版本直接沿用原本 Firebase 專案與 GitHub Pages 網站，不需要建立第二個專案、不需要綁信用卡。

## 新增頁面

- `business.html`：訂單、收據、保固卡、交車卡、社群文案與營業統計。
- `warranty.html`：客人掃描 QR Code 或輸入保固編號查詢電子保固卡。
- `garage-admin.html`：保留原本幸運車庫抽獎管理。

## 免費版包含

- Google 管理員登入。
- 訂單新增、編輯、刪除、搜尋、狀態篩選。
- 車主、電話、地址、車款、顏色、電池、車架號、付款與領牌紀錄。
- 訂金、尾款、未收金額與營運統計。
- 手寫風格訂金／尾款收據，可下載 PNG 或列印成 PDF。
- 保固卡與專屬 QR Code。
- 公開電子保固查詢，敏感資料不會放進公開保固文件。
- 交車卡。
- FB、IG、Threads、限動、影片口白與 LINE 通知模板。
- CSV 匯出。
- 可加入 iPhone 主畫面。

## 必做設定

1. 將這個資料夾的所有檔案覆蓋上傳到原本 GitHub 儲存庫。
2. 到 Firebase Console → Firestore Database → 規則。
3. 將新版 `firestore.rules` 全部貼上並按「發布」。
4. 到 Firebase Authentication → Settings → Authorized domains，確認你的 GitHub Pages 網域已加入。
5. 等 GitHub Pages 更新後，開啟 `business.html`。

## 重要提醒

- 不要上傳服務帳戶私鑰或 `serviceAccountKey.json`。
- 免費版本不使用 Firebase Storage、Cloud Functions 或付費 AI API。
- 收據為「小宇微電系統開立」文件，不模仿其他工廠或第三方單據。
- QR Code 必須在網站正式網址開啟時產生，才會連到正確的公開保固頁。
