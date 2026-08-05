# 小宇微電｜幸運車庫 V19 STABLE

完整前台與統一後台專案，部署於 Vercel，資料使用 Firebase Authentication、Cloud Firestore，商品圖片上傳功能選用 Cloud Storage。

## 固定入口

- 公開首頁：`/index.html`
- 車款商品：`/products.html`
- 紀念展示牌：`/plate.html`
- 客人抽獎：`/garage.html`
- 保固查詢：`/warranty.html`
- 統一後台：`/admin/index.html`

公開頁面不包含後台連結。舊管理頁面只保留重新導向，避免舊書籤再次開啟不同介面。

## 後台功能

`admin/index.html` 是唯一後台外殼：

- 即時線上訂單
- 完整訂單、批量匯入與淨利
- 訂金收據、交車確認與電子保固卡
- 商品、售價與圖片
- 抽獎活動、一次性抽獎碼與使用紀錄

## 抽獎正式機率

- NT$500：80%
- NT$1,000：16%
- NT$2,000：3%
- NT$3,000：1%

客人領取結果時使用 Firestore transaction 將抽獎碼原子鎖定為已使用。

## Firebase SDK

瀏覽器模組統一使用 Firebase JavaScript SDK `12.16.0`。

## 部署

先閱讀 `README_V19_請先看.txt`，再將本資料夾內全部內容覆蓋到 GitHub Repository 根目錄。部署後依 `VALIDATION_V19.txt` 完成三項線上確認。
