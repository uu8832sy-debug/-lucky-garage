# 小宇微電完整後台 v10

> 最新增：成交與淨利統計可切換「指定月份」與「所有訂單」。

# 小宇微電｜幸運車庫＋訂單保固系統

這是一套可直接部署到 GitHub Pages、共用同一個 Firebase 免費專案的前後台系統。

## 前台

- `index.html`：成交限定幸運車庫抽獎。
- `warranty.html`：電子保固卡查詢。

## 後台

- `business.html`：訂單、收據、保固卡、交車卡、文案及統計。
- `garage-admin.html`：抽獎活動與一次性抽獎碼管理。

## 主要功能

- Firestore 全網一次性抽獎碼。
- Google 管理員登入。
- 訂單與付款管理。
- 手寫風格訂金／尾款收據。
- 保固卡、QR Code 與公開查詢。
- 交車卡。
- FB／IG／Threads／LINE 智慧模板文案。
- CSV 匯出。
- 不使用 Cloud Functions、Storage 或付費 AI API。

部署前請閱讀 `系統升級說明.md`，並將新版 `firestore.rules` 發布到 Firebase。
