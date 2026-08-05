/* 小宇微電｜公開商品目錄 v17
   商品照片內建於專案，不依賴 Firebase Storage。後台價格與顯示設定可覆蓋本檔。 */
window.YU_PRODUCT_CATALOG = [
  {
    id:"scooter-1", order:1, name:"大偉士", style:"頂規改裝版", tag:"72V",
    visible:true, priceLead:35000, priceLithium:58800,
    colors:["黑色","白色","灰色"], battery:"72V33Ah 鉛酸／鋰鐵30Ah", motor:"3000W", speed:"約 80 km/h", range:"約 35–55 km",
    note:"實際續航依載重、路況、胎壓與騎乘方式而異。",
    images:["assets/products/davespa/01.webp","assets/products/davespa/02.webp","assets/products/davespa/03.webp","assets/products/davespa/04.webp"]
  },
  {
    id:"scooter-2", order:2, name:"小偉士", style:"經典款", tag:"60V",
    visible:true, priceLead:28000, priceLithium:45600,
    colors:["白色","黑色","紅色"], battery:"60V33Ah 鉛酸／鋰鐵30Ah", motor:"1500W", speed:"約 60 km/h", range:"約 35–55 km",
    note:"車身較輕巧，適合日常代步。",
    images:["assets/products/svespa/01.webp","assets/products/svespa/02.webp","assets/products/svespa/03.webp","assets/products/svespa/04.webp"]
  },
  {
    id:"scooter-3", order:3, name:"神盾", style:"鋼鐵戰艦版", tag:"60V",
    visible:true, priceLead:29000, priceLithium:48000,
    colors:["白色","黑色","綠色"], battery:"60V33Ah 鉛酸／鋰鐵30Ah", motor:"2000W", speed:"約 60–70 km/h", range:"約 35–55 km",
    note:"實際車色與配備以當批現車為準。",
    images:["assets/products/shield/01.webp","assets/products/shield/02.webp","assets/products/shield/03.webp","assets/products/shield/04.webp"]
  },
  {
    id:"scooter-4", order:4, name:"Z3", style:"普通版", tag:"72V",
    visible:true, priceLead:35000, priceLithium:58800,
    colors:["白色","黑色","灰色"], battery:"72V33Ah 鉛酸／鋰鐵30Ah", motor:"3000W", speed:"約 80 km/h", range:"約 35–55 km",
    note:"運動外型，實際規格依當批車輛確認。",
    images:["assets/products/z3/01.webp","assets/products/z3/02.webp","assets/products/z3/03.webp","assets/products/z3/04.webp"]
  },
  {
    id:"scooter-5", order:5, name:"Z3", style:"暗魂版", tag:"72V",
    visible:true, priceLead:38000, priceLithium:62000,
    colors:["消光黑"], battery:"72V33Ah 鉛酸／鋰鐵30Ah", motor:"3000W", speed:"約 80 km/h", range:"約 35–55 km",
    note:"暗色外觀版本，實際配色與配備請洽客服。",
    images:["assets/products/z3/02.webp","assets/products/z3/01.webp","assets/products/z3/03.webp","assets/products/z3/04.webp"]
  },
  {
    id:"scooter-6", order:6, name:"正9號", style:"曠達版", tag:"72V",
    visible:true, priceLead:35000, priceLithium:58800,
    colors:["紫色","白色","黑色"], battery:"72V33Ah 鉛酸／鋰鐵30Ah", motor:"3000W", speed:"約 80 km/h", range:"約 35–55 km",
    note:"大車身版本，實際顏色依現車為準。",
    images:["assets/products/nine/01.webp","assets/products/nine/02.webp","assets/products/nine/03.webp","assets/products/nine/04.webp"]
  },
  {
    id:"scooter-7", order:7, name:"正9號", style:"金大力版", tag:"72V",
    visible:true, priceLead:35000, priceLithium:58800,
    colors:["金色","黑色","白色"], battery:"72V33Ah 鉛酸／鋰鐵30Ah", motor:"3000W", speed:"約 80 km/h", range:"約 35–55 km",
    note:"不同外觀版本價格相同，配備以客服確認為準。",
    images:["assets/products/nine/03.webp","assets/products/nine/01.webp","assets/products/nine/02.webp","assets/products/nine/04.webp"]
  },
  {
    id:"scooter-8", order:8, name:"小可愛（拿鐵）", style:"可愛馬卡龍版", tag:"60V",
    visible:true, priceLead:30000, priceLithium:null,
    colors:["奶茶色","粉色","白色","藍色"], battery:"鉛酸版", motor:"規格請洽客服", speed:"依合格車輛設定", range:"依使用狀況而異",
    note:"目前不提供鋰鐵版本。",
    images:["assets/products/latte/01.webp","assets/products/latte/02.webp","assets/products/latte/03.webp","assets/products/latte/04.webp"]
  },
  {
    id:"scooter-9", order:9, name:"Dio", style:"經典二行程外型", tag:"60V",
    visible:true, priceLead:30000, priceLithium:48000,
    colors:["白色","黑色"], battery:"60V33Ah 鉛酸／鋰鐵30Ah", motor:"1000W", speed:"約 50–60 km/h", range:"依電池與路況而異",
    note:"復古 Dio 外型，實際規格與現車狀況以客服確認。",
    images:["assets/products/dio/01.webp","assets/products/dio/02.webp"]
  },
  {
    id:"scooter-10", order:10, name:"QC", style:"時尚 QC 款", tag:"72V",
    visible:true, priceLead:32000, priceLithium:56400,
    colors:["白色","黑色","灰色"], battery:"72V 鉛酸／鋰鐵30Ah", motor:"規格請洽客服", speed:"依合格車輛設定", range:"依電池與路況而異",
    note:"實際顏色及配備以現車為準。",
    images:["assets/products/qc/01.webp","assets/products/qc/02.webp"]
  },
  {
    id:"scooter-11", order:11, name:"小酷龍", style:"檔車造型款", tag:"48V",
    visible:true, priceLead:21000, priceLithium:null,
    colors:["黑色","紅色","藍色"], battery:"48V 鉛酸版", motor:"規格請洽客服", speed:"依車輛設定", range:"依使用狀況而異",
    note:"目前不提供鋰鐵版本。",
    images:["assets/products/dragon/01.webp","assets/products/dragon/02.webp","assets/products/dragon/03.webp","assets/products/dragon/04.webp"]
  },
  {
    id:"scooter-12", order:12, name:"微型三輪", style:"載物長者三輪版", tag:"展示／場域用",
    visible:true, priceLead:33000, priceLithium:null,
    colors:["紅色","藍色","綠色"], battery:"48V 鉛酸版", motor:"規格請洽客服", speed:"依車輛設定", range:"依使用狀況而異",
    note:"此車款無法領牌，不可作為一般道路合法領牌車使用。",
    images:["assets/products/trike/01.webp","assets/products/trike/02.webp","assets/products/trike/03.webp","assets/products/trike/04.webp"]
  }
];
