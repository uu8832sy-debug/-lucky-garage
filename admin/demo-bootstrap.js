import { getApps, getApp, initializeApp } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-auth.js";
import { doc, getDoc, getFirestore, serverTimestamp, setDoc } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js";
import { resolveShopContext } from "../multi-shop-core.js";

const params = new URLSearchParams(location.search);
if (params.get("shop") !== "demo") {
  // This runtime is intentionally inert outside the DEMO tenant.
} else {
  const app = getApps().length ? getApp() : initializeApp(window.LUCKY_GARAGE_FIREBASE_CONFIG || {});
  const auth = getAuth(app);
  const db = getFirestore(app);
  const DEMO_SHOP_ID = "demo";
  const DEMO_SEED_VERSION = 1;

  function installBanner() {
    if (document.querySelector("#demoTenantBanner")) return;
    const banner = document.createElement("div");
    banner.id = "demoTenantBanner";
    banner.style.cssText = "position:sticky;top:0;z-index:9999;background:#fde047;color:#111827;padding:9px 14px;text-align:center;font-weight:900;font-size:12px;border-bottom:1px solid #facc15";
    banner.textContent = "⚠️ DEMO 展示店｜本店所有商品、訂單與客戶資料皆為展示假資料";
    document.body.prepend(banner);
  }

  async function seedDemo(user, context) {
    const shopRef = doc(db, "shops", DEMO_SHOP_ID);
    const shopSnap = await getDoc(shopRef);
    const currentVersion = Number(shopSnap.data()?.demoSeedVersion || 0);
    if (shopSnap.exists() && currentVersion >= DEMO_SEED_VERSION) return false;
    if (context.role !== "platformOwner") return false;

    const stamp = serverTimestamp();
    await setDoc(shopRef, {
      name:"小宇車行系統｜DEMO 展示店",
      displayName:"小宇車行系統｜DEMO 展示店",
      enabled:true,
      public:true,
      demo:true,
      demoSeedVersion:DEMO_SEED_VERSION,
      siteUrl:"/demo/",
      logoUrl:"/assets/brand/logo-round.webp",
      updatedAt:stamp,
      updatedBy:user.uid,
      createdAt:stamp,
      createdBy:user.uid
    }, { merge:true });

    await Promise.all([
      setDoc(doc(db,"shops",DEMO_SHOP_ID,"siteSettings","general"), {
        shopId:DEMO_SHOP_ID,
        brandName:"小宇車行系統｜DEMO 展示店",
        siteUrl:"/demo/",
        lineId:"@DEMO",
        phone:"09xx-xxx-xxx",
        address:"台北市展示路 88 號（假資料）",
        demo:true,
        updatedAt:serverTimestamp()
      }, { merge:true }),
      setDoc(doc(db,"shops",DEMO_SHOP_ID,"products","demo-city-a"), {
        shopId:DEMO_SHOP_ID,name:"城市通勤 A",style:"DEMO 基礎版",tag:"展示車款",visible:true,order:1,
        priceLead:39800,priceTernary:49800,priceLithium:52800,colors:["曜石黑","雲朵白","霧灰"],
        description:"展示用假車款，用於示範商品管理、價格與圖片欄位。",images:[],demo:true,updatedAt:serverTimestamp()
      }, { merge:true }),
      setDoc(doc(db,"shops",DEMO_SHOP_ID,"products","demo-sport-b"), {
        shopId:DEMO_SHOP_ID,name:"潮流運動 B",style:"DEMO 進階版",tag:"熱門展示",visible:true,order:2,
        priceLead:52800,priceTernary:59800,priceLithium:63800,colors:["消光黑","冰川白"],
        description:"展示用假車款，用於示範多規格、多價格方案。",images:[],demo:true,updatedAt:serverTimestamp()
      }, { merge:true }),
      setDoc(doc(db,"shops",DEMO_SHOP_ID,"products","demo-range-c"), {
        shopId:DEMO_SHOP_ID,name:"長途續航 C",style:"DEMO 旗艦版",tag:"店家主推",visible:true,order:3,
        priceLead:59800,priceTernary:66800,priceLithium:72800,colors:["墨綠","沙漠灰"],
        description:"展示用假車款，用於示範旗艦商品排版。",images:[],demo:true,updatedAt:serverTimestamp()
      }, { merge:true }),
      setDoc(doc(db,"shops",DEMO_SHOP_ID,"onlineOrders","DEMO-ONLINE-001"), {
        orderId:"DEMO-ONLINE-001",orderNo:"DEMO-ONLINE-001",shopId:DEMO_SHOP_ID,source:"official-store",
        customerName:"陳先生（展示）",phone:"0912-000-001",address:"新北市展示區 1 號",model:"城市通勤 A",vehicleVariant:"鋰電版",
        price:49800,totalAmount:"NT$49,800",deliveryMode:"全台配送",paymentMethod:"轉帳",status:"待審核",reviewStatus:"pending",demo:true,createdAt:stamp,updatedAt:stamp
      }, { merge:true }),
      setDoc(doc(db,"shops",DEMO_SHOP_ID,"onlineOrders","DEMO-ONLINE-002"), {
        orderId:"DEMO-ONLINE-002",orderNo:"DEMO-ONLINE-002",shopId:DEMO_SHOP_ID,source:"official-store",
        customerName:"林小姐（展示）",phone:"0912-000-002",address:"台中市展示路 2 號",model:"潮流運動 B",vehicleVariant:"鉛酸版",
        price:52800,totalAmount:"NT$52,800",deliveryMode:"門市交車",paymentMethod:"現金",status:"已拒絕",reviewStatus:"rejected",demo:true,createdAt:stamp,updatedAt:stamp
      }, { merge:true }),
      setDoc(doc(db,"shops",DEMO_SHOP_ID,"orders","DEMO-ORDER-001"), {
        orderId:"DEMO-ORDER-001",orderNo:"DEMO-ORDER-001",shopId:DEMO_SHOP_ID,source:"official-store",
        customerName:"王小姐（展示）",phone:"0912-000-003",address:"高雄市展示街 3 號",model:"長途續航 C",vehicleVariant:"鋰電版",
        price:66800,totalAmount:"NT$66,800",cost:50000,netProfit:16800,deposit:10000,balancePaid:0,status:"待尾款",reviewStatus:"confirmed",
        sourceOnlineOrderId:"DEMO-ONLINE-003",demo:true,createdAt:stamp,updatedAt:stamp
      }, { merge:true }),
      setDoc(doc(db,"shops",DEMO_SHOP_ID,"deliveryCases","demo-case-1"), {
        title:"北部展示交車案例",description:"DEMO 假資料｜示範交車案例管理與前台呈現。",order:1,visible:true,published:true,images:[],demo:true,createdAt:stamp,updatedAt:stamp
      }, { merge:true }),
      setDoc(doc(db,"shops",DEMO_SHOP_ID,"deliveryCases","demo-case-2"), {
        title:"中部展示交車案例",description:"DEMO 假資料｜正式店家可自行上傳交車照片。",order:2,visible:true,published:true,images:[],demo:true,createdAt:stamp,updatedAt:stamp
      }, { merge:true })
    ]);
    return true;
  }

  onAuthStateChanged(auth, async (user) => {
    if (!user) return;
    try {
      const context = await resolveShopContext(db, user);
      if (context.shopId !== DEMO_SHOP_ID && context.role !== "platformOwner") return;
      installBanner();
      const seeded = await seedDemo(user, context);
      if (seeded) {
        try { sessionStorage.setItem("xiaoyuDemoSeeded", String(DEMO_SEED_VERSION)); } catch {}
        setTimeout(() => location.reload(), 350);
      }
    } catch (error) {
      console.error("DEMO tenant bootstrap failed:", error);
    }
  });
}
