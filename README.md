# 小宇微電｜幸運車庫 Firebase 版

這是可部署到 GitHub Pages 的無主機抽獎系統，資料與一次性驗證由 Firebase 免費服務處理。

## 完成功能

- 客人自動匿名登入，不需註冊帳號。
- Firestore 全網一次性抽獎碼。
- 換手機、換瀏覽器、清除網站資料都不能重抽同一代碼。
- 九宮格車庫互動動畫。
- Firebase 伺服器時間鎖定抽獎。
- SHA-256 可重算結果，同一筆紀錄永遠得到相同獎項。
- Google 管理員登入。
- 管理頁建立不可修改的活動。
- 批次產生抽獎碼、複製及下載 CSV。
- 查看最近代碼、已使用結果，以及停用未使用代碼。
- 不需要 Cloud Functions、不需要付費主機。

## 重要檔案

- `index.html`：客人抽獎頁。
- `admin.html`：你的管理頁。
- `firebase-config.js`：貼入 Firebase Web 設定。
- `firestore.rules`：必須發布到 Firestore Rules。
- `config.js`：品牌文字及建立新活動時的預設獎項。
- `FIREBASE_SETUP.md`：完整設定步驟。

## 開始設定

請先閱讀 `FIREBASE_SETUP.md`。

尚未貼入 Firebase 設定前，網站會顯示「尚未連接 Firebase」，這是正常狀態。

## 安全設計

客戶端不能自行指定獎項：

1. Firestore 規則只允許未使用代碼從 `used=false` 變成 `used=true` 一次。
2. `usedBy` 必須等於當下登入者 UID。
3. `usedAt` 必須等於 Firestore 的 `request.time`，客戶端不能自行填時間。
4. 活動的獎項、權重、種子與演算法建立後不可修改。
5. 結果由不可修改的資料做 SHA-256 計算。

專案擁有者仍擁有 Firebase Console 的最高管理權限；不要分享 Google/Firebase 專案管理帳號。
