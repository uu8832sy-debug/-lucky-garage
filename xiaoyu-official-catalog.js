/* 小宇微電｜正式車款價目表
   2026-08-29 依正式 5 頁價目表鎖定。
   價格單位：新台幣；車款顏色依現貨為主。
*/
(() => {
  const colorNote = "車款顏色依現貨為主";
  const battery = (lead, p7230, p7240, p7250, p7265) => [
    { key:"lead", label:"鉛酸電池", battery:"鉛酸電池", price:lead, range:"約35～55公里", warranty:"6 個月" },
    { key:"7230", label:"7230 鋰電", battery:"7230 鋰電", price:p7230, range:"約40～60公里", warranty:"1 年" },
    { key:"7240", label:"7240 鋰電", battery:"7240 鋰電", price:p7240, range:"約50～80公里", warranty:"1 年" },
    { key:"7250", label:"7250 鋰電", battery:"7250 鋰電", price:p7250, range:"約65～100公里", warranty:"1 年" },
    { key:"7265", label:"7265 鋰電", battery:"7265 鋰電", price:p7265, range:"約85～130公里", warranty:"1 年" }
  ];
  const item = (id, order, name, style, prices, images, extra={}) => ({
    id, order, name, style, visible:true,
    priceLead:prices[0],
    batteryOptions:battery(...prices),
    colors:[colorNote],
    description:`${name}${style ? `｜${style}` : ""}，實際車款顏色依現貨為主。`,
    features:["全台配送","可無卡分期","代辦領牌保險","售後保修"],
    note:"車款顏色依現貨為主；續航依載重、路況及騎乘方式而異。",
    images,
    licenseRequired:true,
    ...extra
  });

  window.YU_PRODUCT_CATALOG = [
    item("scooter-1",1,"大偉士","普通版",[33000,49800,54800,60800,67800],["/assets/products/davespa/01.webp","/assets/products/davespa/02.webp","/assets/products/davespa/03.webp","/assets/products/davespa/04.webp"]),
    item("scooter-1-special",2,"大偉士","改裝特仕版",[35000,51800,56800,62800,69800],["/assets/products/davespa/01.webp","/assets/products/davespa/02.webp","/assets/products/davespa/03.webp","/assets/products/davespa/04.webp"]),
    item("scooter-4",3,"Z3 天鵝座","普通版",[36000,52800,57800,63800,70800],["/assets/products/z3/01.webp","/assets/products/z3/02.webp","/assets/products/z3/03.webp","/assets/products/z3/04.webp"]),
    item("scooter-5",4,"Z3 天鵝座","暗魂版",[38000,54800,59800,65800,72800],["/assets/products/z3/02.webp","/assets/products/z3/01.webp","/assets/products/z3/03.webp","/assets/products/z3/04.webp"]),
    item("scooter-6",5,"正9號","曠達版",[35000,51800,56800,62800,69800],["/assets/products/nine/01.webp","/assets/products/nine/02.webp"]),
    item("scooter-7",6,"正9號","金大力版",[35000,51800,56800,62800,69800],["/assets/products/nine/03.webp","/assets/products/nine/04.webp"]),
    item("scooter-2",7,"小偉士","標準版",[27400,45800,50800,56800,63800],["/assets/products/svespa/01.webp","/assets/products/svespa/02.webp","/assets/products/svespa/03.webp"]),
    item("scooter-3",8,"神盾","標準版",[29000,47400,52400,58400,65400],["/assets/products/shield/01.webp","/assets/products/shield/02.webp","/assets/products/shield/03.webp","/assets/products/shield/04.webp"]),
    item("scooter-9",9,"DIO","標準版",[30000,48400,53400,59400,66400],["/assets/products/dio/01.webp","/assets/products/dio/02.webp"]),
    item("scooter-8",10,"拿鐵","標準版",[30000,48400,53400,59400,66400],["/assets/products/latte/01.webp","/assets/products/latte/02.webp","/assets/products/latte/03.webp","/assets/products/latte/04.webp"]),
    item("scooter-10",11,"QC","標準版",[33000,49800,54800,60800,67800],["/assets/products/qc/01.webp","/assets/products/qc/02.webp"]),
    {
      id:"red-bean", order:12, name:"小紅豆｜電輔車", style:"標準版", visible:true,
      priceLead:18500,
      batteryOptions:[{ key:"lead", label:"鉛酸整車", battery:"鉛酸整車", price:18500, range:"約35～55公里", warranty:"6 個月" }],
      colors:[colorNote], description:"小紅豆電輔車，目前僅提供鉛酸整車。", features:["目前僅提供鉛酸整車","售後服務"],
      note:"不套用 7230～7265 鋰電方案；車款顏色依現貨為主。", images:[], licenseRequired:false
    },
    item("h1-special",13,"H1","特仕版",[38000,54800,59800,65800,72800],[],{ description:"H1 特仕版，車款顏色依現貨為主。" })
  ];
})();
