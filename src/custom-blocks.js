const PAGE_IDS = new Set([
  "top",
  "about",
  "gallery",
  "now",
  "notes",
  "guestbook",
]);
const COLOR_PATTERN = /^#[0-9a-f]{6}$/i;
const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FONT_FAMILIES = new Set(["modern", "rounded", "serif", "mono"]);
const TEXT_ALIGNS = new Set(["left", "center", "right"]);

function finiteNumber(value, minimum, maximum, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(maximum, Math.max(minimum, number));
}

export function validateCustomBlocks(value) {
  if (!Array.isArray(value)) {
    return { ok: false, error: "自由文本框格式无效" };
  }
  if (value.length > 50) {
    return { ok: false, error: "自由文本框最多创建 50 个" };
  }

  const ids = new Set();
  const blocks = [];
  for (const item of value) {
    if (!item || typeof item !== "object") {
      return { ok: false, error: "自由文本框内容无效" };
    }
    const id = String(item.id || "").toLowerCase();
    const pageId = String(item.pageId || "");
    const text = typeof item.text === "string" ? item.text.trim() : "";
    if (!ID_PATTERN.test(id) || ids.has(id)) {
      return { ok: false, error: "自由文本框编号无效" };
    }
    if (!PAGE_IDS.has(pageId)) {
      return { ok: false, error: "自由文本框所在页面无效" };
    }
    if (!text || text.length > 1000) {
      return { ok: false, error: "自由文本框文字不能为空或超过 1000 字" };
    }
    const color = String(item.color || "#17243d").toLowerCase();
    if (!COLOR_PATTERN.test(color)) {
      return { ok: false, error: "自由文本框颜色无效" };
    }
    const fontFamily = String(item.fontFamily || "modern");
    if (!FONT_FAMILIES.has(fontFamily)) {
      return { ok: false, error: "自由文本框字体无效" };
    }
    const textAlign = String(item.textAlign || "left");
    if (!TEXT_ALIGNS.has(textAlign)) {
      return { ok: false, error: "自由文本框对齐方式无效" };
    }
    const fontWeight = Number(item.fontWeight || 400);
    if (![400, 700].includes(fontWeight)) {
      return { ok: false, error: "自由文本框字重无效" };
    }
    ids.add(id);
    blocks.push({
      id,
      pageId,
      text,
      xPercent: finiteNumber(item.xPercent, 0, 90, 50),
      yPercent: finiteNumber(item.yPercent, 10, 88, 35),
      width: Math.round(finiteNumber(item.width, 120, 600, 240)),
      fontSize: Math.round(finiteNumber(item.fontSize, 10, 72, 18)),
      color,
      fontFamily,
      fontWeight,
      textAlign,
      rotation: Math.round(finiteNumber(item.rotation, -180, 180, 0)),
      zIndex: Math.round(finiteNumber(item.zIndex, 1, 50, 1)),
    });
  }
  return { ok: true, value: blocks };
}

export function normalizeCustomBlocks(value) {
  const validation = validateCustomBlocks(value);
  return validation.ok ? validation.value : [];
}
