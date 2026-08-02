# Firebase 免費版設定步驟

這一版使用：

- **Firebase Authentication**：客人自動匿名登入；管理員用 Google 登入。
- **Cloud Firestore**：全網一次性抽獎碼、使用時間、使用者與結果驗證。
- **GitHub Pages**：免費放網站，不需要租主機。

抽獎結果不是由店家預先分配。客人選定車庫後，Firestore 先以伺服器時間鎖定該代碼；網站再以「活動種子＋抽獎碼＋Firebase 時間＋車庫號碼」做 SHA-256 計算並映射到固定機率。相同紀錄永遠會重算出相同結果。

## 已完成：網站已填入 Firebase Web 設定

目前連接專案：`project-972903718947247651`。接下來請從「二、開啟登入方式」繼續。

## 一、建立 Firebase 專案

1. 開啟 Firebase Console，新增專案。
2. 可不啟用 Google Analytics。
3. 專案建立完成後，進入「專案設定」。
4. 在「您的應用程式」新增 **Web 應用程式**。
5. 複製畫面上的 `firebaseConfig`。
6. 打開本資料夾的 `firebase-config.js`，用真正的設定取代 `YOUR_...`。

## 二、開啟登入方式

進入 Firebase Console：

1. **Build → Authentication → Get started**。
2. 在 Sign-in method 啟用 **Anonymous（匿名）**。
3. 啟用 **Google**，選擇專案支援電子郵件。
4. 網站部署到 GitHub Pages 後，到 Authentication 的 Settings / Authorized domains，把你的網域加入，例如：
   `你的帳號.github.io`

## 三、建立 Firestore

1. **Build → Firestore Database → Create database**。
2. 選擇 Production mode。
3. 選擇適合你的資料庫地區。
4. 建立後進入 **Rules**。
5. 將本資料夾 `firestore.rules` 的全部內容貼上。
6. 按 **Publish**。

> 不要使用「允許所有人讀寫」的測試規則。正式權限已經寫在 `firestore.rules`。

## 四、部署網站

把本資料夾的所有檔案上傳到 GitHub Repository 根目錄，再於：

`Settings → Pages → Deploy from a branch → main → /(root)`

啟用 GitHub Pages。

## 五、建立你的管理員權限

1. 用 Safari 或 Chrome 開啟：
   `https://你的帳號.github.io/lucky-garage/admin.html`
2. 按「使用 Google 登入」。
3. 管理頁會顯示你的 Firebase UID。
4. 回到 Firestore Console，按「Start collection」。
5. Collection ID 輸入：`admins`
6. Document ID 貼上管理頁顯示的 UID。
7. 新增欄位：
   - Field：`enabled`
   - Type：boolean
   - Value：`true`
8. 回管理頁按「建立後重新檢查」。

## 六、建立活動與抽獎碼

1. 在管理頁先建立活動，例如 `main-2026`。
2. 活動建立後，獎項、機率和演算法不能修改；要更換機率需建立新的活動 ID。
3. 選擇活動 ID、前綴與數量，產生抽獎碼。
4. 把單一代碼傳給已下訂客人。
5. 每組代碼只能在全網成功使用一次，換手機或清除瀏覽器也不能重抽。

## 目前預設機率

- 現折 500：70%
- 現折 800：23%
- 現折 1,000：6%
- 現折 2,000：1%

期望平均折扣為 614 元／次。這是長期平均，少量抽獎的實際平均可能高於或低於 614 元。

## 常見問題

### 管理員 Google 登入無反應

請改用 Safari 或 Chrome，不要從 LINE 內建瀏覽器登入，並確認 GitHub Pages 網域已加入 Firebase Authentication 的 Authorized domains。

### 顯示 permission-denied

通常是以下其中一項：

- `firestore.rules` 尚未 Publish。
- 尚未建立 `admins/你的UID` 且 `enabled=true`。
- Anonymous 或 Google 登入方式未啟用。
- 活動 ID 不存在。

### Firebase Web 設定放在前端安全嗎？

Firebase Web 設定用來識別專案，本身不是管理員密碼。資料能否讀寫由 Firebase Authentication 與 Firestore Security Rules 決定。不要把服務帳戶私鑰或 Admin SDK 憑證放進網站。
