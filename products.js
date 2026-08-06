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
  function imageUrls(product) {
    const items = Array.isArray(product?.images) ? product.images : [];
    return items
      .map((item) => normalizeImageUrl(typeof item === "string" ? item : item?.url))
      .filter(Boolean);
  }
  function normalizeProducts(items) {
    return (Array.isArray(items) ? items : [])
      .map((item, index) => ({
        ...item,
        id: String(item.id || `product-${index + 1}`),
        order: Number(item.order || index + 1),
        visible: item.visible !== false,
        images: imageUrls(item)
      }))
      .filter((item) => item.visible !== false)
      .sort((a, b) => a.order - b.order);
  }
  function mergeRemoteProducts(remoteItems) {
    const defaultMap = new Map(normalizeProducts(defaults).map((item) => [item.id, item]));
    for (const remote of Array.isArray(remoteItems) ? remoteItems : []) {
      if (!remote?.id) continue;
      const base = defaultMap.get(remote.id);
      const remoteImages = imageUrls(remote);
      if (base) {
        // Built-in vehicles always remain visible and retain local photos as a safe fallback.
        defaultMap.set(remote.id, {
          ...base,
          ...remote,
          visible: true,
          images: remoteImages.length ? remoteImages : imageUrls(base)
        });
      } else if (remote.visible !== false) {
        defaultMap.set(remote.id, { ...remote, images: remoteImages });
      }
    }
    return normalizeProducts([...defaultMap.values()]);
  }
  function productMatches(product) {
    if (currentFilter === "all") return true;
    if (currentFilter === "展示") {
      return String(product.tag || "").includes("展示") || String(product.name || "").includes("三輪");
    }
    return String(product.tag || "").includes(currentFilter);
  }
  function card(product) {
    const photos = imageUrls(product);
    const photo = photos[0] || "/icon-512.png";
    return `<article class="product-card" id="${escapeHtml(product.id)}">
      <button class="product-photo open-product" type="button" data-id="${escapeHtml(product.id)}" aria-label="查看 ${escapeHtml(product.name)}">
        <img src="${escapeHtml(photo)}" alt="${escapeHtml(product.name)} 實車照片" loading="lazy" decoding="async" onerror="this.onerror=null;this.src='/icon-512.png'">
        <span class="tag">${escapeHtml(product.tag || "微型電動")}</span>
      </button>
      <div class="product-body">
        <div><span class="product-style">${escapeHtml(product.style || "")}</span><h3>${escapeHtml(product.name)}</h3></div>
        <div class="spec-row"><span>🔋 ${escapeHtml(product.battery || "規格洽詢")}</span><span>⚡ ${escapeHtml(product.motor || "規格洽詢")}</span><span>🏁 ${escapeHtml(product.speed || "洽客服")}</span><span>🛣️ ${escapeHtml(product.range || "洽客服")}</span></div>
        <div class="price-row"><div><small>售價起</small><strong class="price">${money(product.priceLead)}</strong></div><button class="btn btn-primary open-product" type="button" data-id="${escapeHtml(product.id)}">看詳情／訂購</button></div>
      </div>
    </article>`;
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
  function cleanPhone(value) {
    let digits = String(value || "").replace(/\D/g, "");
    if (digits.startsWith("886")) digits = `0${digits.slice(3)}`;
    return digits;
  }
  function makeOrderId() {
    const date = new Date();
    const day = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const bytes = new Uint32Array(4);
    crypto.getRandomValues(bytes);
    return `YU-${day}-${[...bytes].map((value) => chars[value % chars.length]).join("")}`;
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
    const option = $("#variant").selectedOptions[0];
    $("#total").textContent = money(option?.dataset.price || 0);
  }
  function openProduct(id) {
    currentProduct = products.find((product) => product.id === id);
    if (!currentProduct) return;
    const photos = imageUrls(currentProduct);
    $("#modalTitle").textContent = `${currentProduct.name}｜商品詳情`;
    $("#modalStyle").textContent = `${currentProduct.tag || ""}・${currentProduct.style || ""}`;
    $("#modalName").textContent = currentProduct.name;
    $("#modalNote").textContent = currentProduct.note || "實際規格與現車請洽客服確認。";
    $("#modalBattery").textContent = currentProduct.battery || "洽客服";
    $("#modalMotor").textContent = currentProduct.motor || "洽客服";
    $("#modalSpeed").textContent = currentProduct.speed || "洽客服";
    $("#modalRange").textContent = currentProduct.range || "洽客服";
    $("#thumbs").innerHTML = photos.map((url, index) => `<button class="thumb ${index === 0 ? "active" : ""}" type="button" data-index="${index}"><img src="${escapeHtml(url)}" alt="${escapeHtml(currentProduct.name)} 圖片 ${index + 1}" onerror="this.onerror=null;this.src='/icon-192.png'"></button>`).join("");
    $$(".thumb").forEach((button) => button.addEventListener("click", () => setMainPhoto(photos[Number(button.dataset.index)], Number(button.dataset.index))));
    setMainPhoto(photos[0] || "/icon-512.png");
    const variants = [{ label:"鉛酸版", price:Number(currentProduct.priceLead || 0) }];
    if (Number(currentProduct.priceLithium || 0) > 0) variants.push({ label:"鋰鐵30Ah版", price:Number(currentProduct.priceLithium) });
    $("#variant").innerHTML = variants.map((variant) => `<option data-price="${variant.price}">${escapeHtml(variant.label)}</option>`).join("");
    $("#color").innerHTML = (currentProduct.colors || ["顏色請洽客服"]).map((color) => `<option>${escapeHtml(color)}</option>`).join("");
    $("#orderForm").reset();
    updateTotal();
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
  function lineMessage({ orderId, customerName, phone, address, note, variant, color, price }) {
    return `您好小宇，我想訂購：\n訂單編號：${orderId}\n車款：${currentProduct.name}（${currentProduct.style || ""}）\n規格：${variant}\n顏色：${color}\n參考售價：${money(price)}\n姓名：${customerName}\n電話：${phone}\n地址：${address}${note ? `\n備註：${note}` : ""}\n請協助確認訂金與交車安排。`;
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
    const price = Math.round(Number(option.dataset.price || 0));
    const color = $("#color").value;
    const orderId = makeOrderId();
    const message = lineMessage({ orderId, customerName, phone, address, note, variant, color, price });
    const button = $("#submitOrder");
    button.disabled = true;
    button.textContent = "訂單送出中…";
    let saved = false;
    try {
      if (firestoreApi) {
        const { db, doc, setDoc, serverTimestamp } = firestoreApi;
        const stamp = serverTimestamp();
        await setDoc(doc(db, "orders", orderId), {
          orderNo:orderId, orderId, source:"official-store", customerName, custName:customerName,
          phone, custPhone:phone, address, custAddress:address, model:currentProduct.name,
          itemName:`${currentProduct.name} ${currentProduct.style || ""}`.trim(), color,
          vehicleVariant:variant, battery:variant.includes("鋰") ? "鋰鐵30Ah" : "鉛酸",
          price, totalAmount:money(price), cost:0, netProfit:price, deposit:0, balancePaid:0,
          licenseMode:"代辦", deliveryMode:"到府交車", paymentMethod:"待確認",
          paymentTerms:"待客服確認", status:"待訂金", deliveredAt:"",
          notes:`官方商城送出，待客服確認規格、交期與訂金。${note ? ` 客戶備註：${note}` : ""}`,
          createdAt:stamp, updatedAt:stamp, timestamp:stamp, createdBy:"public-store", updatedBy:"public-store"
        });
        saved = true;
      }
    } catch (error) {
      console.error("Firestore order save failed", error);
    }
    try { await navigator.clipboard.writeText(message); } catch {}
    showToast(saved ? `訂單 ${orderId} 已建立，正在開啟 LINE。` : "訂單內容已準備，請在 LINE 傳送給客服確認。");
    setTimeout(() => { window.location.href = storeConfig.lineUrl || "https://line.me/R/ti/p/@762eqvlg"; }, 600);
    closeProduct();
    button.disabled = false;
    button.textContent = "送出訂單需求並開啟 LINE";
  }

  async function connectFirebase() {
    const config = window.LUCKY_GARAGE_FIREBASE_CONFIG || {};
    if (!config.apiKey || !config.projectId) return;
    try {
      const [appModule, firestoreModule] = await Promise.all([
        import("https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js"),
        import("https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js")
      ]);
      const app = appModule.initializeApp(config, "public-store-v20");
      const db = firestoreModule.getFirestore(app);
      firestoreApi = {
        db,
        doc:firestoreModule.doc,
        setDoc:firestoreModule.setDoc,
        serverTimestamp:firestoreModule.serverTimestamp
      };
      try {
        const snapshot = await firestoreModule.getDocs(firestoreModule.collection(db, "products"));
        products = mergeRemoteProducts(snapshot.docs.map((item) => ({ id:item.id, ...item.data() })));
        render();
      } catch (error) {
        console.warn("商品雲端資料無法讀取，持續使用內建商品。", error);
      }
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
  $("#variant")?.addEventListener("change", updateTotal);
  $("#orderForm")?.addEventListener("submit", submitOrder);
  document.addEventListener("keydown", (event) => { if (event.key === "Escape") closeProduct(); });

  const hash = decodeURIComponent(location.hash.replace(/^#/, ""));
  if (hash && products.some((product) => product.id === hash)) setTimeout(() => openProduct(hash), 50);
  connectFirebase();
})();
