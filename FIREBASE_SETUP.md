# Firebase 設定｜v12.2 FINAL

## Authentication

Firebase Console → Authentication：

- 啟用 Google 登入
- 啟用 Anonymous 匿名登入（幸運車庫需要）
- Authorized domains 加入 `lucky-garage.vercel.app`

## Firestore Rules

Firebase Console → Firestore Database → Rules：

貼上 `Firestore規則_完整可直接複製_v12.2.txt` 並發布。

規則會保留既有資料，前台只能建立格式正確的官方商城訂單；管理員仍可管理原本的 orders、receipts、warranties、drawCodes、campaigns、sales 與 products。

## Storage Rules

Firebase Console → Storage → Rules：

貼上 `storage.rules` 並發布。商品圖片公開讀取，只有管理員可上傳與刪除。

## 正式抽獎活動

1. 開啟 `https://lucky-garage.vercel.app/admin/draw.html`
2. 管理員 Google 登入
3. 活動 ID：`main-2026-v12-final`
4. 確認 500=80%、1000=16%、2000=3%、3000=1%
5. 建立活動並產生新抽獎碼

舊活動與舊碼不刪除，但前台只接受新活動碼。

## Cloud Functions

請依 `functions/README.md` 設定新的 LINE Token、管理員 LINE User ID 與 Gmail 應用程式密碼。
