/* 小宇微電｜幸運車庫介面設定 v7 */
window.LUCKY_GARAGE_UI_CONFIG = {
  brandName: "小宇微電",
  campaignName: "幸運車庫",
  lineId: "@762eqvlg",
  lineUrl: "https://line.me/R/ti/p/@762eqvlg",
  maxPrizeText: "最高現折 NT$3,000",

  // 新版正式獎項：500 / 1,000 / 2,000 / 3,000
  // 權重總和 100，可直接視為百分比。
  // 平均折扣成本：680 元／次。
  defaultPrizes: [
    {
      id: "discount-500",
      title: "現折 NT$500",
      description: "本優惠限本次購車訂單使用。",
      icon: "🎁",
      weight: 76
    },
    {
      id: "discount-1000",
      title: "現折 NT$1,000",
      description: "本優惠限本次購車訂單使用。",
      icon: "⚡",
      weight: 19
    },
    {
      id: "discount-2000",
      title: "現折 NT$2,000",
      description: "幸運升級！本優惠限本次購車訂單使用。",
      icon: "🏁",
      weight: 4
    },
    {
      id: "discount-3000",
      title: "現折 NT$3,000",
      description: "本活動最高獎！本優惠限本次購車訂單使用。",
      icon: "🏆",
      weight: 1
    }
  ]
};

/* v6 電影級開獎設定
   不放影片時留空，網站會使用內建即時 3D / 粒子 / 音效動畫。
   若要接 Veo，將影片上傳為 assets/garage-open.mp4，再填入該路徑。
   Veo 影片只建議當「通用開庫過場」，真正獎項仍由 Firebase 即時計算並由網頁顯示。 */
window.LUCKY_GARAGE_UI_CONFIG.cinematicVideoUrl = "garage-open.mp4";
