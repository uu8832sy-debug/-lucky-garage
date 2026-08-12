(() => {
  "use strict";

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const storeConfig = window.YU_STORE_CONFIG || {};
  const defaults = Array.isArray(window.YU_PRODUCT_CATALOG)
    ? window.YU_PRODUCT_CATALOG.map((item) => JSON.parse(JSON.stringify(item)))
    : [];

  let products = normalizeProducts(defaults);
  let currentProduct = null;
  let currentFilter = "all";
  let captchaValue = 0;
  let firestoreApi = null;

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>'"]/g, (char) => ({
      "&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#39;", '"':"&quot;"
    }[char]));
  }
  function money(value) {
    return `NT$${Math.max(0, Number(value) || 0).toLocaleString("zh-TW")}`;
  }
  function normalizeImageUrl(value) {
    const url = String(value || "").trim();
    if (!url) return "";
    if (/^(https?:|data:|blob:)/i.test(url)) return url;
    return url.startsWith("/") ? url : `/${url.replace(/^\.\//, "")}`;
  }
  function normalizeProductImages(product) {
    const source = Array.isArray(product?.images) ? product.images
      : Array.isArray(product?.photos) ? product.photos
      : [];
    const normalized = source.map((item, index) => {
      if (typeof item === "string") return { url:normalizeImageUrl(item), isPrimary:false, _index:index };
      return {
        ...item,
        url:normalizeImageUrl(item?.url || item?.imageUrl || item?.src || ""),
        isPrimary:item?.isPrimary === true,
        _index:index
      };
    }).filter((item) => item.url);
    if (!normalized.length) {
      const fallback = normalizeImageUrl(product?.primaryImageUrl || product?.imageUrl || product?.coverImage || product?.image || "");
      return fallback ? [{ url:fallback, isPrimary:true }] : [];
    }
    const canonicalPrimary = normalizeImageUrl(product?.primaryImageUrl || "");
    let primaryIndex = canonicalPrimary ? normalized.findIndex((item) => item.url === canonicalPrimary) : -1;
    if (primaryIndex < 0) primaryIndex = normalized.findIndex((item) => item.isPrimary);
    // 相容 V30/V30.1 已上傳但未設主圖的舊資料：若主圖仍是內建靜態圖，優先顯示最後一張後台自訂圖。
    if (!canonicalPrimary) {
      const current = normalized[primaryIndex];
      const currentLooksStatic = !current || current.static === true || /^\/?assets\/products\//i.test(String(current.url || "").replace(/^\//, ""));
      const customIndexes = normalized.map((item,index)=>({item,index})).filter(({item}) => item.path || item.embedded || /^data:/i.test(item.url) || /^https?:/i.test(item.url));
      if (currentLooksStatic && customIndexes.length) primaryIndex = customIndexes[customIndexes.length - 1].index;
    }
    if (primaryIndex < 0) primaryIndex = 0;
    normalized.forEach((item, index) => { item.isPrimary = index === primaryIndex; });
    const ordered = [normalized[primaryIndex], ...normalized.filter((_, index) => index !== primaryIndex)];
    return ordered.map(({ _index, ...item }) => item);
  }
  function imageUrls(product) {
    return normalizeProductImages(product).map((item) => item.url).filter(Boolean);
  }
  function normalizeProducts(items) {
    return (Array.isArray(items) ? items : [])
      .map((item, index) => ({
        ...item,
        id: String(item.id || `product-${index + 1}`),
        order: Number(item.order || index + 1),
        visible: item.visible !== false,
        images: normalizeProductImages(item)
      }))
      .filter((item) => item.visible !== false)
      .sort((a, b) => a.order - b.order);
  }
  function mergeRemoteProducts(remoteItems) {
    const defaultMap = new Map(normalizeProducts(defaults).map((item) => [item.id, item]));
    for (const remote of Array.isArray(remoteItems) ? remoteItems : []) {
      if (!remote?.id) continue;
      const base = defaultMap.get(remote.id);
      const remoteImages = normalizeProductImages(remote);
      if (base) {
        // 後台商品資料優先；只要雲端有圖片就完整採用主圖設定，沒有才回退內建實車圖。
        defaultMap.set(remote.id, {
          ...base,
          ...remote,
          visible: remote.visible !== false,
          images: remoteImages.length ? remoteImages : normalizeProductImages(base)
        });
      } else if (remote.visible !== false) {
        defaultMap.set(remote.id, { ...remote, images: remoteImages });
      }
    }
    return normalizeProducts([...defaultMap.values()]);
  }
  function hasTernary(product) {
    return Number(product.priceTernary || 0) > 0;
  }
  function hasLiFePO4(product) {
    return Number(product.priceLithium || 0) > 0;
  }
  function productMatches(product) {
    if (currentFilter === "all") return true;
    if (currentFilter === "lithium") return hasTernary(product) || hasLiFePO4(product);
    if (currentFilter === "lead-only") return !hasTernary(product) && !hasLiFePO4(product);
    if (currentFilter === "展示") return String(product.name || "").includes("三輪");
    return true;
  }
  function batteryLabel(product) {
    const versions = ["鉛酸"];
    if (hasTernary(product)) versions.push("三元鋰 30Ah");
    if (hasLiFePO4(product)) versions.push("鋰鐵 30Ah");
    return versions.length > 1 ? versions.join("／") : "鉛酸版";
  }
  function rangeSummary(product) {
    const parts = [`鉛酸 ${product.rangeLead || "請洽客服確認"}`];
    if (hasTernary(product)) parts.push(`三元鋰 ${product.rangeTernary || "請洽客服確認"}`);
    if (hasLiFePO4(product)) parts.push(`鋰鐵 ${product.rangeLithium || "請洽客服確認"}`);
    return parts.join("｜");
  }
  function productBadge(product) {
    if (hasTernary(product) && hasLiFePO4(product)) return "三種電池可選";
    if (hasTernary(product)) return "可選三元鋰 30Ah";
    if (hasLiFePO4(product)) return "可選鋰鐵 30Ah";
    return "鉛酸版";
  }
  function priceBlocks(product, tagName = "strong") {
    const rows = [
      `<div><small>鉛酸版</small><${tagName}>${money(product.priceLead)}</${tagName}></div>`
    ];
    if (hasTernary(product)) rows.push(`<div><small>三元鋰 30Ah</small><${tagName}>${money(product.priceTernary)}</${tagName}></div>`);
    if (hasLiFePO4(product)) rows.push(`<div><small>鋰鐵 30Ah</small><${tagName}>${money(product.priceLithium)}</${tagName}></div>`);
    return rows.join("");
  }
  function card(product) {
    const photos = imageUrls(product);
    const photo = photos[0] || "/icon-512.png";
    return `<article class="product-card" id="${escapeHtml(product.id)}">
      <button class="product-photo open-product" type="button" data-id="${escapeHtml(product.id)}" aria-label="查看 ${escapeHtml(product.name)}">
        <img src="${escapeHtml(photo)}" alt="${escapeHtml(product.name)} 實車照片" loading="lazy" decoding="async" onerror="this.onerror=null;this.src='/icon-512.png'">
        <span class="tag">${escapeHtml(productBadge(product))}</span>
      </button>
      <div class="product-body">
        <div><span class="product-style">${escapeHtml(product.style || "")}</span><h3>${escapeHtml(product.name)}</h3></div>
        <div class="spec-row"><span>🔋 ${escapeHtml(batteryLabel(product))}</span><span>🛣️ ${escapeHtml(rangeSummary(product))}</span></div>
        <div class="model-prices">${priceBlocks(product)}</div>
        <div class="price-note">以上為車價；代辦領牌＋保險另加 NT$3,000。</div>
        <div class="price-row"><button class="btn btn-primary open-product full-width" type="button" data-id="${escapeHtml(product.id)}">看詳情／訂購</button></div>
      </div>
    </article>`;
  }
  function renderPriceList() {
    const box = $("#priceTable");
    if (!box) return;
    box.innerHTML = products.map((product) => `<article class="price-list-card">
      <div><span>${escapeHtml(product.style || "")}</span><strong>${escapeHtml(product.name)}</strong></div>
      <div class="price-list-values">
        <p><small>鉛酸版</small><b>${money(product.priceLead)}</b></p>
        ${hasTernary(product) ? `<p><small>三元鋰 30Ah</small><b>${money(product.priceTernary)}</b></p>` : ""}
        ${hasLiFePO4(product) ? `<p><small>鋰鐵 30Ah</small><b>${money(product.priceLithium)}</b></p>` : ""}
      </div>
    </article>`).join("");
  }
  function bindProductButtons() {
    $$(".open-product").forEach((button) => {
      button.addEventListener("click", () => openProduct(button.dataset.id));
    });
  }
  function render() {
    const grid = $("#productGrid");
    if (!grid) return;
    const list = products.filter(productMatches);
    grid.innerHTML = list.length ? list.map(card).join("") : '<p class="empty">此分類目前沒有商品。</p>';
    renderPriceList();
    bindProductButtons();
  }
  function showToast(message) {
    const toast = $("#toast");
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove("show"), 3300);
  }
  function officialLineId() {
    return String(storeConfig.lineId || "@762eqvlg").trim() || "@762eqvlg";
  }
  function lineChatUrl() {
    return storeConfig.lineUrl || "https://line.me/R/ti/p/%40762eqvlg";
  }
  async function copyTextRobust(text) {
    const value = String(text || "");
    if (!value) return false;
    try { if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(value); return true; } } catch {}
    try {
      const textarea = document.createElement("textarea");
      textarea.value = value; textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed"; textarea.style.opacity = "0"; textarea.style.pointerEvents = "none";
      document.body.appendChild(textarea); textarea.focus(); textarea.select(); textarea.setSelectionRange(0, value.length);
      const ok = document.execCommand("copy"); textarea.remove(); return !!ok;
    } catch { return false; }
  }
  function compactLineMessage({ orderId, customerName, phone, variant, color }) {
    return `官網訂單 ${orderId}\n${currentProduct?.name || "車款"}｜${variant}｜${color}\n${customerName} ${phone}\n請協助確認訂金與交車。`;
  }
  let latestOrderFullMessage = "";
  function showOrderSuccess(orderId, saved, lineUrl, fullMessage, prefillMessage, duplicate = false) {
    const screen = $("#orderSuccessScreen");
    if (!screen) return;
    latestOrderFullMessage = String(fullMessage || prefillMessage || "");
    $("#orderSuccessTitle").textContent = duplicate ? "已沿用上一筆訂單" : (saved ? "訂單已建立" : "訂單需求已準備");
    $("#orderSuccessText").textContent = duplicate
      ? "系統已沿用上一筆訂單。請按下方「複製訂單並開啟 LINE」。系統會先複製完整訂單，再開啟官方 LINE；進入聊天室後長按輸入框貼上即可。"
      : (saved
        ? "訂單已送進小宇微電系統。請按下方「複製訂單並開啟 LINE」。系統會先複製完整訂單，再開啟官方 LINE；進入聊天室後長按輸入框貼上即可。"
        : "訂購內容已整理完成。請按下方「複製訂單並開啟 LINE」。系統會先複製完整訂單，再開啟官方 LINE；進入聊天室後長按輸入框貼上即可。" );
    $("#orderSuccessId").textContent = orderId;
    const preview = $("#orderSuccessPreview");
    if (preview) preview.textContent = latestOrderFullMessage;
    const lineButton = $("#orderSuccessLine");
    lineButton.href = lineUrl || (storeConfig.lineUrl || "https://line.me/R/ti/p/%40762eqvlg");
    screen.classList.add("show");
    screen.setAttribute("aria-hidden", "false");
  }
  function cleanPhone(value) {
    let digits = String(value || "").replace(/\D/g, "");
    if (digits.startsWith("886")) digits = `0${digits.slice(3)}`;
    return digits;
  }
  function taipeiDayKey() {
    try {
      const parts = new Intl.DateTimeFormat("en-CA", { timeZone:"Asia/Taipei", year:"numeric", month:"2-digit", day:"2-digit" }).formatToParts(new Date());
      const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
      return `${values.year}${values.month}${values.day}`;
    } catch {
      const date = new Date();
      return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
    }
  }
  async function fingerprintToken(value) {
    const input = String(value || "");
    try {
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
      return [...new Uint8Array(digest)].slice(0, 6).map((byte) => byte.toString(16).padStart(2, "0")).join("").toUpperCase();
    } catch {
      let hash = 2166136261;
      for (let i = 0; i < input.length; i += 1) { hash ^= input.charCodeAt(i); hash = Math.imul(hash, 16777619); }
      return Math.abs(hash >>> 0).toString(16).padStart(8, "0").toUpperCase();
    }
  }
  async function makeOrderId(fingerprint) {
    return `WEB-${taipeiDayKey()}-${await fingerprintToken(fingerprint)}`;
  }
  function newCaptcha() {
    const first = Math.floor(Math.random() * 8) + 2;
    const second = Math.floor(Math.random() * 8) + 2;
    captchaValue = first + second;
    $("#captchaQuestion").textContent = `人類驗證：${first} + ${second} = ?`;
    $("#captchaAnswer").value = "";
  }
  function setMainPhoto(url, index = 0) {
    const main = $("#mainPhoto");
    main.src = url || "/icon-512.png";
    main.onerror = () => { main.onerror = null; main.src = "/icon-512.png"; };
    $$(".thumb").forEach((button, buttonIndex) => button.classList.toggle("active", buttonIndex === index));
  }
  function updateTotal() {
    const option = $("#variant")?.selectedOptions?.[0];
    const licenseOption = $("#licenseMode")?.selectedOptions?.[0];
    const vehiclePrice = Number(option?.dataset.price || 0);
    const licenseFee = Number(licenseOption?.dataset.fee || 0);
    $("#total").textContent = money(vehiclePrice + licenseFee);
    const label = $("#totalLabel");
    if (label) label.textContent = licenseFee > 0 ? "車價＋代辦" : "參考車價";
    const hint = $("#licenseHint");
    if (hint && licenseOption) hint.textContent = licenseOption.dataset.hint || "";
  }
  function setupLicenseOptions(product) {
    const select = $("#licenseMode");
    if (!select) return;
    const isTrike = String(product?.name || "").includes("三輪");
    if (isTrike) {
      select.innerHTML = `<option value="不可領牌" data-fee="0" data-hint="此車款目前標示為無法領牌，請先洽客服確認使用場域與規範。">此車款無法領牌</option>`;
      select.disabled = true;
      return;
    }
    select.disabled = false;
    select.innerHTML = `
      <option value="自行領牌" data-fee="0" data-hint="自行領牌：保險＋領牌規費約 NT$1,800 多；車輛一般不必到監理站，攜帶領牌文件即可。實際依監理站規定為準。">自行前往監理站領牌（建議，可省代辦費）</option>
      <option value="小宇代辦" data-fee="3000" data-hint="小宇代辦領牌＋保險：車價另加 NT$3,000，後續由客服確認所需文件與流程。">小宇代辦領牌＋保險（另加 NT$3,000）</option>`;
  }

  function selectedVariantKind() {
    return String($("#variant")?.selectedOptions?.[0]?.dataset.kind || "lead");
  }
  function selectedBatteryName() {
    const kind = selectedVariantKind();
    if (kind === "ternary") return "三元鋰30Ah";
    if (kind === "lifepo4") return "鋰鐵30Ah（可抽取）";
    return "鉛酸";
  }
  function updateVariantDetails() {
    if (!currentProduct) return;
    const kind = selectedVariantKind();
    if (kind === "ternary") {
      $("#modalBattery").textContent = "三元鋰 30Ah";
      $("#modalRange").textContent = currentProduct.rangeTernary || "請洽客服確認";
      $("#modalLife").textContent = currentProduct.lifeTernary || "請洽客服確認";
    } else if (kind === "lifepo4") {
      $("#modalBattery").textContent = "鋰鐵 30Ah（可抽取）";
      $("#modalRange").textContent = currentProduct.rangeLithium || "請洽客服確認";
      $("#modalLife").textContent = currentProduct.lifeLithium || "約 8–10 年";
    } else {
      $("#modalBattery").textContent = "鉛酸版";
      $("#modalRange").textContent = currentProduct.rangeLead || "請洽客服確認";
      $("#modalLife").textContent = currentProduct.lifeLead || "約 2 年";
    }
    updateTotal();
  }
  function openProduct(id) {
    currentProduct = products.find((product) => product.id === id);
    if (!currentProduct) return;
    const photos = imageUrls(currentProduct);
    $("#modalTitle").textContent = `${currentProduct.name}｜商品詳情`;
    $("#modalStyle").textContent = currentProduct.style || "";
    $("#modalName").textContent = currentProduct.name;
    $("#modalNote").textContent = currentProduct.description || currentProduct.note || "實際現車與配備請洽客服確認。";
    const featureBox = $("#modalFeatures");
    if (featureBox) {
      const features = Array.isArray(currentProduct.features) ? currentProduct.features : [];
      featureBox.innerHTML = features.map((item) => `<span>${escapeHtml(item)}</span>`).join("");
      featureBox.hidden = !features.length;
    }
    $("#thumbs").innerHTML = photos.map((url, index) => `<button class="thumb ${index === 0 ? "active" : ""}" type="button" data-index="${index}"><img src="${escapeHtml(url)}" alt="${escapeHtml(currentProduct.name)} 圖片 ${index + 1}" onerror="this.onerror=null;this.src='/icon-192.png'"></button>`).join("");
    $$(".thumb").forEach((button) => button.addEventListener("click", () => setMainPhoto(photos[Number(button.dataset.index)], Number(button.dataset.index))));
    setMainPhoto(photos[0] || "/icon-512.png");
    const variants = [{ label:"鉛酸版", kind:"lead", price:Number(currentProduct.priceLead || 0) }];
    if (Number(currentProduct.priceTernary || 0) > 0) variants.push({ label:"三元鋰 30Ah", kind:"ternary", price:Number(currentProduct.priceTernary) });
    if (Number(currentProduct.priceLithium || 0) > 0) variants.push({ label:"鋰鐵 30Ah（可抽取）", kind:"lifepo4", price:Number(currentProduct.priceLithium) });
    $("#variant").innerHTML = variants.map((variant) => `<option data-kind="${variant.kind}" data-price="${variant.price}">${escapeHtml(variant.label)}</option>`).join("");
    $("#color").innerHTML = (currentProduct.colors || ["顏色請洽客服"]).map((color) => `<option>${escapeHtml(color)}</option>`).join("");
    setupLicenseOptions(currentProduct);
    $("#orderForm").reset();
    updateVariantDetails();
    newCaptcha();
    $("#productModal").classList.add("open");
    $("#productModal").setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    history.replaceState(null, "", `#${encodeURIComponent(id)}`);
  }
  function closeProduct() {
    $("#productModal").classList.remove("open");
    $("#productModal").setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    currentProduct = null;
    history.replaceState(null, "", `${location.pathname}${location.search}`);
  }
  function lineMessage({ orderId, customerName, phone, address, note, variant, color, vehiclePrice, licenseMode, licenseFee, totalPrice }) {
    return `您好小宇，我想訂購：\n訂單編號：${orderId}\n車款：${currentProduct.name}（${currentProduct.style || ""}）\n電池版本：${variant}\n顏色：${color}\n車價：${money(vehiclePrice)}\n領牌方式：${licenseMode}${licenseFee ? `（代辦費 ${money(licenseFee)}）` : ""}\n參考總額：${money(totalPrice)}\n姓名：${customerName}\n電話：${phone}\n地址：${address}${note ? `\n備註：${note}` : ""}\n請協助確認訂金、領牌方式與交車安排。`;
  }
  const DUPLICATE_WINDOW_MS = 24 * 60 * 60 * 1000;
  function submissionFingerprint({ productId, variant, color, phone, address, licenseMode }) {
    return [productId, variant, color, phone, address, licenseMode].map((value) => String(value || "").trim().toLowerCase()).join("|");
  }
  function readRecentSubmission(fingerprint) {
    try {
      const item = JSON.parse(sessionStorage.getItem("YU_RECENT_ORDER") || "null");
      if (!item || item.fingerprint !== fingerprint || !item.orderId || !item.message) return null;
      if (Date.now() - Number(item.time || 0) > DUPLICATE_WINDOW_MS) return null;
      return item;
    } catch { return null; }
  }
  function rememberSubmission(payload) {
    try { sessionStorage.setItem("YU_RECENT_ORDER", JSON.stringify({ ...payload, time:Date.now() })); } catch {}
  }

  async function submitOrder(event) {
    event.preventDefault();
    if (!currentProduct || $("#website").value) return;
    if (Number($("#captchaAnswer").value) !== captchaValue) {
      newCaptcha();
      showToast("驗證答案錯誤，請重新計算。");
      return;
    }
    const customerName = $("#customerName").value.trim();
    const phone = cleanPhone($("#phone").value);
    const address = $("#address").value.trim();
    const note = $("#customerNote").value.trim();
    if (!customerName || phone.length < 9 || address.length < 3) {
      showToast("請確認姓名、手機與送車地址。");
      return;
    }
    const option = $("#variant").selectedOptions[0];
    const variant = option.textContent;
    const vehiclePrice = Math.round(Number(option.dataset.price || 0));
    const licenseOption = $("#licenseMode")?.selectedOptions?.[0];
    const licenseMode = licenseOption?.value || "自行領牌";
    const licenseFee = Math.round(Number(licenseOption?.dataset.fee || 0));
    const totalPrice = vehiclePrice + licenseFee;
    const color = $("#color").value;
    const fingerprint = submissionFingerprint({ productId:currentProduct.id, variant, color, phone, address, licenseMode });
    const recent = readRecentSubmission(fingerprint);
    if (recent) {
      const recentPrefill = recent.prefillMessage || recent.message;
      const recentLineUrl = lineChatUrl();
      showToast(`已沿用訂單 ${recent.orderId}，避免重複建立。`);
      closeProduct();
      showOrderSuccess(recent.orderId, true, recentLineUrl, recent.message, recentPrefill, true);
      return;
    }
    const orderId = await makeOrderId(fingerprint);
    const message = lineMessage({ orderId, customerName, phone, address, note, variant, color, vehiclePrice, licenseMode, licenseFee, totalPrice });
    const prefillMessage = compactLineMessage({ orderId, customerName, phone, variant, color });
    const targetLineUrl = lineChatUrl();
    const button = $("#submitOrder");
    button.disabled = true;
    button.textContent = "訂單送出中…";
    let saved = false;
    let duplicateBlocked = false;
    try {
      if (firestoreApi) {
        const { db, doc, setDoc, serverTimestamp } = firestoreApi;
        const stamp = serverTimestamp();
        await setDoc(doc(db, "onlineOrders", orderId), {
          orderNo:orderId, orderId, source:"official-store", customerName, custName:customerName,
          phone, custPhone:phone, address, custAddress:address, model:currentProduct.name,
          itemName:`${currentProduct.name} ${currentProduct.style || ""}`.trim(), color,
          vehicleVariant:variant, battery:selectedBatteryName(),
          price:vehiclePrice, totalAmount:money(totalPrice), cost:0, netProfit:vehiclePrice, deposit:0, balancePaid:0,
          licenseMode, deliveryMode:"到府交車", paymentMethod:"待確認",
          paymentTerms:"待客服確認", status:"待審核", reviewStatus:"pending", deliveredAt:"",
          notes:`官方商城送出，待後台接受確認。${note ? ` 客戶備註：${note}` : ""}`,
          createdAt:stamp, updatedAt:stamp, timestamp:stamp, createdBy:"public-store", updatedBy:"public-store"
        });
        saved = true;
      }
    } catch (error) {
      console.error("Firestore order save failed", error);
      const code = String(error?.code || "");
      duplicateBlocked = code.includes("permission-denied") || code.includes("already-exists");
    }
    try { await copyTextRobust(message); } catch {}
    if (saved || duplicateBlocked) rememberSubmission({ fingerprint, orderId, message, prefillMessage });
    if (saved) showToast(`訂單 ${orderId} 已送出，等待店家確認。`);
    else if (duplicateBlocked) showToast(`相同訂單今天已送出，系統已阻止重複建立。`);
    else showToast("訂單目前未寫入系統，請透過 LINE 聯絡客服確認。");
    closeProduct();
    showOrderSuccess(orderId, saved || duplicateBlocked, targetLineUrl, message, prefillMessage, duplicateBlocked);
    button.disabled = false;
    button.textContent = "送出訂單需求";
  }

  const successLineButton = $("#orderSuccessLine");
  if (successLineButton) {
    successLineButton.addEventListener("click", async (event) => {
      event.preventDefault();
      const href = lineChatUrl();
      let copied = false;
      try { copied = await copyTextRobust(latestOrderFullMessage); } catch (error) { console.warn("clipboard copy failed", error); }
      if (copied) showToast("完整訂單已複製，正在開啟 LINE；到聊天室長按貼上即可。");
      else showToast("瀏覽器未允許自動複製，請先按下方「複製完整訂單」再開 LINE。");
      window.setTimeout(() => { window.location.href = href; }, copied ? 180 : 900);
    });
  }
  const successCopyButton = $("#orderSuccessCopy");
  if (successCopyButton) {
    successCopyButton.addEventListener("click", async () => {
      if (!latestOrderFullMessage) return;
      const copied = await copyTextRobust(latestOrderFullMessage);
      showToast(copied ? "完整訂單已複製，回 LINE 長按貼上即可。" : "瀏覽器未允許複製，請長按上方訂單內容複製。");
    });
  }

  async function connectFirebase() {
    const config = window.LUCKY_GARAGE_FIREBASE_CONFIG || {};
    if (!config.apiKey || !config.projectId) return;
    try {
      const [appModule, firestoreModule] = await Promise.all([
        import("https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js"),
        import("https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js")
      ]);
      const app = appModule.initializeApp(config, "public-store-v32");
      const db = firestoreModule.getFirestore(app);
      firestoreApi = {
        db,
        doc:firestoreModule.doc,
        setDoc:firestoreModule.setDoc,
        serverTimestamp:firestoreModule.serverTimestamp
      };
      try {
        firestoreModule.onSnapshot(firestoreModule.collection(db, "products"), (snapshot) => {
          products = mergeRemoteProducts(snapshot.docs.map((item) => ({ id:item.id, ...item.data() })).filter((item) => !String(item.id).startsWith("__")));
          render();
        }, (error) => console.warn("商品即時同步失敗，持續使用目前商品資料。", error));
      } catch (error) { console.warn("商品雲端資料無法讀取，持續使用內建商品。", error); }
    } catch (error) {
      console.warn("Firebase 暫時無法載入；商品頁仍可正常瀏覽與透過 LINE 詢問。", error);
    }
  }

  // Render first. Firebase is optional enhancement and cannot block the catalog.
  render();
  $$(".filter-btn").forEach((button) => button.addEventListener("click", () => {
    currentFilter = button.dataset.filter;
    $$(".filter-btn").forEach((item) => item.classList.toggle("active", item === button));
    render();
  }));
  $("#closeModal")?.addEventListener("click", closeProduct);
  $("#productModal")?.addEventListener("click", (event) => { if (event.target === $("#productModal")) closeProduct(); });
  $("#variant")?.addEventListener("change", updateVariantDetails);
  $("#licenseMode")?.addEventListener("change", updateTotal);
  $("#orderForm")?.addEventListener("submit", submitOrder);
  document.addEventListener("keydown", (event) => { if (event.key === "Escape") closeProduct(); });

  const hash = decodeURIComponent(location.hash.replace(/^#/, ""));
  if (hash && products.some((product) => product.id === hash)) setTimeout(() => openProduct(hash), 50);
  connectFirebase();
})();
