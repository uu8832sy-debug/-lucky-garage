# Cloud Functions｜LINE + Gmail 訂單通知

本版只會通知前台官方商城建立的訂單：

- `source = official-store`
- `source = official-store-plate`

後台手動新增、批量匯入及舊資料不會觸發 LINE／Email 通知。
系統會在 `_notificationEvents` 建立事件紀錄，同一 CloudEvent 只處理一次。

## 重要安全事項

LINE Channel Access Token 與 Gmail 應用程式密碼不得放進程式碼、GitHub 或聊天內容。
若 Token 曾經外洩，請先到 LINE Developers 重新發行，再設定新的 Secret。

## 第一次部署

在專案根目錄執行：

```bash
firebase login
firebase use project-972903718947247651
firebase functions:secrets:set LINE_CHANNEL_ACCESS_TOKEN
firebase functions:secrets:set ADMIN_LINE_USER_ID
firebase functions:secrets:set GMAIL_APP_PASSWORD
firebase deploy --only functions
```

設定內容：

- `LINE_CHANNEL_ACCESS_TOKEN`：重新發行後的新 Token
- `ADMIN_LINE_USER_ID`：接收通知的管理員 LINE User ID
- `GMAIL_APP_PASSWORD`：Google 帳號開啟兩步驟驗證後建立的 16 碼應用程式密碼

Email 固定寄到：`uu8832sr@gmail.com`

## 之後只更新 Functions

```bash
firebase deploy --only functions
```

## 查看紀錄

```bash
firebase functions:log --only notifyNewOrder
```

Cloud Functions 使用 Node.js 20，區域為 `asia-east1`。
