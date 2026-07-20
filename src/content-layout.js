import { defaultContent, fontFamilies } from "./site-settings.js";

const CONTENT_KEYS = new Set(Object.keys(defaultContent));
const CONTENT_STYLE_KEYS = new Set([
  "fontFamily",
  "fontSize",
  "color",
  "fontWeight",
  "width",
  "rotation",
  "textAlign",
  "zIndex",
  "hidden",
]);
const COLOR_PATTERN = /^#[0-9a-f]{6}$/i;
const VISUAL_KEYS = new Set([
  "visual.heroActions",
  "visual.heroPortrait",
  "visual.heroAvatarPhoto",
  "visual.aboutLabel",
  "visual.aboutCard1",
  "visual.aboutCard2",
  "visual.aboutCard3",
  "visual.galleryLabel",
  "visual.galleryHeading",
  "visual.galleryCarousel",
  "visual.nowLabel",
  "visual.nowTitlePanel",
  "visual.nowCard1",
  "visual.nowCard2",
  "visual.nowCard3",
  "visual.notesLabel",
  "visual.notesHeading",
  "visual.notesGrid",
  "visual.guestbookLabel",
  "visual.guestbookHeading",
  "visual.guestbookComments",
  "visual.guestbookForm",
]);

function finiteOffset(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return Number(Math.min(100, Math.max(-100, number)).toFixed(2));
}

export function validateContentLayout(value) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return { ok: false, error: "页面对象位置格式无效" };
  }

  const layout = {};
  for (const [key, item] of Object.entries(value)) {
    const isContent = CONTENT_KEYS.has(key);
    const isVisual = VISUAL_KEYS.has(key);
    if (!isContent && !isVisual) {
      return { ok: false, error: `页面对象位置字段无效：${key}` };
    }
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return { ok: false, error: "页面对象位置内容无效" };
    }
    const xPercent = finiteOffset(item.xPercent);
    const yPercent = finiteOffset(item.yPercent);
    if (xPercent === null || yPercent === null) {
      return { ok: false, error: "页面对象位置坐标无效" };
    }

    const allowedKeys = new Set([
      "xPercent",
      "yPercent",
      ...(isContent ? CONTENT_STYLE_KEYS : []),
    ]);
    if (Object.keys(item).some((field) => !allowedKeys.has(field))) {
      return { ok: false, error: `页面对象样式字段无效：${key}` };
    }

    const normalized = { xPercent, yPercent };
    if (isContent && Object.hasOwn(item, "fontFamily")) {
      if (!Object.hasOwn(fontFamilies, item.fontFamily)) {
        return { ok: false, error: "原有文字字体无效" };
      }
      normalized.fontFamily = item.fontFamily;
    }
    if (isContent && Object.hasOwn(item, "fontSize")) {
      const fontSize = Number(item.fontSize);
      if (!Number.isFinite(fontSize) || fontSize < 10 || fontSize > 120) {
        return { ok: false, error: "原有文字字号无效" };
      }
      normalized.fontSize = Number(fontSize.toFixed(2));
    }
    if (isContent && Object.hasOwn(item, "color")) {
      if (typeof item.color !== "string" || !COLOR_PATTERN.test(item.color)) {
        return { ok: false, error: "原有文字颜色无效" };
      }
      normalized.color = item.color.toLowerCase();
    }
    if (isContent && Object.hasOwn(item, "fontWeight")) {
      const fontWeight = Number(item.fontWeight);
      if (![400, 700].includes(fontWeight)) {
        return { ok: false, error: "原有文字粗细无效" };
      }
      normalized.fontWeight = fontWeight;
    }
    if (isContent && Object.hasOwn(item, "width")) {
      const width = Number(item.width);
      if (!Number.isFinite(width) || width < 40 || width > 1200) {
        return { ok: false, error: "原有文字宽度无效" };
      }
      normalized.width = Number(width.toFixed(2));
    }
    if (isContent && Object.hasOwn(item, "rotation")) {
      const rotation = Number(item.rotation);
      if (!Number.isFinite(rotation) || rotation < -180 || rotation > 180) {
        return { ok: false, error: "原有文字旋转角度无效" };
      }
      normalized.rotation = Number(rotation.toFixed(2));
    }
    if (isContent && Object.hasOwn(item, "textAlign")) {
      if (!["left", "center", "right"].includes(item.textAlign)) {
        return { ok: false, error: "原有文字对齐方式无效" };
      }
      normalized.textAlign = item.textAlign;
    }
    if (isContent && Object.hasOwn(item, "zIndex")) {
      const zIndex = Number(item.zIndex);
      if (!Number.isInteger(zIndex) || zIndex < 1 || zIndex > 50) {
        return { ok: false, error: "原有文字层级无效" };
      }
      normalized.zIndex = zIndex;
    }
    if (isContent && Object.hasOwn(item, "hidden")) {
      if (typeof item.hidden !== "boolean") {
        return { ok: false, error: "原有文字隐藏状态无效" };
      }
      if (item.hidden) normalized.hidden = true;
    }

    if (
      xPercent ||
      yPercent ||
      Object.keys(normalized).some((field) => CONTENT_STYLE_KEYS.has(field))
    ) {
      layout[key] = normalized;
    }
  }

  return { ok: true, value: layout };
}

export function normalizeContentLayout(value) {
  const validation = validateContentLayout(value);
  return validation.ok ? validation.value : {};
}
