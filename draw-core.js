export function normalizeCode(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

export async function sha256Bytes(value) {
  const data = new TextEncoder().encode(String(value));
  const digest = await crypto.subtle.digest("SHA-256", data);
  return new Uint8Array(digest);
}

export async function sha256Hex(value) {
  const bytes = await sha256Bytes(value);
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function formatTimestamp(timestamp) {
  if (!timestamp) return "—";
  const date = typeof timestamp.toDate === "function" ? timestamp.toDate() : new Date(timestamp);
  return new Intl.DateTimeFormat("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).format(date);
}

function bytesToUnitInterval(bytes) {
  // 取 SHA-256 前 6 bytes（48 bits），可安全放入 JavaScript Number。
  let value = 0;
  for (let index = 0; index < 6; index += 1) {
    value = value * 256 + bytes[index];
  }
  return value / 281474976710656; // 2^48
}

export async function deriveDrawResult(campaign, status) {
  if (!campaign || !Array.isArray(campaign.prizes) || campaign.prizes.length === 0) {
    throw new Error("活動獎項設定不完整。");
  }
  if (!status?.usedAt || !Number.isInteger(status.selectedGarage)) {
    throw new Error("抽獎紀錄尚未完成。");
  }

  const seconds = status.usedAt.seconds ?? Math.floor(status.usedAt.toMillis() / 1000);
  const nanoseconds = status.usedAt.nanoseconds ?? 0;
  const source = [
    campaign.algorithm || "sha256-v1",
    campaign.seed,
    status.code,
    seconds,
    nanoseconds,
    status.selectedGarage
  ].join("|");

  const digest = await sha256Bytes(source);
  const digestHex = [...digest].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  const totalWeight = campaign.prizes.reduce((sum, prize) => sum + Number(prize.weight || 0), 0);
  if (!(totalWeight > 0)) throw new Error("活動機率設定錯誤。");

  let cursor = bytesToUnitInterval(digest) * totalWeight;
  let selectedPrize = campaign.prizes[campaign.prizes.length - 1];
  for (const prize of campaign.prizes) {
    cursor -= Number(prize.weight || 0);
    if (cursor < 0) {
      selectedPrize = prize;
      break;
    }
  }

  const date = status.usedAt.toDate();
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");

  return {
    prize: selectedPrize,
    proofHash: digestHex,
    serial: `YU-${y}${m}${d}-${digestHex.slice(0, 8).toUpperCase()}`,
    formattedTime: formatTimestamp(status.usedAt)
  };
}

export function secureRandomIndex(length) {
  if (!Number.isInteger(length) || length <= 0) throw new Error("無效的亂數範圍。");
  const range = 0x100000000;
  const max = range - (range % length);
  const buffer = new Uint32Array(1);
  do {
    crypto.getRandomValues(buffer);
  } while (buffer[0] >= max);
  return buffer[0] % length;
}

export function makeDrawCode(prefix = "YU", randomLength = 8) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const cleanPrefix = normalizeCode(prefix).slice(0, 6) || "YU";
  let code = cleanPrefix;
  for (let index = 0; index < randomLength; index += 1) {
    code += alphabet[secureRandomIndex(alphabet.length)];
  }
  return code;
}

export function makeSeed() {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
