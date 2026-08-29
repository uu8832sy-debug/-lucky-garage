import fs from "node:fs";
import path from "node:path";

const outDir = path.resolve("public");

function patch(relative, transform) {
  const file = path.join(outDir, relative);
  if (!fs.existsSync(file)) return;
  const before = fs.readFileSync(file, "utf8");
  const after = transform(before);
  fs.writeFileSync(file, after, "utf8");
}

patch("products.html", (html) => html
  .replace(
    "實車照片、售價、電池版本與參考續航集中展示；現車顏色、交期、領牌及分期結果以客服最終確認為準。",
    "實車照片、售價、電池版本與參考續航集中展示；車款顏色依現貨為主，領牌及分期結果以客服最終確認為準。"
  )
  .replace(
    "實際可供電壓、庫存與交期以客服確認為準。",
    "實際可供電壓與庫存以客服確認為準。"
  )
  .replace(
    "送出後會建立「待訂金」訂單，實際訂金、交期及配備由客服再次確認。",
    "送出後由客服確認訂單內容與交車安排。"
  )
  .replace(
    "例如：想了解無卡分期、指定顏色或交車時間",
    "例如：想了解無卡分期或其他需求"
  )
  .replace("<span>顏色</span><select id=\"color\" required></select>", "<span>車款顏色</span><select id=\"color\" required></select>")
);

patch("products.js", (js) => js
  .replace(
    '$("#color").innerHTML = (currentProduct.colors || ["顏色請洽客服"]).map((color) => `<option>${escapeHtml(color)}</option>`).join("");',
    '$("#color").innerHTML = `<option>車款顏色依現貨為主</option>`;'
  )
);

patch("catalog.js", (js) => js
  .replaceAll("實際顏色、配備與交期以客服確認為準。", "車款顏色依現貨為主；實際配備以客服確認為準。")
  .replaceAll("實際配色、配備與交期以客服確認為準。", "車款顏色依現貨為主；實際配備以客服確認為準。")
  .replaceAll("實際顏色與配備以現車為準；", "車款顏色依現貨為主；實際配備以現車為準；")
  .replaceAll("實際顏色及配備以現車為準；", "車款顏色依現貨為主；實際配備以現車為準；")
  .replaceAll("多色可選", "車款顏色依現貨為主")
);

patch("index.html", (html) => html
  .replaceAll("車款、電池、價格與交期集中展示", "車款、電池與價格集中展示")
);

console.log("Applied Xiaoyu inventory/color copy updates.");
