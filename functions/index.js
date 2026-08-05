/**
 * 小宇微電｜官方商城新訂單通知 v12.2 FINAL
 *
 * 僅通知前台官方商城建立的訂單：
 * - source = official-store
 * - source = official-store-plate
 *
 * 使用 Firestore _notificationEvents 記錄事件，避免同一 CloudEvent
 * 重複觸發 LINE 與 Email。後台手動／批量建立的訂單不推播。
 */

const { createHash } = require("node:crypto");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { defineSecret } = require("firebase-functions/params");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");
const axios = require("axios");

admin.initializeApp();

const LINE_CHANNEL_ACCESS_TOKEN = defineSecret("LINE_CHANNEL_ACCESS_TOKEN");
const ADMIN_LINE_USER_ID = defineSecret("ADMIN_LINE_USER_ID");
const GMAIL_APP_PASSWORD = defineSecret("GMAIL_APP_PASSWORD");

const STORE_EMAIL = "uu8832sr@gmail.com";
const ALLOWED_SOURCES = new Set(["official-store", "official-store-plate"]);

function text(value, fallback = "—") {
  const output = String(value ?? "").trim();
  return output || fallback;
}

function money(value) {
  if (typeof value === "string" && value.trim()) return value.trim();
  const parsed = Number(value);
  return Number.isFinite(parsed)
    ? `NT$${Math.round(parsed).toLocaleString("zh-TW")}`
    : "—";
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]));
}

function normalizeOrder(orderId, data) {
  const source = text(data.source, "後台建立");
  const isPlate = source === "official-store-plate";
  return {
    orderId: text(data.orderNo || data.orderId || orderId),
    customerName: text(data.customerName || data.custName),
    phone: text(data.phone || data.custPhone),
    address: text(data.address || data.custAddress),
    itemName: text(data.itemName || data.model),
    variant: text(data.vehicleVariant || data.battery, "待確認"),
    color: text(data.color, isPlate ? "依訂製樣式" : "待確認"),
    total: money(data.totalAmount || data.price),
    payment: text(data.paymentTerms || data.paymentMethod || data.installment, "待確認"),
    source,
    notes: text(data.notes, "無"),
    isPlate
  };
}

function orderMessage(order) {
  const lines = [
    "🚨【小宇微電｜收到新線上訂單】",
    "────────────────",
    `📌 訂單編號：${order.orderId}`,
    `🛒 訂購項目：${order.itemName}`,
    `📋 規格：${order.variant}`,
    `🎨 顏色／樣式：${order.color}`,
    `💰 總金額：${order.total}`,
    `💳 付款條件：${order.payment}`,
    "────────────────",
    `👤 客戶姓名：${order.customerName}`,
    `📞 聯絡電話：${order.phone}`,
    `${order.isPlate ? "📦 收件資料" : "🏠 配送地址"}：${order.address}`,
    `📝 備註：${order.notes}`
  ];
  return lines.join("\n");
}

async function sendLine(order) {
  const token = LINE_CHANNEL_ACCESS_TOKEN.value();
  const to = ADMIN_LINE_USER_ID.value();
  if (!token || !to) {
    throw new Error("LINE secrets 未完整設定");
  }

  await axios.post(
    "https://api.line.me/v2/bot/message/push",
    {
      to,
      messages: [{ type: "text", text: orderMessage(order) }]
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      timeout: 15000
    }
  );
}

async function sendEmail(order) {
  const appPassword = GMAIL_APP_PASSWORD.value();
  if (!appPassword) throw new Error("GMAIL_APP_PASSWORD 尚未設定");

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: STORE_EMAIL,
      pass: appPassword
    }
  });

  const rows = Object.entries({
    "訂單編號": order.orderId,
    "客戶姓名": order.customerName,
    "手機": order.phone,
    [order.isPlate ? "收件資料" : "配送地址"]: order.address,
    "訂購項目": order.itemName,
    "規格": order.variant,
    "顏色／樣式": order.color,
    "金額": order.total,
    "付款條件": order.payment,
    "來源": order.source,
    "備註": order.notes
  }).map(([label, value]) => (
    `<tr><th style="text-align:left;padding:8px;border-bottom:1px solid #ddd">${escapeHtml(label)}</th>` +
    `<td style="padding:8px;border-bottom:1px solid #ddd">${escapeHtml(value)}</td></tr>`
  )).join("");

  await transporter.sendMail({
    from: `"小宇微電訂單系統" <${STORE_EMAIL}>`,
    to: STORE_EMAIL,
    subject: `【小宇微電｜新訂單】${order.itemName}｜${order.customerName}｜${order.orderId}`,
    text: orderMessage(order),
    html: `<div style="font-family:Arial,'Noto Sans TC',sans-serif;max-width:680px"><h2>小宇微電｜新訂單通知</h2><table style="border-collapse:collapse;width:100%">${rows}</table></div>`
  });
}

function eventDocumentId(event, orderId) {
  const raw = text(event.id, `${orderId}:${Date.now()}`);
  return createHash("sha256").update(raw).digest("hex");
}

async function claimEvent(event, order) {
  const markerRef = admin.firestore()
    .collection("_notificationEvents")
    .doc(eventDocumentId(event, order.orderId));

  try {
    await markerRef.create({
      eventId: text(event.id),
      orderId: order.orderId,
      source: order.source,
      status: "processing",
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    return markerRef;
  } catch (error) {
    const code = String(error?.code || "").toLowerCase();
    if (code === "6" || code.includes("already-exists") || code.includes("already exists")) {
      return null;
    }
    throw error;
  }
}

exports.notifyNewOrder = onDocumentCreated(
  {
    document: "orders/{orderId}",
    region: "asia-east1",
    retry: false,
    secrets: [
      LINE_CHANNEL_ACCESS_TOKEN,
      ADMIN_LINE_USER_ID,
      GMAIL_APP_PASSWORD
    ]
  },
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;

    const rawOrder = snapshot.data() || {};
    const source = text(rawOrder.source, "");
    if (!ALLOWED_SOURCES.has(source)) {
      logger.info("非官方商城訂單，略過通知。", {
        orderId: event.params.orderId,
        source: source || "未設定"
      });
      return;
    }

    const order = normalizeOrder(event.params.orderId, rawOrder);
    const markerRef = await claimEvent(event, order);
    if (!markerRef) {
      logger.info("重複 CloudEvent 已略過。", {
        orderId: order.orderId,
        eventId: event.id
      });
      return;
    }

    const [lineResult, emailResult] = await Promise.allSettled([
      sendLine(order),
      sendEmail(order)
    ]);

    const lineSent = lineResult.status === "fulfilled";
    const emailSent = emailResult.status === "fulfilled";
    const errors = [];

    if (!lineSent) {
      errors.push(`LINE：${lineResult.reason?.message || String(lineResult.reason)}`);
      logger.error("LINE 推播失敗", {
        orderId: order.orderId,
        error: lineResult.reason?.response?.data || lineResult.reason?.message || String(lineResult.reason)
      });
    }
    if (!emailSent) {
      errors.push(`Email：${emailResult.reason?.message || String(emailResult.reason)}`);
      logger.error("Email 備份失敗", {
        orderId: order.orderId,
        error: emailResult.reason?.message || String(emailResult.reason)
      });
    }

    await markerRef.update({
      status: lineSent && emailSent ? "complete" : "partial",
      lineSent,
      emailSent,
      errors,
      finishedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    logger.info("新訂單通知流程完成", {
      orderId: order.orderId,
      lineSent,
      emailSent
    });
  }
);
