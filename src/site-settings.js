export const defaultContent = Object.freeze({
  siteName: "沧翎翎",
  eyebrow: "小窝开放中 · 欢迎偶然路过",
  heroGreeting: "嗨嗨，",
  heroPrefix: "这里是 ",
  heroName: "沧翎翎",
  heroEnding: "。",
  heroLead:
    "一只住在杭州、学习控制的蓝色小龙。\n我把互联网的一小块地方，布置成了自己的秘密基地。",
  heroPrimaryAction: "进来看看",
  heroGithubAction: "去 GitHub 找我",
  heroSpeciesSymbol: "✦",
  speciesLabel: "SPECIES",
  species: "控制系小龙",
  location: "杭州 · HANGZHOU",
  dragonNote: "BLUE DRAGON",
  aboutSectionLabel: "ABOUT THE DEN",
  aboutSectionNumber: "001",
  aboutTitlePrefix: "这是一间",
  aboutTitleAccent: "慢慢长大",
  aboutTitleSuffix: "的小窝。",
  aboutBody1:
    "沧翎翎不太擅长社交，也还在学习怎样写代码和表达自己。但这并不妨碍一只小龙认真地造一间属于自己的网络小窝。",
  aboutBody2:
    "这里不需要很完美。能让偶然路过的人感到一点柔软、好奇，或者愿意多停留一会儿，就已经很好啦。",
  aboutCard1Number: "01",
  aboutCard1Symbol: "⌁",
  card1Title: "认识沧翎翎",
  card1Body:
    "一只在杭州上大学的控制系小龙。性格有一点内向，正在慢慢学习代码，也在认真收藏这个世界有趣的细节。",
  aboutCard2Number: "02",
  aboutCard2Symbol: "✦",
  card2Title: "为什么有这个小窝",
  card2Body:
    "因为在互联网上拥有一块真正属于自己的角落，是一件很酷的事。这里不追赶热闹，只记录喜欢的东西。",
  aboutCard3Number: "03",
  aboutCard3Symbol: "↗",
  card3Title: "小窝会长大吗",
  card3Body:
    "当然啦。也许以后会有技术笔记、生活碎片、兽设故事，或是某个突然冒出来的小作品。慢慢来就好。",
  gallerySectionLabel: "DRAGON GALLERY",
  gallerySectionNumber: "002",
  galleryEyebrow: "小龙收藏的画面",
  galleryTitlePrefix: "慢慢滑过的",
  galleryTitleAccent: "记忆窗口",
  galleryTitleSuffix: "。",
  galleryLead:
    "这里会展示从管理后台上传的图片。可以用按钮切换，也可以直接横向滑动。",
  nowSectionLabel: "RIGHT NOW",
  nowSectionNumber: "003",
  nowSymbol: "✦",
  nowTitle: "最近的\n小龙动态",
  nowLead: "没有宏大叙事，只有一点点向前。",
  now1Number: "01",
  now1Label: "正在学习",
  now1Text: "控制、代码，以及怎样把想法做出来",
  now2Number: "02",
  now2Label: "正在装修",
  now2Text: "让这间小窝越来越像沧翎翎自己",
  now3Number: "03",
  now3Label: "期待遇见",
  now3Text: "可爱的小兽、技术聚聚和偶然路过的你",
  notesSectionLabel: "MY NOTES",
  notesSectionNumber: "004",
  notesEyebrow: "学习与生活的存档",
  notesTitlePrefix: "我的",
  notesTitleAccent: "小龙笔记",
  notesTitleSuffix: "。",
  notesLead:
    "支持 Markdown、PDF、Word、纯文本等格式。点击笔记即可在线查看或下载原文件。",
  guestbookSectionLabel: "GUESTBOOK",
  guestbookSectionNumber: "005",
  guestbookEyebrow: "留下一枚小爪印",
  guestbookTitlePrefix: "路过的话，要不要说声",
  guestbookTitleAccent: "嗨",
  guestbookTitleSuffix: "？",
  guestbookLead:
    "欢迎分享一句问候、一个有趣的想法，或任何想对小龙说的话。为了让小窝保持友善，留言审核后才会出现。",
  commentsTitle: "访客留言",
  commentFormTitle: "WRITE A NOTE",
  commentFormNotice: "友善发言 · 请勿留下隐私信息",
  commentAuthorLabel: "怎么称呼你？",
  commentAvatarLabel: "访客头像",
  commentAvatarHint: "可选 · JPG/PNG/WebP · 超过 1MB 自动压缩",
  commentAvatarChoose: "选择一张头像图片",
  commentContentLabel: "想说些什么？",
  commentSubmitLabel: "送出小爪印",
  footerTitle: "沧翎翎的小窝",
  footerText: "Made slowly, with curiosity and a little bit of magic.",
});

export const fontFamilies = Object.freeze({
  modern:
    '"SF Pro Display", "PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", system-ui, sans-serif',
  rounded:
    '"Arial Rounded MT Bold", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif',
  serif:
    '"Songti SC", "Noto Serif CJK SC", "Source Han Serif SC", Georgia, serif',
  mono:
    '"SFMono-Regular", Consolas, "Liberation Mono", "Noto Sans Mono CJK SC", monospace',
});

export const defaultTheme = Object.freeze({
  fontFamily: "modern",
  baseFontSize: 16,
  backgroundColor: "#f3f8ff",
  textColor: "#17243d",
  primaryColor: "#4f7fff",
  deepColor: "#244cc1",
});

const COLOR_PATTERN = /^#[0-9a-f]{6}$/i;
const CONTENT_KEYS = new Set(Object.keys(defaultContent));
const THEME_KEYS = new Set(Object.keys(defaultTheme));

function cleanText(value, fallback) {
  if (typeof value !== "string") return fallback;
  const normalized = value.replace(/\r\n?/g, "\n").trim();
  return normalized || fallback;
}

export function mergeSettings(input) {
  const content = { ...defaultContent };
  const theme = { ...defaultTheme };

  if (input?.content && typeof input.content === "object") {
    for (const [key, value] of Object.entries(input.content)) {
      if (CONTENT_KEYS.has(key)) {
        content[key] = cleanText(value, defaultContent[key]);
      }
    }
  }

  if (input?.theme && typeof input.theme === "object") {
    for (const [key, value] of Object.entries(input.theme)) {
      if (THEME_KEYS.has(key)) theme[key] = value;
    }
  }

  if (!Object.hasOwn(fontFamilies, theme.fontFamily)) {
    theme.fontFamily = defaultTheme.fontFamily;
  }
  theme.baseFontSize = Number(theme.baseFontSize);
  if (!Number.isFinite(theme.baseFontSize)) {
    theme.baseFontSize = defaultTheme.baseFontSize;
  }
  theme.baseFontSize = Math.round(theme.baseFontSize);
  theme.baseFontSize = Math.min(20, Math.max(14, theme.baseFontSize));

  for (const key of [
    "backgroundColor",
    "textColor",
    "primaryColor",
    "deepColor",
  ]) {
    if (typeof theme[key] !== "string" || !COLOR_PATTERN.test(theme[key])) {
      theme[key] = defaultTheme[key];
    }
    theme[key] = theme[key].toLowerCase();
  }

  return { content, theme };
}

export function validateSettings(input) {
  if (!input || typeof input !== "object") {
    return { ok: false, error: "设置格式无效" };
  }
  if (!input.content || typeof input.content !== "object") {
    return { ok: false, error: "缺少文字设置" };
  }
  if (!input.theme || typeof input.theme !== "object") {
    return { ok: false, error: "缺少外观设置" };
  }

  for (const [key, value] of Object.entries(input.content)) {
    if (!CONTENT_KEYS.has(key)) {
      return { ok: false, error: `未知文字字段：${key}` };
    }
    if (typeof value !== "string") {
      return { ok: false, error: "文字内容格式无效" };
    }
    const max = key.endsWith("Body") || key.endsWith("Lead") ? 600 : 160;
    if (!value.trim() || value.length > max) {
      return { ok: false, error: `文字字段 ${key} 长度无效` };
    }
  }

  for (const key of Object.keys(input.theme)) {
    if (!THEME_KEYS.has(key)) {
      return { ok: false, error: `未知外观字段：${key}` };
    }
  }
  if (!Object.hasOwn(fontFamilies, input.theme.fontFamily)) {
    return { ok: false, error: "字体选项无效" };
  }
  const size = Number(input.theme.baseFontSize);
  if (!Number.isInteger(size) || size < 14 || size > 20) {
    return { ok: false, error: "基础字号应在 14–20px 之间" };
  }
  for (const key of [
    "backgroundColor",
    "textColor",
    "primaryColor",
    "deepColor",
  ]) {
    if (!COLOR_PATTERN.test(input.theme[key] || "")) {
      return { ok: false, error: "颜色格式无效" };
    }
  }

  return { ok: true, value: mergeSettings(input) };
}

export function toPublicSettings(settings) {
  const merged = mergeSettings(settings);
  return {
    content: merged.content,
    theme: {
      ...merged.theme,
      fontStack: fontFamilies[merged.theme.fontFamily],
    },
  };
}
