# 小宇微電官方商城 v12.2 FINAL

## 本版重點

- 前台與管理後台網址分開，前台不顯示後台入口。
- 保留既有 Firestore 訂單、收據、保固、抽獎碼與管理員資料。
- 紀念展示車牌總價 NT$9,500：訂金 NT$5,500、尾款 NT$4,000 貨到付款。
- 幸運車庫正式活動 ID：`main-2026-v12-final`。
- 獎項固定：500 元 80%、1,000 元 16%、2,000 元 3%、3,000 元 1%。
- 抽獎保留 9 座車庫、3-2-1 倒數、車庫門、火花、彩帶、音效、震動與結果頁。
- Cloud Functions 只通知官方商城訂單，略過後台手動／批量新增。
- Cloud Functions 使用事件去重紀錄，避免同一 CloudEvent 重複推播。
- LINE Token 與 Gmail 應用程式密碼只存 Firebase Secrets，專案內沒有真實密碼。

## 資料相容

繼續使用原本 Collection：

- `orders`
- `receipts`
- `warranties`
- `drawCodes`
- `campaigns`
- `admins`
- `sales`
- `products`

`_notificationEvents` 是 Functions 新增的去重紀錄，客戶端無權讀寫。

## 更新

請直接閱讀：`部署步驟_請照順序.txt`
