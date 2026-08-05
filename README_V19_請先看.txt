小宇微電｜幸運車庫 V19 正式穩定版
====================================

這一包是完整網站，不是只覆蓋幾個檔案。

一、上傳方式
1. 在 iPhone「檔案」App 點 ZIP 解壓縮。
2. 打開解壓後的 lucky-garage-v19-stable 資料夾。
3. 把資料夾裡面的全部檔案與資料夾，上傳到 GitHub Repository 最外層。
4. 遇到同名檔案全部覆蓋，Commit 到 main。
5. 等 Vercel 顯示 Ready，再重新開網站。

重要：不要只把 ZIP 檔上傳到 GitHub，也不要把 lucky-garage-v19-stable 再套成 GitHub 裡的一層資料夾。

正確結構：
Repository 根目錄/
  index.html
  products.html
  garage.html
  warranty.html
  admin/
  assets/
  其他檔案

二、固定網址
前台首頁：https://lucky-garage.vercel.app/
車款商品：https://lucky-garage.vercel.app/products.html
客人抽獎：https://lucky-garage.vercel.app/garage.html
保固查詢：https://lucky-garage.vercel.app/warranty.html
統一後台：https://lucky-garage.vercel.app/admin/

三、這次固定的規則
- 前台沒有任何後台入口。
- 後台只有 admin/index.html 一個統一介面。
- 後台「查看前台」會直接回到公開首頁。
- 舊 admin.html、business.html、owner.html、garage-admin.html、raffle-now 頁面只會導向統一後台。
- 抽獎機率固定：500 元 80%、1,000 元 16%、2,000 元 3%、3,000 元 1%。
- 活動 ID：main-2026-v12-final。
- 一組抽獎碼只能使用一次，領取時採 Firestore transaction 鎖定。
- 訂單、收據、保固卡、淨利、商品與圖片功能均保留。
- 完整覆蓋網站檔案不會刪除 Firestore 裡既有的訂單、保固卡或抽獎紀錄。

四、部署後只測三件事
1. 用一組新測試碼抽獎一次。
2. 商品頁送出一筆標明「測試」的訂單，確認後台看得到。
3. 後台開啟一筆訂單的收據與保固卡。

先不要改 Firebase 或刪除 Firestore 資料。只有出現 permission-denied 時，再核對線上 firestore.rules 是否為本包版本。
