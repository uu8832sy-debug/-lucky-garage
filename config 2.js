/* 小宇微電｜幸運車庫設定 v12.2 FINAL
   正式獎項機率：
   NT$500 = 80%
   NT$1,000 = 16%
   NT$2,000 = 3%
   NT$3,000 = 1%
*/
window.LUCKY_GARAGE_UI_CONFIG = {
  brandName: "小宇微電",
  campaignName: "幸運車庫",
  lineId: "@762eqvlg",
  lineUrl: "https://line.me/R/ti/p/@762eqvlg",
  maxPrizeText: "最高現折 NT$3,000",

  defaultPrizes: [
    {
      id: "discount-500",
      title: "現折 NT$500",
      description: "本優惠限本次購車訂單使用。",
      icon: "🎁",
      weight: 80
    },
    {
      id: "discount-1000",
      title: "現折 NT$1,000",
      description: "本優惠限本次購車訂單使用。",
      icon: "⚡",
      weight: 16
    },
    {
      id: "discount-2000",
      title: "現折 NT$2,000",
      description: "幸運升級！本優惠限本次購車訂單使用。",
      icon: "🏁",
      weight: 3
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

/* 沒有實體開庫影片時，網站會使用內建動畫。 */
window.LUCKY_GARAGE_UI_CONFIG.cinematicVideoUrl = "garage-open.mp4";
