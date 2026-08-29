import fs from "node:fs";
import path from "node:path";

const outDir = path.resolve("public");
const sourceRoot = path.resolve(".");

function copySource(source, relative) {
  const from = path.join(sourceRoot, source);
  const to = path.join(outDir, relative);
  if (!fs.existsSync(from)) throw new Error(`Missing source: ${source}`);
  fs.mkdirSync(path.dirname(to), { recursive:true });
  fs.copyFileSync(from, to);
}
function patch(relative, transform) {
  const file = path.join(outDir, relative);
  if (!fs.existsSync(file)) throw new Error(`Missing build file: ${relative}`);
  const before = fs.readFileSync(file, "utf8");
  const after = transform(before);
  if (after === before) console.warn(`No textual change for ${relative}`);
  fs.writeFileSync(file, after, "utf8");
}
function mustReplace(text, search, replacement, label) {
  if (!text.includes(search)) throw new Error(`Xiaoyu patch missing: ${label}`);
  return text.replace(search, replacement);
}
function mustRegex(text, pattern, replacement, label) {
  if (!pattern.test(text)) throw new Error(`Xiaoyu patch missing: ${label}`);
  pattern.lastIndex = 0;
  return text.replace(pattern, replacement);
}

// 正式價目表與商品程式使用 GitHub 版本，不再吃 ZIP 內舊價。
copySource("xiaoyu-official-catalog.js", "catalog.js");
copySource("products.js", "products.js");

patch("products.html", (input) => {
  let html = input;
  html = html.replace(/實車照片、售價、電池版本與參考續航集中展示；[^<]*客服最終確認為準。/g,
    "實車照片、售價、電池版本與參考續航集中展示；車款顏色依現貨為主，領牌及分期結果以客服最終確認為準。");
  html = html.replace(/<div class="notice" style="margin-top:14px">[\s\S]*?<\/div>/,
    '<div class="notice" style="margin-top:14px"><b>正式電池方案：</b>鉛酸、7230 鋰電、7240 鋰電、7250 鋰電、7265 鋰電。車款顏色依現貨為主；續航依載重、路況及騎乘方式而異。</div>');
  html = html.replaceAll("電池參考壽命", "電池保固");
  html = html.replaceAll("送出後會建立「待訂金」訂單，實際訂金、交期及配備由客服再次確認。", "送出後由客服確認訂單內容與交車安排。");
  html = html.replaceAll("例如：想了解無卡分期、指定顏色或交車時間", "例如：想了解無卡分期或其他需求");
  html = html.replaceAll('<span>顏色</span><select id="color" required></select>', '<span>車款顏色</span><select id="color" required></select>');
  html = html.replace(/<button class="filter-btn" data-filter="lithium">[^<]*<\/button>/,
    '<button class="filter-btn" data-filter="lithium">可選鋰電（7230／7240／7250／7265）</button>');
  return html;
});

patch("products.js", (input) => {
  let js = input;

  js = mustRegex(js,
    /  function mergeRemoteProducts\(remoteItems\) \{[\s\S]*?\n  function productMatches\(product\) \{/,
`  function mergeRemoteProducts(remoteItems) {
    const official = new Map(normalizeProducts(defaults).map((item) => [item.id, item]));
    for (const remote of Array.isArray(remoteItems) ? remoteItems : []) {
      if (!remote?.id || !official.has(remote.id)) continue;
      const base = official.get(remote.id);
      const remoteImages = normalizeProductImages(remote);
      // 正式名稱、版本、電池與價格一律以 GitHub 鎖價目表為準；後台只覆蓋圖片與上下架狀態。
      official.set(remote.id, {
        ...base,
        visible:remote.visible !== false,
        images:remoteImages.length ? remoteImages : normalizeProductImages(base)
      });
    }
    return normalizeProducts([...official.values()]);
  }
  function batteryOptionsFor(product) {
    const official = Array.isArray(product?.batteryOptions) ? product.batteryOptions : [];
    if (official.length) return official.map((item) => ({ ...item, price:Number(item.price || 0) })).filter((item) => item.price > 0);
    const fallback = [{ key:"lead", label:"鉛酸電池", battery:"鉛酸電池", price:Number(product?.priceLead || 0), range:product?.rangeLead || "請洽客服確認", warranty:"6 個月" }];
    if (Number(product?.priceTernary || 0) > 0) fallback.push({ key:"7230", label:"7230 鋰電", battery:"7230 鋰電", price:Number(product.priceTernary), range:product?.rangeTernary || "請洽客服確認", warranty:"1 年" });
    return fallback.filter((item) => item.price > 0);
  }
  function hasTernary(product) { return batteryOptionsFor(product).some((item) => item.key !== "lead"); }
  function hasLiFePO4() { return false; }
  function productMatches(product) {`, "products merge/official price lock");

  js = mustRegex(js,
    /  function batteryLabel\(product\) \{[\s\S]*?\n  function card\(product\) \{/,
`  function batteryLabel(product) {
    const options = batteryOptionsFor(product);
    if (options.length <= 1) return options[0]?.label || "鉛酸版";
    return "鉛酸／7230／7240／7250／7265 鋰電";
  }
  function rangeSummary(product) {
    return batteryOptionsFor(product).map((item) => \`${'${'}item.label} ${'${'}item.range || "請洽客服確認"}\`).join("｜");
  }
  function productBadge(product) {
    return batteryOptionsFor(product).length > 1 ? "多種電池規格可選" : "鉛酸版";
  }
  function priceBlocks(product, tagName = "strong") {
    return batteryOptionsFor(product).map((item) => \`<div><small>${'${'}escapeHtml(item.label)}</small><${'${'}tagName}>${'${'}money(item.price)}</${'${'}tagName}></div>\`).join("");
  }
  function card(product) {`, "products battery render");

  js = mustRegex(js,
    /  function selectedBatteryName\(\) \{[\s\S]*?\n  function updateVariantDetails\(\) \{[\s\S]*?\n  function openProduct\(id\) \{/,
`  function selectedBatteryName() {
    return String($("#variant")?.selectedOptions?.[0]?.dataset.battery || $("#variant")?.selectedOptions?.[0]?.textContent || "鉛酸電池");
  }
  function updateVariantDetails() {
    if (!currentProduct) return;
    const option = $("#variant")?.selectedOptions?.[0];
    $("#modalBattery").textContent = option?.dataset.battery || option?.textContent || "—";
    $("#modalRange").textContent = option?.dataset.range || "請洽客服確認";
    $("#modalLife").textContent = option?.dataset.warranty || "請洽客服確認";
    updateTotal();
  }
  function openProduct(id) {`, "products selected battery details");

  js = mustRegex(js,
    /    const variants = \[\{ label:"鉛酸版"[\s\S]*?    \$\("#color"\)\.innerHTML = \(currentProduct\.colors \|\| \["顏色請洽客服"\]\)\.map\(\(color\) => `<option>\$\{escapeHtml\(color\)\}<\/option>`\)\.join\(""\);/,
`    const variants = batteryOptionsFor(currentProduct);
    $("#variant").innerHTML = variants.map((variant) => \`<option data-kind="${'${'}escapeHtml(variant.key)}" data-battery="${'${'}escapeHtml(variant.battery || variant.label)}" data-range="${'${'}escapeHtml(variant.range || "")}" data-warranty="${'${'}escapeHtml(variant.warranty || "")}" data-price="${'${'}variant.price}">${'${'}escapeHtml(variant.label)}</option>\`).join("");
    $("#color").innerHTML = \`<option>車款顏色依現貨為主</option>\`;`, "products option builder");

  js = js.replace(
    'const isTrike = String(product?.name || "").includes("三輪");\n    if (isTrike) {',
    'const noLicense = product?.licenseRequired === false || String(product?.name || "").includes("小紅豆");\n    const isTrike = String(product?.name || "").includes("三輪");\n    if (noLicense) {\n      select.innerHTML = `<option value="不需代辦領牌" data-fee="0" data-hint="此車款不套用領牌代辦費。">不需代辦領牌</option>`;\n      select.disabled = true;\n      return;\n    }\n    if (isTrike) {'
  );

  js = js.replaceAll("請協助確認訂金與交車。", "請協助確認訂單內容與交車安排。");
  js = js.replaceAll("請協助確認訂金、領牌方式與交車安排。", "請協助確認訂單內容、領牌方式與交車安排。");
  js = mustReplace(js, 'doc(db, "onlineOrders", orderId)', 'doc(db, "orders", orderId)', "public order collection");
  js = js.replace('vehicleVariant:variant, battery:selectedBatteryName(),', 'vehicleVariant:`${currentProduct.style || "標準版"}｜${selectedBatteryName()}`, battery:selectedBatteryName(), style:currentProduct.style || "標準版",');
  js = js.replace('status:"待審核", reviewStatus:"pending"', 'status:"待驗證", reviewStatus:"pending"');
  js = js.replace('notes:`官方商城送出，待後台接受確認。${note ? ` 客戶備註：${note}` : ""}`', 'notes:`官方商城送出，待後台確認。${note ? ` 客戶備註：${note}` : ""}`');
  return js;
});

patch("home.js", (input) => {
  let js = input;
  js = mustRegex(js,
    /  function mergeRemote\(remote\)\{[\s\S]*?\n  function renderProducts\(products\)\{/,
`  function mergeRemote(remote){const map=new Map(normalize(defaults).map((p)=>[p.id,{...p}]));for(const r of remote||[]){if(!r?.id||!map.has(r.id))continue;const base=map.get(r.id);const imgs=imageUrls(r);map.set(r.id,{...base,visible:r.visible!==false,images:imgs.length?imgs:imageUrls(base)});}return normalize([...map.values()]);}
  function batteryOptionsFor(p){const list=Array.isArray(p?.batteryOptions)?p.batteryOptions:[];if(list.length)return list.map((x)=>({...x,price:Number(x.price||0)})).filter((x)=>x.price>0);return [{key:'lead',label:'鉛酸電池',price:Number(p?.priceLead||0),range:p?.rangeLead||'請洽客服確認'}].filter((x)=>x.price>0);}
  function hasTernary(p){return batteryOptionsFor(p).some((x)=>x.key!=='lead');}
  function hasLiFePO4(){return false;}
  function batterySummary(p){const x=batteryOptionsFor(p);return x.length>1?'鉛酸／7230／7240／7250／7265 鋰電':(x[0]?.label||'鉛酸版');}
  function rangeSummary(p){return batteryOptionsFor(p).map((x)=>\`${'${'}x.label} ${'${'}x.range||'請洽客服確認'}\`).join('｜');}
  function badgeText(p){return batteryOptionsFor(p).length>1?'多種電池規格可選':'鉛酸版';}
  function card(p){const img=imageUrls(p)[0]||'/icon-512.png';const priceBlocks=batteryOptionsFor(p).map((x)=>\`<div><small>${'${'}escapeHtml(x.label)}</small><strong>${'${'}money(x.price)}</strong></div>\`);return \`<article class="product-card"><a class="product-photo" href="/products.html#${'${'}escapeHtml(p.id)}"><img src="${'${'}escapeHtml(img)}" alt="${'${'}escapeHtml(p.name)} 實車照片" loading="lazy" onerror="this.onerror=null;this.src='/icon-512.png'"><span class="tag">${'${'}escapeHtml(badgeText(p))}</span></a><div class="product-body"><div><span class="product-style">${'${'}escapeHtml(p.style||'')}</span><h3>${'${'}escapeHtml(p.name)}</h3></div><div class="spec-row"><span>🔋 ${'${'}escapeHtml(batterySummary(p))}</span><span>🛣️ ${'${'}escapeHtml(rangeSummary(p))}</span></div><div class="model-prices">${'${'}priceBlocks.join('')}</div><div class="price-note">車價不含領牌保險代辦；代辦另加 NT$3,000。</div><div class="price-row"><a class="btn btn-primary full-width" href="/products.html#${'${'}escapeHtml(p.id)}">看詳情</a></div></div></article>\`;}
  function renderProducts(products){`, "home official price render");

  js = mustRegex(js,
    /    const batteryOptions=\(p\)=>\{[\s\S]*?\n    \};/,
`    const batteryOptions=(p)=>batteryOptionsFor(p);`, "installment battery options");
  js = js.replace("function productCanLicense(p){return p?.id!==\"scooter-12\"&&!/無法領牌|不可領牌/.test(String(p?.note||''));}", "function productCanLicense(p){return p?.licenseRequired!==false&&!/無法領牌|不可領牌/.test(String(p?.note||''));}");
  js = js.replace("batteryKey:r.battery?.key||''", "batteryKey:(r.battery?.key==='lead'?'lead':'ternary')");
  return js;
});

patch("index.html", (html) => html.replaceAll("車款、電池、價格與交期集中展示", "車款、電池與價格集中展示"));

patch("admin/orders.html", (input) => {
  let html = input;
  html = mustRegex(html, /<select id="model" required>[\s\S]*?<\/select>/,
`<select id="model" required>
              <option value="">請選擇車款</option>
              <option>大偉士</option><option>Z3 天鵝座</option><option>正9號</option><option>小偉士</option><option>神盾</option>
              <option>DIO</option><option>拿鐵</option><option>QC</option><option>小紅豆｜電輔車</option><option>H1</option><option>其他</option>
            </select>`, "admin model list");
  html = html.replaceAll("車款版本 *", "版本／電池規格 *");
  html = html.replaceAll("代辦（另加 NT$2,500）", "代辦（另加 NT$3,000）");
  html = html.replace('placeholder="紫色"', 'placeholder="依現貨為主／交車時填實際顏色"');
  html = html.replace(/<p class="note">請在 Firestore 建立 <code>admins[\s\S]*?<\/p>/, '<p class="note">此帳號尚未取得小宇微電後台權限，請由管理員確認員工帳號綁定。</p>');
  return html;
});

patch("admin/orders.js", (input) => {
  let js = input;
  const priceTable = `
const XIAOYU_PRICE_TABLE = {
  "大偉士": [
    ["普通版｜鉛酸電池","鉛酸電池",33000],["普通版｜7230 鋰電","7230 鋰電",49800],["普通版｜7240 鋰電","7240 鋰電",54800],["普通版｜7250 鋰電","7250 鋰電",60800],["普通版｜7265 鋰電","7265 鋰電",67800],
    ["改裝特仕版｜鉛酸電池","鉛酸電池",35000],["改裝特仕版｜7230 鋰電","7230 鋰電",51800],["改裝特仕版｜7240 鋰電","7240 鋰電",56800],["改裝特仕版｜7250 鋰電","7250 鋰電",62800],["改裝特仕版｜7265 鋰電","7265 鋰電",69800]
  ],
  "Z3 天鵝座": [
    ["普通版｜鉛酸電池","鉛酸電池",36000],["普通版｜7230 鋰電","7230 鋰電",52800],["普通版｜7240 鋰電","7240 鋰電",57800],["普通版｜7250 鋰電","7250 鋰電",63800],["普通版｜7265 鋰電","7265 鋰電",70800],
    ["暗魂版｜鉛酸電池","鉛酸電池",38000],["暗魂版｜7230 鋰電","7230 鋰電",54800],["暗魂版｜7240 鋰電","7240 鋰電",59800],["暗魂版｜7250 鋰電","7250 鋰電",65800],["暗魂版｜7265 鋰電","7265 鋰電",72800]
  ],
  "正9號": [
    ["曠達版｜鉛酸電池","鉛酸電池",35000],["曠達版｜7230 鋰電","7230 鋰電",51800],["曠達版｜7240 鋰電","7240 鋰電",56800],["曠達版｜7250 鋰電","7250 鋰電",62800],["曠達版｜7265 鋰電","7265 鋰電",69800],
    ["金大力版｜鉛酸電池","鉛酸電池",35000],["金大力版｜7230 鋰電","7230 鋰電",51800],["金大力版｜7240 鋰電","7240 鋰電",56800],["金大力版｜7250 鋰電","7250 鋰電",62800],["金大力版｜7265 鋰電","7265 鋰電",69800]
  ],
  "小偉士": [["標準版｜鉛酸電池","鉛酸電池",27400],["標準版｜7230 鋰電","7230 鋰電",45800],["標準版｜7240 鋰電","7240 鋰電",50800],["標準版｜7250 鋰電","7250 鋰電",56800],["標準版｜7265 鋰電","7265 鋰電",63800]],
  "神盾": [["標準版｜鉛酸電池","鉛酸電池",29000],["標準版｜7230 鋰電","7230 鋰電",47400],["標準版｜7240 鋰電","7240 鋰電",52400],["標準版｜7250 鋰電","7250 鋰電",58400],["標準版｜7265 鋰電","7265 鋰電",65400]],
  "DIO": [["標準版｜鉛酸電池","鉛酸電池",30000],["標準版｜7230 鋰電","7230 鋰電",48400],["標準版｜7240 鋰電","7240 鋰電",53400],["標準版｜7250 鋰電","7250 鋰電",59400],["標準版｜7265 鋰電","7265 鋰電",66400]],
  "拿鐵": [["標準版｜鉛酸電池","鉛酸電池",30000],["標準版｜7230 鋰電","7230 鋰電",48400],["標準版｜7240 鋰電","7240 鋰電",53400],["標準版｜7250 鋰電","7250 鋰電",59400],["標準版｜7265 鋰電","7265 鋰電",66400]],
  "QC": [["標準版｜鉛酸電池","鉛酸電池",33000],["標準版｜7230 鋰電","7230 鋰電",49800],["標準版｜7240 鋰電","7240 鋰電",54800],["標準版｜7250 鋰電","7250 鋰電",60800],["標準版｜7265 鋰電","7265 鋰電",67800]],
  "小紅豆｜電輔車": [["標準版｜鉛酸整車","鉛酸整車",18500]],
  "H1": [["特仕版｜鉛酸電池","鉛酸電池",38000],["特仕版｜7230 鋰電","7230 鋰電",54800],["特仕版｜7240 鋰電","7240 鋰電",59800],["特仕版｜7250 鋰電","7250 鋰電",65800],["特仕版｜7265 鋰電","7265 鋰電",72800]],
  "其他": [["其他／手動輸入","其他",0]]
};
function xiaoyuVariants(model) {
  return (XIAOYU_PRICE_TABLE[model] || XIAOYU_PRICE_TABLE["其他"]).map(([label,battery,price]) => ({ label,battery,price,cost:0 }));
}
`;
  js = mustReplace(js, "\nconst VEHICLE_COSTS = {", `${priceTable}\nconst VEHICLE_COSTS = {`, "admin price table insert");
  js = mustRegex(js, /function variantOptionsFor\(model\) \{[\s\S]*?\n\}/,
`function variantOptionsFor(model) {
  if (currentContext?.legacy) return xiaoyuVariants(model);
  return VEHICLE_COSTS[model] || VEHICLE_COSTS["其他"];
}`, "admin variant source");

  js = mustRegex(js, /function updateVariantOptions\(\{ savedVariant = "", savedCost = null \} = \{\}\) \{[\s\S]*?\n\}/,
`function updateVariantOptions({ savedVariant = "", savedCost = null, savedPrice = null } = {}) {
  const variants = variantOptionsFor(fields.model.value);
  fields.vehicleVariant.innerHTML = variants.map((item) => \`<option value="${'${'}escapeHtml(item.label)}">${'${'}escapeHtml(item.label)}</option>\`).join("");
  const wanted = variants.some((item) => item.label === savedVariant) ? savedVariant : variants[0].label;
  fields.vehicleVariant.value = wanted;
  const info = selectedVariantInfo();
  if (fields.battery.tagName === "SELECT") {
    fields.battery.innerHTML = \`<option>${'${'}escapeHtml(info.battery)}</option>\`;
  }
  fields.battery.value = info.battery;
  fields.cost.value = savedCost === null ? String(info.cost || 0) : String(numberValue(savedCost));
  if (currentContext?.legacy) fields.price.value = savedPrice === null ? String(info.price || 0) : String(numberValue(savedPrice));
  updateMoneyPreview();
}`, "admin variant updater");

  js = mustRegex(js, /function applySelectedVariantCost\(\) \{[\s\S]*?\n\}/,
`function applySelectedVariantCost() {
  const info = selectedVariantInfo();
  if (fields.battery.tagName === "SELECT") fields.battery.innerHTML = \`<option>${'${'}escapeHtml(info.battery)}</option>\`;
  fields.battery.value = info.battery;
  fields.cost.value = String(info.cost || 0);
  if (currentContext?.legacy) fields.price.value = String(info.price || 0);
  updateMoneyPreview();
}`, "admin variant selection");

  js = js.replace('fields.licenseMode.value = "代辦（另加 NT$2,500）";', 'fields.licenseMode.value = "代辦（另加 NT$3,000）";');
  js = js.replace('fields.model.value = currentContext?.legacy ? "小偉士" : "";', 'fields.model.value = currentContext?.legacy ? "大偉士" : "";');
  js = js.replace('updateVariantOptions({ savedVariant: order.vehicleVariant || inferVariant({ ...order, model: formModel }), savedCost: effectiveCost(order) });', 'updateVariantOptions({ savedVariant: order.vehicleVariant || inferVariant({ ...order, model: formModel }), savedCost: effectiveCost(order), savedPrice:numberValue(order.price) });');
  js = js.replace('await loadTenantModels();\n  await loadOrders();', 'await loadTenantModels();\n  resetForm();\n  await loadOrders();');
  js = js.replace('const dates = { delivery, vehicleEnd: addMonths(delivery, 12), batteryEnd: addMonths(delivery, 6) };', 'const lithiumBattery = /鋰/.test(String(order.battery || order.vehicleVariant || ""));\n  const dates = { delivery, vehicleEnd: addMonths(delivery, 12), batteryEnd: addMonths(delivery, lithiumBattery ? 12 : 6) };');
  js = js.replace('terms: "整車保固一年、電池保固六個月；人為損壞、泡水、事故、耗材自然磨損及非授權改裝或拆修不在保固範圍內。",', 'terms: lithiumBattery ? "整車保固一年、鋰電池保固一年；人為損壞、泡水、事故、耗材自然磨損及非授權改裝或拆修不在保固範圍內。" : "整車保固一年、鉛酸電池保固六個月；人為損壞、泡水、事故、耗材自然磨損及非授權改裝或拆修不在保固範圍內。",');
  return js;
});

console.log("Applied Xiaoyu final storefront/order/price fixes.");
