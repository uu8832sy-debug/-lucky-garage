/* 小宇微電｜幸運車庫介面設定 */
window.LUCKY_GARAGE_UI_CONFIG = {
  brandName: "小宇微電",
  campaignName: "幸運車庫",
  lineId: "@762eqvlg",
  lineUrl: "https://line.me/R/ti/p/@762eqvlg",
  maxPrizeText: "最高現折 NT$2,000",

  // 管理頁建立新活動時使用的預設獎項。
  // 正式活動建立後，獎項與機率會永久寫入 Firebase，不能由網頁修改。
  defaultPrizes: [
    {
      id: "discount-500",
      title: "現折 NT$500",
      description: "本優惠限本次購車訂單使用。",
      icon: "🎁",
      weight: 70
    },
    {
      id: "discount-800",
      title: "現折 NT$800",
      description: "本優惠限本次購車訂單使用。",
      icon: "⚡",
      weight: 23
    },
    {
      id: "discount-1000",
      title: "現折 NT$1,000",
      description: "幸運升級！本優惠限本次購車訂單使用。",
      icon: "🏁",
      weight: 6
    },
    {
      id: "discount-2000",
      title: "現折 NT$2,000",
      description: "本活動最高獎！本優惠限本次購車訂單使用。",
      icon: "🏆",
      weight: 1
    }
  ]
};
