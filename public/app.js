import {
  compressImageFile,
  formatImageSize,
  IMAGE_COMPRESSION_TARGETS,
} from "./image-compression.js";

const state = {
  comments: [],
  replyTo: null,
  widgetId: null,
  turnstileUnavailable: false,
  config: null,
  siteSettings: null,
  adminToken: sessionStorage.getItem("canglingling_admin_token") || "",
  inlineEditing: false,
};

const elements = {
  list: document.querySelector("#comment-list"),
  form: document.querySelector("#comment-form"),
  author: document.querySelector("#author"),
  content: document.querySelector("#content"),
  count: document.querySelector("#content-count"),
  message: document.querySelector("#form-message"),
  refresh: document.querySelector("#refresh-comments"),
  replyBanner: document.querySelector("#reply-banner"),
  replyText: document.querySelector("#reply-text"),
  cancelReply: document.querySelector("#cancel-reply"),
  commentDialog: document.querySelector("#comment-dialog"),
  commentOpen: document.querySelector("#open-comment-form"),
  commentClose: document.querySelector("#close-comment-form"),
  turnstile: document.querySelector("#turnstile-container"),
  avatar: document.querySelector("#avatar"),
  avatarPreview: document.querySelector("#avatar-preview"),
  carouselTrack: document.querySelector("#carousel-track"),
  carouselDots: document.querySelector("#carousel-dots"),
  carouselPrevious: document.querySelector("#carousel-previous"),
  carouselNext: document.querySelector("#carousel-next"),
  notesGrid: document.querySelector("#notes-grid"),
  pages: [...document.querySelectorAll(".site-page")],
  dragonSecret: document.querySelector("#dragon-secret"),
  adminLoginDialog: document.querySelector("#admin-login-dialog"),
  adminLoginForm: document.querySelector("#admin-login-form"),
  adminPasswordInput: document.querySelector("#inline-admin-password"),
  inlineLoginMessage: document.querySelector("#inline-login-message"),
  adminDock: document.querySelector("#inline-admin-dock"),
  inlineFontFamily: document.querySelector("#inline-font-family"),
  inlineFontSize: document.querySelector("#inline-font-size"),
  inlineFontSizeOutput: document.querySelector("#inline-font-size-output"),
  inlineBackgroundColor: document.querySelector("#inline-background-color"),
  inlineTextColor: document.querySelector("#inline-text-color"),
  inlinePrimaryColor: document.querySelector("#inline-primary-color"),
  inlineDeepColor: document.querySelector("#inline-deep-color"),
  inlineSaveMessage: document.querySelector("#inline-save-message"),
  inlineSave: document.querySelector("#inline-save"),
  inlineBlockAdd: document.querySelector("#inline-block-add"),
  inlineUndo: document.querySelector("#inline-undo"),
  inlineRedo: document.querySelector("#inline-redo"),
  inlineDuplicate: document.querySelector("#inline-duplicate"),
  inlineDelete: document.querySelector("#inline-delete"),
  inlineBringForward: document.querySelector("#inline-bring-forward"),
  inlineSendBackward: document.querySelector("#inline-send-backward"),
  inlineSlideList: document.querySelector("#inline-slide-list"),
  inlineSelectionLabel: document.querySelector("#inline-selection-label"),
  inlineBlockProperties: document.querySelector("#inline-block-properties"),
  inlineObjectLegend: document.querySelector("#inline-object-legend"),
  inlineBlockFontFamily: document.querySelector("#inline-block-font-family"),
  inlineBlockFontSize: document.querySelector("#inline-block-font-size"),
  inlineBlockColor: document.querySelector("#inline-block-color"),
  inlineBlockBold: document.querySelector("#inline-block-bold"),
  inlineBlockAlign: [...document.querySelectorAll("[data-block-align]")],
  inlineBlockX: document.querySelector("#inline-block-x"),
  inlineBlockY: document.querySelector("#inline-block-y"),
  inlineBlockWidth: document.querySelector("#inline-block-width"),
  inlineBlockRotation: document.querySelector("#inline-block-rotation"),
  inlineResetPosition: document.querySelector("#inline-reset-position"),
  inlineRestoreHidden: document.querySelector("#inline-restore-hidden"),
  inlinePasswordOpen: document.querySelector("#inline-password-open"),
  inlineAdminExit: document.querySelector("#inline-admin-exit"),
  adminPasswordDialog: document.querySelector("#admin-password-dialog"),
  adminPasswordForm: document.querySelector("#admin-password-form"),
  currentAdminPassword: document.querySelector("#current-admin-password"),
  newAdminPassword: document.querySelector("#new-admin-password"),
  confirmAdminPassword: document.querySelector("#confirm-admin-password"),
  inlinePasswordMessage: document.querySelector("#inline-password-message"),
};

let avatarPreviewUrl = null;
let carouselItems = [];
let carouselIndex = 0;
let carouselTimer = null;
let currentPageIndex = 0;
let pageTransitionLockedUntil = 0;
let pageTouchGesture = null;
let inlineThemeDraft = null;
let inlineBlocksDraft = [];
let inlineContentLayoutDraft = {};
let selectedBlockId = "";
let editorHistory = [];
let editorHistoryIndex = -1;
let editorHistoryTimer = null;
let restoringEditorHistory = false;
let editorSavedSerialized = "";

const inlineFontStacks = {
  modern:
    '"SF Pro Display", "PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", system-ui, sans-serif',
  rounded:
    '"Arial Rounded MT Bold", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif',
  serif:
    '"Songti SC", "Noto Serif CJK SC", "Source Han Serif SC", Georgia, serif',
  mono:
    '"SFMono-Regular", Consolas, "Liberation Mono", "Noto Sans Mono CJK SC", monospace',
};

function setMessage(message, isError = false) {
  elements.message.textContent = message;
  elements.message.classList.toggle("is-error", isError);
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function openCommentDialog(focusTarget = elements.author) {
  if (!elements.commentDialog.open) elements.commentDialog.showModal();
  renderTurnstileIfReady();
  window.requestAnimationFrame(() => focusTarget?.focus());
}

function createCommentElement(comment, isReply = false) {
  const article = document.createElement("article");
  article.className = `comment${isReply ? " is-reply" : ""}`;

  const meta = document.createElement("div");
  meta.className = "comment-meta";

  const author = document.createElement("div");
  author.className = "comment-author";

  const avatar = document.createElement("span");
  avatar.className = "comment-avatar";
  if (comment.avatarUrl) {
    const avatarImage = document.createElement("img");
    avatarImage.src = comment.avatarUrl;
    avatarImage.alt = `${comment.author} 的头像`;
    avatarImage.loading = "lazy";
    avatar.append(avatarImage);
  } else {
    avatar.textContent = comment.author.slice(0, 1) || "?";
  }

  const name = document.createElement("span");
  name.textContent = comment.author;
  author.append(avatar, name);

  const time = document.createElement("time");
  time.dateTime = comment.createdAt;
  time.textContent = formatDate(comment.createdAt);
  meta.append(author, time);

  const content = document.createElement("p");
  content.className = "comment-content";
  content.textContent = comment.content;

  const replyButton = document.createElement("button");
  replyButton.className = "reply-button";
  replyButton.type = "button";
  replyButton.textContent = "回复";
  replyButton.addEventListener("click", () => {
    state.replyTo = comment.id;
    elements.replyText.textContent = `正在回复 ${comment.author}`;
    elements.replyBanner.hidden = false;
    openCommentDialog(elements.content);
  });

  article.append(meta, content, replyButton);
  return article;
}

function renderComments() {
  elements.list.replaceChildren();

  if (!state.comments.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "这里还没有留言。要不要成为第一位访客？";
    elements.list.append(empty);
    return;
  }

  const replies = new Map();
  const roots = [];

  for (const comment of state.comments) {
    if (comment.parentId) {
      const list = replies.get(comment.parentId) || [];
      list.push(comment);
      replies.set(comment.parentId, list);
    } else {
      roots.push(comment);
    }
  }

  function buildThread(comment, isReply = false) {
    const element = createCommentElement(comment, isReply);
    for (const reply of replies.get(comment.id) || []) {
      element.append(buildThread(reply, true));
    }
    return element;
  }

  for (const root of roots) {
    elements.list.append(buildThread(root));
  }
}

async function loadComments() {
  elements.refresh.disabled = true;
  try {
    const response = await fetch(
      `/api/comments?page=${encodeURIComponent(location.pathname)}`,
      { headers: { accept: "application/json" } },
    );
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "加载失败");
    state.comments = data.comments || [];
    renderComments();
  } catch (error) {
    elements.list.replaceChildren();
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = `暂时找不到留言：${error.message}`;
    elements.list.append(empty);
  } finally {
    elements.refresh.disabled = false;
  }
}

function formatBytes(bytes) {
  const value = Number(bytes) || 0;
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function updateCarousel(index, smooth = true) {
  if (!carouselItems.length) return;
  carouselIndex =
    (index + carouselItems.length) % carouselItems.length;
  const slides = elements.carouselTrack.querySelectorAll(".carousel-slide");
  const slide = slides[carouselIndex];
  slide?.scrollIntoView({
    behavior: smooth ? "smooth" : "auto",
    block: "nearest",
    inline: "start",
  });
  for (const [dotIndex, dot] of [
    ...elements.carouselDots.querySelectorAll("button"),
  ].entries()) {
    dot.classList.toggle("active", dotIndex === carouselIndex);
    dot.setAttribute("aria-current", dotIndex === carouselIndex ? "true" : "false");
  }
}

function startCarouselTimer() {
  if (carouselTimer) window.clearInterval(carouselTimer);
  if (carouselItems.length < 2) return;
  carouselTimer = window.setInterval(
    () => updateCarousel(carouselIndex + 1),
    6500,
  );
}

function renderCarousel(items) {
  carouselItems = items;
  carouselIndex = 0;
  elements.carouselTrack.replaceChildren();
  elements.carouselDots.replaceChildren();

  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "carousel-empty";
    empty.textContent = "图集还没有内容，去管理后台上传第一张图片吧。";
    elements.carouselTrack.append(empty);
    elements.carouselPrevious.disabled = true;
    elements.carouselNext.disabled = true;
    return;
  }

  for (const [index, item] of items.entries()) {
    const figure = document.createElement("figure");
    figure.className = "carousel-slide";
    figure.setAttribute("aria-label", `第 ${index + 1} 张图片`);

    const backdrop = document.createElement("img");
    backdrop.className = "carousel-backdrop";
    backdrop.src = item.url;
    backdrop.alt = "";
    backdrop.setAttribute("aria-hidden", "true");
    backdrop.loading = index === 0 ? "eager" : "lazy";
    backdrop.decoding = "async";

    const image = document.createElement("img");
    image.className = "carousel-image";
    image.src = item.url;
    image.alt = item.description || item.title;
    image.loading = index === 0 ? "eager" : "lazy";
    image.decoding = "async";

    const caption = document.createElement("figcaption");
    caption.className = "carousel-caption";
    const title = document.createElement("strong");
    title.textContent = item.title;
    if (item.description) {
      const description = document.createElement("p");
      description.textContent = item.description;
      caption.append(description);
    }
    caption.append(title);

    figure.append(backdrop, image, caption);
    elements.carouselTrack.append(figure);

    const dot = document.createElement("button");
    dot.type = "button";
    dot.setAttribute("aria-label", `查看第 ${index + 1} 张图片`);
    dot.addEventListener("click", () => {
      updateCarousel(index);
      startCarouselTimer();
    });
    elements.carouselDots.append(dot);
  }

  elements.carouselPrevious.disabled = items.length < 2;
  elements.carouselNext.disabled = items.length < 2;
  updateCarousel(0, false);
  startCarouselTimer();
}

function renderNotes(items) {
  elements.notesGrid.replaceChildren();
  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "notes-empty";
    empty.textContent = "这里还没有公开笔记。";
    elements.notesGrid.append(empty);
    return;
  }

  for (const item of items) {
    const link = document.createElement("a");
    link.className = "note-card";
    link.href = item.url;
    link.target = "_blank";
    link.rel = "noreferrer";

    const format = document.createElement("span");
    format.className = "note-format";
    format.textContent =
      item.fileName.split(".").pop()?.toUpperCase() || "FILE";
    const title = document.createElement("h3");
    title.textContent = item.title;
    const description = document.createElement("p");
    description.textContent = item.description || "点击查看或下载这份笔记。";
    const footer = document.createElement("footer");
    const size = document.createElement("span");
    size.textContent = formatBytes(item.sizeBytes);
    const action = document.createElement("span");
    action.textContent = "打开 ↗";
    footer.append(size, action);
    link.append(format, title, description, footer);
    elements.notesGrid.append(link);
  }
}

async function loadMedia() {
  try {
    const [carouselResponse, notesResponse] = await Promise.all([
      fetch("/api/media?kind=carousel"),
      fetch("/api/media?kind=note"),
    ]);
    const [carouselData, notesData] = await Promise.all([
      carouselResponse.json(),
      notesResponse.json(),
    ]);
    if (carouselResponse.ok) renderCarousel(carouselData.items || []);
    if (notesResponse.ok) renderNotes(notesData.items || []);
  } catch {
    // Empty states stay visible when media cannot be loaded.
  }
}

function loadTurnstile(siteKey) {
  if (!siteKey) return;
  if (["localhost", "127.0.0.1"].includes(location.hostname)) return;

  const script = document.createElement("script");
  script.src =
    "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
  script.async = true;
  script.defer = true;
  script.addEventListener("load", renderTurnstileIfReady);
  document.head.append(script);
}

function renderTurnstileIfReady() {
  if (
    state.widgetId !== null ||
    !state.config?.turnstileSiteKey ||
    !window.turnstile ||
    !elements.commentDialog.open
  ) {
    return;
  }
  state.widgetId = window.turnstile.render(elements.turnstile, {
    sitekey: state.config.turnstileSiteKey,
    theme: "light",
    size: "flexible",
    callback: () => {
      state.turnstileUnavailable = false;
      elements.turnstile.hidden = false;
    },
    "error-callback": () => {
      state.turnstileUnavailable = true;
      elements.turnstile.hidden = true;
      setMessage("验证服务暂时不可用，仍可提交，留言会进入人工审核。");
      return true;
    },
    "timeout-callback": () => {
      state.turnstileUnavailable = true;
      elements.turnstile.hidden = true;
      setMessage("验证已超时，仍可提交，留言会进入人工审核。");
    },
  });
}

async function loadConfig() {
  try {
    const response = await fetch("/api/config");
    if (!response.ok) return;
    state.config = await response.json();
    loadTurnstile(state.config.turnstileSiteKey);
  } catch {
    // The form remains usable locally when no configuration endpoint is present.
  }
}

function applySiteSettings(settings) {
  const content = settings?.content || {};
  for (const [key, value] of Object.entries(content)) {
    if (typeof value !== "string") continue;
    for (const element of document.querySelectorAll(
      `[data-content="${CSS.escape(key)}"]`,
    )) {
      element.textContent = value;
    }
  }

  const theme = settings?.theme || {};
  const root = document.documentElement;
  const variables = {
    "--paper": theme.backgroundColor,
    "--ink": theme.textColor,
    "--blue": theme.primaryColor,
    "--deep-blue": theme.deepColor,
    "--font-body": theme.fontStack,
    "--base-font-size": Number.isFinite(Number(theme.baseFontSize))
      ? `${Number(theme.baseFontSize)}px`
      : null,
  };
  for (const [name, value] of Object.entries(variables)) {
    if (typeof value === "string" && value) root.style.setProperty(name, value);
  }

  if (content.footerTitle) document.title = content.footerTitle;
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  if (themeMeta && theme.backgroundColor) {
    themeMeta.setAttribute("content", theme.backgroundColor);
  }
  if (settings?.layout) applyContentLayout(settings.layout);
}

async function loadSiteSettings() {
  try {
    const response = await fetch("/api/site-settings", {
      headers: { accept: "application/json" },
    });
    if (!response.ok) return;
    state.siteSettings = await response.json();
    renderCustomBlocks(state.siteSettings.blocks || [], false);
    applySiteSettings(state.siteSettings);
  } catch {
    // Static defaults remain visible if settings cannot be loaded.
  }
}

function resetHorizontalViewport() {
  if (window.scrollX === 0) return;
  window.scrollTo(0, window.scrollY);
}

function goToPage(index, updateHash = true) {
  const nextIndex = Math.min(
    elements.pages.length - 1,
    Math.max(0, Number(index) || 0),
  );
  currentPageIndex = nextIndex;
  for (const [pageIndex, page] of elements.pages.entries()) {
    page.classList.toggle("is-active", pageIndex === nextIndex);
    page.classList.toggle("is-before", pageIndex < nextIndex);
    page.setAttribute("aria-hidden", pageIndex === nextIndex ? "false" : "true");
    if (pageIndex === nextIndex) page.scrollTop = 0;
  }
  for (const link of document.querySelectorAll('nav a[href^="#"]')) {
    link.classList.toggle(
      "is-active",
      link.getAttribute("href") === `#${elements.pages[nextIndex]?.id}`,
    );
  }
  if (updateHash && elements.pages[nextIndex]?.id) {
    history.replaceState(null, "", `#${elements.pages[nextIndex].id}`);
  }
  resetHorizontalViewport();
  requestAnimationFrame(resetHorizontalViewport);
  updateSlideRail();
  if (state.inlineEditing) updateEditorActionState();
}

function initializePageDeck() {
  window.addEventListener("scroll", resetHorizontalViewport, { passive: true });
  const hash = location.hash.slice(1);
  const initialIndex = elements.pages.findIndex((page) => page.id === hash);
  goToPage(initialIndex >= 0 ? initialIndex : 0, false);

  for (const link of document.querySelectorAll('a[href^="#"]')) {
    const targetIndex = elements.pages.findIndex(
      (page) => `#${page.id}` === link.getAttribute("href"),
    );
    if (targetIndex < 0) continue;
    link.addEventListener("click", (event) => {
      event.preventDefault();
      goToPage(targetIndex);
    });
  }

  window.addEventListener("keydown", (event) => {
    const target = event.target;
    if (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement ||
      target?.isContentEditable
    ) {
      return;
    }
    if (["ArrowDown", "PageDown"].includes(event.key)) {
      event.preventDefault();
      goToPage(currentPageIndex + 1);
    }
    if (["ArrowUp", "PageUp"].includes(event.key)) {
      event.preventDefault();
      goToPage(currentPageIndex - 1);
    }
  });

  window.addEventListener(
    "wheel",
    (event) => {
      if (state.inlineEditing) return;
      if (document.querySelector("dialog[open]")) return;
      const page = elements.pages[currentPageIndex];
      if (!page || Math.abs(event.deltaY) < 24) return;
      const goingDown = event.deltaY > 0;
      const canScrollDown =
        page.scrollTop + page.clientHeight < page.scrollHeight - 3;
      const canScrollUp = page.scrollTop > 3;
      if ((goingDown && canScrollDown) || (!goingDown && canScrollUp)) return;

      event.preventDefault();
      const now = Date.now();
      if (now < pageTransitionLockedUntil) return;
      pageTransitionLockedUntil = now + 650;
      goToPage(currentPageIndex + (goingDown ? 1 : -1));
    },
    { passive: false },
  );

  const deck = document.querySelector("#page-deck");
  deck?.addEventListener(
    "touchstart",
    (event) => {
      if (state.inlineEditing || document.querySelector("dialog[open]")) {
        pageTouchGesture = null;
        return;
      }
      if (event.touches.length !== 1) {
        pageTouchGesture = null;
        return;
      }

      const page = elements.pages[currentPageIndex];
      const touch = event.touches[0];
      if (!page || !touch) return;

      pageTouchGesture = {
        pageIndex: currentPageIndex,
        startX: touch.clientX,
        startY: touch.clientY,
        startedAtTop: page.scrollTop <= 3,
        startedAtBottom:
          page.scrollTop + page.clientHeight >= page.scrollHeight - 3,
      };
    },
    { passive: true },
  );

  deck?.addEventListener(
    "touchend",
    (event) => {
      const gesture = pageTouchGesture;
      pageTouchGesture = null;
      if (!gesture || gesture.pageIndex !== currentPageIndex) return;
      if (state.inlineEditing || document.querySelector("dialog[open]")) return;

      const touch = event.changedTouches[0];
      if (!touch) return;
      const deltaX = touch.clientX - gesture.startX;
      const deltaY = touch.clientY - gesture.startY;
      if (Math.abs(deltaY) < 56 || Math.abs(deltaY) <= Math.abs(deltaX) * 1.15) {
        return;
      }

      const goingDown = deltaY < 0;
      if (goingDown && !gesture.startedAtBottom) return;
      if (!goingDown && !gesture.startedAtTop) return;

      const now = Date.now();
      if (now < pageTransitionLockedUntil) return;
      pageTransitionLockedUntil = now + 650;
      goToPage(currentPageIndex + (goingDown ? 1 : -1));
    },
    { passive: true },
  );

  deck?.addEventListener(
    "touchcancel",
    () => {
      pageTouchGesture = null;
    },
    { passive: true },
  );
}

function setInlineMessage(element, message, isError = false) {
  element.textContent = message;
  element.classList.toggle("is-error", isError);
}

function adminHeaders() {
  return {
    authorization: `Bearer ${state.adminToken}`,
    accept: "application/json",
  };
}

function settingsForDisplay(settings) {
  const theme = settings?.theme || {};
  return {
    content: settings?.content || {},
    layout: settings?.layout,
    theme: {
      ...theme,
      fontStack:
        theme.fontStack ||
        inlineFontStacks[theme.fontFamily] ||
        inlineFontStacks.modern,
    },
  };
}

function normalizeClientContentPosition(position) {
  const x = Number(position?.xPercent);
  const y = Number(position?.yPercent);
  return {
    xPercent: Number(
      Math.min(100, Math.max(-100, Number.isFinite(x) ? x : 0)).toFixed(2),
    ),
    yPercent: Number(
      Math.min(100, Math.max(-100, Number.isFinite(y) ? y : 0)).toFixed(2),
    ),
  };
}

function normalizeClientLayoutItem(item, key = "") {
  const normalized = normalizeClientContentPosition(item);
  if (key.startsWith("visual.")) return normalized;

  if (Object.hasOwn(inlineFontStacks, item?.fontFamily)) {
    normalized.fontFamily = item.fontFamily;
  }
  const fontSize = Number(item?.fontSize);
  if (Number.isFinite(fontSize) && fontSize >= 10 && fontSize <= 120) {
    normalized.fontSize = Number(fontSize.toFixed(2));
  }
  if (/^#[0-9a-f]{6}$/i.test(item?.color || "")) {
    normalized.color = item.color.toLowerCase();
  }
  if ([400, 700].includes(Number(item?.fontWeight))) {
    normalized.fontWeight = Number(item.fontWeight);
  }
  const width = Number(item?.width);
  if (Number.isFinite(width) && width >= 40 && width <= 1200) {
    normalized.width = Number(width.toFixed(2));
  }
  const rotation = Number(item?.rotation);
  if (Number.isFinite(rotation) && rotation >= -180 && rotation <= 180) {
    normalized.rotation = Number(rotation.toFixed(2));
  }
  if (["left", "center", "right"].includes(item?.textAlign)) {
    normalized.textAlign = item.textAlign;
  }
  const zIndex = Number(item?.zIndex);
  if (Number.isInteger(zIndex) && zIndex >= 1 && zIndex <= 50) {
    normalized.zIndex = zIndex;
  }
  if (item?.hidden === true) normalized.hidden = true;
  return normalized;
}

function layoutKeyForElement(element) {
  if (element?.dataset.content) return element.dataset.content;
  if (element?.dataset.visual) return `visual.${element.dataset.visual}`;
  return "";
}

function layoutElementsForKey(key) {
  if (!key) return [];
  if (key.startsWith("visual.")) {
    return document.querySelectorAll(
      `[data-visual="${CSS.escape(key.slice(7))}"]`,
    );
  }
  return document.querySelectorAll(
    `[data-content="${CSS.escape(key)}"]`,
  );
}

function positionBuiltInContent(element, position) {
  const key = layoutKeyForElement(element);
  const normalized = normalizeClientLayoutItem(position, key);
  const page = element.closest(".site-page");
  const width = page?.clientWidth || window.innerWidth;
  const height = page?.clientHeight || window.innerHeight;
  element.dataset.layoutXPercent = String(normalized.xPercent);
  element.dataset.layoutYPercent = String(normalized.yPercent);
  element.style.setProperty(
    "--content-offset-x",
    `${(width * normalized.xPercent) / 100}px`,
  );
  element.style.setProperty(
    "--content-offset-y",
    `${(height * normalized.yPercent) / 100}px`,
  );
  element.classList.toggle(
    "is-content-positioned",
    Boolean(normalized.xPercent || normalized.yPercent),
  );

  if (element.dataset.content) {
    const styleSettings = [
      [
        "fontFamily",
        "contentFontFamily",
        "--content-font-family",
        normalized.fontFamily
          ? inlineFontStacks[normalized.fontFamily]
          : "",
        "has-content-font-family",
      ],
      [
        "fontSize",
        "contentFontSize",
        "--content-font-size",
        normalized.fontSize ? `${normalized.fontSize}px` : "",
        "has-content-font-size",
      ],
      [
        "color",
        "contentColor",
        "--content-color",
        normalized.color || "",
        "has-content-color",
      ],
      [
        "fontWeight",
        "contentFontWeight",
        "--content-font-weight",
        normalized.fontWeight ? String(normalized.fontWeight) : "",
        "has-content-font-weight",
      ],
      [
        "width",
        "contentWidth",
        "--content-width",
        normalized.width ? `${normalized.width}px` : "",
        "has-content-width",
      ],
      [
        "rotation",
        "contentRotation",
        "--content-rotation",
        normalized.rotation !== undefined ? `${normalized.rotation}deg` : "",
        "has-content-rotation",
      ],
      [
        "textAlign",
        "contentTextAlign",
        "--content-text-align",
        normalized.textAlign || "",
        "has-content-text-align",
      ],
      [
        "zIndex",
        "contentZIndex",
        "--content-z-index",
        normalized.zIndex ? String(normalized.zIndex) : "",
        "has-content-z-index",
      ],
    ];
    for (const [
      keyName,
      datasetName,
      propertyName,
      cssValue,
      className,
    ] of styleSettings) {
      const value = normalized[keyName];
      if (value !== undefined) {
        element.dataset[datasetName] = String(value);
        element.style.setProperty(propertyName, cssValue);
        element.classList.add(className);
      } else {
        delete element.dataset[datasetName];
        element.style.removeProperty(propertyName);
        element.classList.remove(className);
      }
    }
    if (normalized.hidden) {
      element.dataset.contentHidden = "true";
      element.classList.add("is-content-hidden");
    } else {
      delete element.dataset.contentHidden;
      element.classList.remove("is-content-hidden");
    }
  }
}

function positionBuiltInContentKey(key, position) {
  if (!key) return;
  for (const element of layoutElementsForKey(key)) {
    positionBuiltInContent(element, position);
  }
}

function applyContentLayout(layout) {
  inlineContentLayoutDraft =
    layout && typeof layout === "object"
      ? Object.fromEntries(
          Object.entries(layout).map(([key, position]) => [
            key,
            normalizeClientLayoutItem(position, key),
          ]),
        )
      : {};
  for (const element of document.querySelectorAll(
    "[data-content], [data-visual]",
  )) {
    const key = layoutKeyForElement(element);
    positionBuiltInContent(
      element,
      inlineContentLayoutDraft[key] || {
        xPercent: 0,
        yPercent: 0,
      },
    );
  }
}

function collectContentLayout() {
  const layout = {};
  for (const element of document.querySelectorAll(
    "[data-content], [data-visual]",
  )) {
    const key = layoutKeyForElement(element);
    if (!key || Object.hasOwn(layout, key)) continue;
    const item = normalizeClientLayoutItem({
      xPercent: element.dataset.layoutXPercent,
      yPercent: element.dataset.layoutYPercent,
      fontFamily: element.dataset.contentFontFamily,
      fontSize: element.dataset.contentFontSize,
      color: element.dataset.contentColor,
      fontWeight: element.dataset.contentFontWeight,
      width: element.dataset.contentWidth,
      rotation: element.dataset.contentRotation,
      textAlign: element.dataset.contentTextAlign,
      zIndex: element.dataset.contentZIndex,
      hidden: element.dataset.contentHidden === "true",
    }, key);
    if (
      item.xPercent ||
      item.yPercent ||
      item.fontFamily ||
      item.fontSize ||
      item.color ||
      item.fontWeight ||
      item.width ||
      item.rotation ||
      item.textAlign ||
      item.zIndex ||
      item.hidden
    ) {
      layout[key] = item;
    }
  }
  inlineContentLayoutDraft = layout;
  return layout;
}

function positionCustomBlock(element, block) {
  const normalized = {
    xPercent: Math.min(90, Math.max(0, Number(block.xPercent) || 0)),
    yPercent: Math.min(88, Math.max(10, Number(block.yPercent) || 10)),
    width: Math.min(600, Math.max(120, Number(block.width) || 240)),
    fontSize: Math.min(72, Math.max(10, Number(block.fontSize) || 18)),
    color: /^#[0-9a-f]{6}$/i.test(block.color || "")
      ? block.color.toLowerCase()
      : "#17243d",
    fontFamily: Object.hasOwn(inlineFontStacks, block.fontFamily)
      ? block.fontFamily
      : "modern",
    fontWeight: Number(block.fontWeight) === 700 ? 700 : 400,
    textAlign: ["left", "center", "right"].includes(block.textAlign)
      ? block.textAlign
      : "left",
    rotation: Math.min(180, Math.max(-180, Number(block.rotation) || 0)),
    zIndex: Math.min(50, Math.max(1, Number(block.zIndex) || 1)),
  };
  for (const [key, value] of Object.entries(normalized)) {
    element.dataset[key] = String(value);
  }
  element.style.setProperty("--block-x", `${normalized.xPercent}%`);
  element.style.setProperty("--block-y", `${normalized.yPercent}%`);
  element.style.setProperty("--block-width", `${normalized.width}px`);
  element.style.setProperty("--block-font-size", `${normalized.fontSize}px`);
  element.style.setProperty("--block-color", normalized.color);
  element.style.setProperty(
    "--block-font-family",
    inlineFontStacks[normalized.fontFamily],
  );
  element.style.setProperty("--block-font-weight", normalized.fontWeight);
  element.style.setProperty("--block-align", normalized.textAlign);
  element.style.setProperty("--block-rotation", `${normalized.rotation}deg`);
  element.style.setProperty("--block-layer", normalized.zIndex);
}

function selectedCustomBlock() {
  if (!selectedBlockId) return null;
  return document.querySelector(
    `.custom-text-block[data-block-id="${CSS.escape(selectedBlockId)}"]`,
  );
}

function selectedBuiltInContent() {
  return document.querySelector("[data-content].is-editor-selected");
}

function selectedBuiltInVisual() {
  return document.querySelector("[data-visual].is-visual-selected");
}

function cssColorToHex(value, fallback = "#17243d") {
  if (/^#[0-9a-f]{6}$/i.test(value || "")) return value.toLowerCase();
  const match = String(value || "").match(
    /rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i,
  );
  if (!match) return fallback;
  return `#${match
    .slice(1, 4)
    .map((part) => Math.min(255, Number(part)).toString(16).padStart(2, "0"))
    .join("")}`;
}

function hiddenBuiltInContentKeysForCurrentPage() {
  const page = elements.pages[currentPageIndex];
  if (!page) return [];
  return Object.entries(inlineContentLayoutDraft)
    .filter(([key, item]) => !key.startsWith("visual.") && item?.hidden)
    .filter(([key]) =>
      [...layoutElementsForKey(key)].some(
        (element) => element.closest(".site-page") === page,
      ),
    )
    .map(([key]) => key);
}

function updateEditorActionState() {
  const hasBlock = Boolean(selectedCustomBlock());
  const hasBuiltInContent = Boolean(selectedBuiltInContent());
  const hasBuiltInVisual = Boolean(selectedBuiltInVisual());
  const hasTextObject = hasBlock || hasBuiltInContent;
  const hasPositionedObject = hasTextObject || hasBuiltInVisual;
  for (const button of [
    elements.inlineDuplicate,
    elements.inlineDelete,
    elements.inlineBringForward,
    elements.inlineSendBackward,
  ]) {
    button.disabled = !hasTextObject;
  }
  elements.inlineBlockProperties.disabled = !hasPositionedObject;
  for (const control of [
    elements.inlineBlockFontFamily,
    elements.inlineBlockFontSize,
    elements.inlineBlockColor,
    elements.inlineBlockBold,
  ]) {
    control.disabled = !hasTextObject;
  }
  elements.inlineBlockX.disabled = !hasPositionedObject;
  elements.inlineBlockY.disabled = !hasPositionedObject;
  elements.inlineBlockWidth.disabled = !hasTextObject;
  elements.inlineBlockRotation.disabled = !hasTextObject;
  elements.inlineResetPosition.disabled =
    !hasBuiltInContent && !hasBuiltInVisual;
  elements.inlineRestoreHidden.disabled =
    hiddenBuiltInContentKeysForCurrentPage().length === 0;
  for (const button of elements.inlineBlockAlign) {
    button.disabled = !hasTextObject;
  }
  elements.inlineUndo.disabled = editorHistoryIndex <= 0;
  elements.inlineRedo.disabled =
    editorHistoryIndex < 0 || editorHistoryIndex >= editorHistory.length - 1;
}

function updateBlockInspector() {
  const block = selectedCustomBlock();
  const builtInContent = selectedBuiltInContent();
  const selectedVisual = selectedBuiltInVisual();
  updateEditorActionState();
  if (!block && !builtInContent && !selectedVisual) {
    elements.inlineSelectionLabel.textContent = "未选择对象";
    elements.inlineObjectLegend.textContent = "对象属性";
    elements.inlineBlockFontFamily.value =
      inlineThemeDraft?.fontFamily || "modern";
    elements.inlineBlockFontSize.value = "";
    elements.inlineBlockColor.value =
      inlineThemeDraft?.textColor || "#17243d";
    elements.inlineBlockX.value = "";
    elements.inlineBlockY.value = "";
    elements.inlineBlockWidth.value = "";
    elements.inlineBlockRotation.value = "";
    elements.inlineBlockBold.setAttribute("aria-pressed", "false");
    for (const button of elements.inlineBlockAlign) {
      button.setAttribute("aria-pressed", "false");
    }
    return;
  }

  if (selectedVisual) {
    elements.inlineObjectLegend.textContent = "图形对象";
    elements.inlineSelectionLabel.textContent =
      `图形：${selectedVisual.dataset.visualLabel || "页面对象"}`;
    elements.inlineBlockFontFamily.value =
      inlineThemeDraft?.fontFamily || "modern";
    elements.inlineBlockFontSize.value = "";
    elements.inlineBlockColor.value =
      inlineThemeDraft?.textColor || "#17243d";
    elements.inlineBlockX.value = Number(
      selectedVisual.dataset.layoutXPercent || 0,
    ).toFixed(1);
    elements.inlineBlockY.value = Number(
      selectedVisual.dataset.layoutYPercent || 0,
    ).toFixed(1);
    elements.inlineBlockWidth.value = "";
    elements.inlineBlockRotation.value = "";
    elements.inlineBlockBold.setAttribute("aria-pressed", "false");
    for (const button of elements.inlineBlockAlign) {
      button.setAttribute("aria-pressed", "false");
    }
    return;
  }

  if (builtInContent) {
    elements.inlineObjectLegend.textContent = "文本框";
    const computed = getComputedStyle(builtInContent);
    const preview =
      (builtInContent.innerText || builtInContent.textContent || "").trim() ||
      "原有文字";
    const computedWeight = Number.parseInt(computed.fontWeight, 10);
    elements.inlineSelectionLabel.textContent =
      preview.length > 18 ? `${preview.slice(0, 18)}…` : preview;
    elements.inlineBlockFontFamily.value =
      builtInContent.dataset.contentFontFamily ||
      inlineThemeDraft?.fontFamily ||
      "modern";
    elements.inlineBlockFontSize.max = "120";
    elements.inlineBlockFontSize.value =
      builtInContent.dataset.contentFontSize ||
      String(Math.round(Number.parseFloat(computed.fontSize) || 16));
    elements.inlineBlockColor.value =
      builtInContent.dataset.contentColor ||
      cssColorToHex(computed.color, inlineThemeDraft?.textColor);
    elements.inlineBlockX.value = Number(
      builtInContent.dataset.layoutXPercent || 0,
    ).toFixed(1);
    elements.inlineBlockY.value = Number(
      builtInContent.dataset.layoutYPercent || 0,
    ).toFixed(1);
    elements.inlineBlockWidth.value = "";
    elements.inlineBlockRotation.value = "";
    const fontWeight =
      Number(builtInContent.dataset.contentFontWeight) ||
      (Number.isFinite(computedWeight) && computedWeight >= 600 ? 700 : 400);
    elements.inlineBlockBold.setAttribute(
      "aria-pressed",
      fontWeight === 700 ? "true" : "false",
    );
    for (const button of elements.inlineBlockAlign) {
      button.setAttribute("aria-pressed", "false");
    }
    return;
  }

  const preview =
    block.querySelector(".custom-block-text")?.innerText.trim() || "空文本框";
  elements.inlineObjectLegend.textContent = "文本框";
  elements.inlineSelectionLabel.textContent =
    preview.length > 18 ? `${preview.slice(0, 18)}…` : preview;
  elements.inlineBlockFontSize.max = "72";
  elements.inlineBlockFontFamily.value = block.dataset.fontFamily;
  elements.inlineBlockFontSize.value = block.dataset.fontSize;
  elements.inlineBlockColor.value = block.dataset.color;
  elements.inlineBlockX.value = Number(block.dataset.xPercent).toFixed(1);
  elements.inlineBlockY.value = Number(block.dataset.yPercent).toFixed(1);
  elements.inlineBlockWidth.value = String(Math.round(Number(block.dataset.width)));
  elements.inlineBlockRotation.value = String(
    Math.round(Number(block.dataset.rotation)),
  );
  elements.inlineBlockBold.setAttribute(
    "aria-pressed",
    block.dataset.fontWeight === "700" ? "true" : "false",
  );
  for (const button of elements.inlineBlockAlign) {
    button.setAttribute(
      "aria-pressed",
      button.dataset.blockAlign === block.dataset.textAlign ? "true" : "false",
    );
  }
}

function clearEditorSelection() {
  selectedBlockId = "";
  for (const element of document.querySelectorAll(
    ".custom-text-block.is-selected, [data-content].is-editor-selected, [data-visual].is-visual-selected",
  )) {
    element.classList.remove(
      "is-selected",
      "is-editor-selected",
      "is-visual-selected",
    );
  }
  updateBlockInspector();
}

function selectCustomBlock(block, focusText = false) {
  for (const element of document.querySelectorAll(
    ".custom-text-block.is-selected, [data-content].is-editor-selected, [data-visual].is-visual-selected",
  )) {
    element.classList.remove(
      "is-selected",
      "is-editor-selected",
      "is-visual-selected",
    );
  }
  selectedBlockId = block.dataset.blockId || "";
  block.classList.add("is-selected");
  updateBlockInspector();
  if (focusText) beginCustomTextEditing(block);
}

function beginCustomTextEditing(block) {
  const text = block?.querySelector(".custom-block-text");
  if (!text || !state.inlineEditing) return;
  selectCustomBlock(block);
  block.classList.add("is-text-editing");
  text.contentEditable = "plaintext-only";
  if (text.contentEditable !== "plaintext-only") text.contentEditable = "true";
  text.focus();
}

function selectBuiltInContent(element) {
  clearEditorSelection();
  element.classList.add("is-editor-selected");
  updateBlockInspector();
}

function selectBuiltInVisual(element) {
  clearEditorSelection();
  element.classList.add("is-visual-selected");
  updateBlockInspector();
}

function beginBuiltInTextEditing(element) {
  if (!element || !state.inlineEditing) return;
  selectBuiltInContent(element);
  element.classList.add("is-content-editing");
  element.contentEditable = "plaintext-only";
  if (element.contentEditable !== "plaintext-only") {
    element.contentEditable = "true";
  }
  element.focus();
}

function makeBuiltInContentDraggable(element) {
  element.addEventListener("pointerdown", (event) => {
    if (!state.inlineEditing || element.classList.contains("is-content-editing")) {
      return;
    }
    if (event.button !== undefined && event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    selectBuiltInContent(element);

    const page = element.closest(".site-page");
    if (!page) return;
    const pageRect = page.getBoundingClientRect();
    const pointerId = event.pointerId;
    const startX = event.clientX;
    const startY = event.clientY;
    const startPosition = normalizeClientContentPosition({
      xPercent: element.dataset.layoutXPercent,
      yPercent: element.dataset.layoutYPercent,
    });
    let moved = false;
    element.setPointerCapture(pointerId);
    element.classList.add("is-content-dragging");

    const move = (moveEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;
      if (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2) moved = true;
      const key = layoutKeyForElement(element);
      const next = normalizeClientLayoutItem({
        ...(inlineContentLayoutDraft[key] || {}),
        xPercent: startPosition.xPercent + (deltaX / pageRect.width) * 100,
        yPercent: startPosition.yPercent + (deltaY / pageRect.height) * 100,
      }, key);
      positionBuiltInContentKey(key, next);
      inlineContentLayoutDraft[key] = next;
    };

    const end = (endEvent) => {
      if (endEvent?.pointerId !== undefined && endEvent.pointerId !== pointerId) {
        return;
      }
      element.classList.remove("is-content-dragging");
      element.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      if (element.hasPointerCapture(pointerId)) {
        element.releasePointerCapture(pointerId);
      }
      if (moved) {
        recordEditorHistory();
        setInlineMessage(
          elements.inlineSaveMessage,
          "原有文字位置已调整，点击“保存并发布”后访客可见",
        );
      }
    };

    element.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
  });

  element.addEventListener("dblclick", (event) => {
    if (!state.inlineEditing) return;
    event.preventDefault();
    event.stopPropagation();
    beginBuiltInTextEditing(element);
  });
  element.addEventListener("focus", () => {
    if (state.inlineEditing) selectBuiltInContent(element);
  });
  element.addEventListener("input", scheduleEditorHistory);
  element.addEventListener("keydown", (event) => {
    if (state.inlineEditing && event.key === "Escape") {
      event.preventDefault();
      element.blur();
    }
  });
  element.addEventListener("blur", () => {
    if (!state.inlineEditing) return;
    element.contentEditable = "false";
    element.classList.remove("is-content-editing");
    recordEditorHistory();
  });
}

function makeBuiltInVisualDraggable(element) {
  element.addEventListener("pointerdown", (event) => {
    if (!state.inlineEditing || event.target.closest("[data-content]")) return;
    if (event.button !== undefined && event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    selectBuiltInVisual(element);

    const page = element.closest(".site-page");
    if (!page) return;
    const pageRect = page.getBoundingClientRect();
    const pointerId = event.pointerId;
    const startX = event.clientX;
    const startY = event.clientY;
    const startPosition = normalizeClientContentPosition({
      xPercent: element.dataset.layoutXPercent,
      yPercent: element.dataset.layoutYPercent,
    });
    const key = layoutKeyForElement(element);
    let moved = false;
    element.setPointerCapture(pointerId);
    element.classList.add("is-visual-dragging");

    const move = (moveEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;
      if (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2) moved = true;
      const next = normalizeClientLayoutItem({
        ...(inlineContentLayoutDraft[key] || {}),
        xPercent: startPosition.xPercent + (deltaX / pageRect.width) * 100,
        yPercent: startPosition.yPercent + (deltaY / pageRect.height) * 100,
      }, key);
      positionBuiltInContentKey(key, next);
      inlineContentLayoutDraft[key] = next;
    };

    const end = (endEvent) => {
      if (endEvent?.pointerId !== undefined && endEvent.pointerId !== pointerId) {
        return;
      }
      element.classList.remove("is-visual-dragging");
      element.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      if (element.hasPointerCapture(pointerId)) {
        element.releasePointerCapture(pointerId);
      }
      if (moved) {
        recordEditorHistory();
        setInlineMessage(
          elements.inlineSaveMessage,
          "图形位置已调整，点击“保存并发布”后访客可见",
        );
      }
    };

    element.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
  });

  element.addEventListener(
    "click",
    (event) => {
      if (!state.inlineEditing || event.target.closest("[data-content]")) return;
      event.preventDefault();
      event.stopPropagation();
    },
    true,
  );
}

function editorSnapshot() {
  return {
    content: collectInlineContent(),
    theme: { ...inlineThemeDraft },
    blocks: collectCustomBlocks(),
    layout: collectContentLayout(),
    pageIndex: currentPageIndex,
  };
}

function serializedPublishableEditorState() {
  const snapshot = editorSnapshot();
  return JSON.stringify({
    content: snapshot.content,
    theme: snapshot.theme,
    blocks: snapshot.blocks,
    layout: snapshot.layout,
  });
}

function updateEditorSaveState() {
  if (!state.inlineEditing || !elements.inlineSave) return;
  const isDirty =
    Boolean(editorSavedSerialized) &&
    serializedPublishableEditorState() !== editorSavedSerialized;
  elements.inlineSave.dataset.dirty = isDirty ? "true" : "false";
  if (elements.inlineSave.dataset.saving !== "true") {
    elements.inlineSave.textContent = isDirty ? "保存并发布" : "✓ 已保存";
  }
}

function updateEditorHistoryButtons() {
  updateEditorActionState();
  updateEditorSaveState();
}

function recordEditorHistory() {
  if (!state.inlineEditing || restoringEditorHistory) return;
  const snapshot = editorSnapshot();
  const serialized = JSON.stringify(snapshot);
  if (
    editorHistoryIndex >= 0 &&
    editorHistory[editorHistoryIndex]?.serialized === serialized
  ) {
    return;
  }
  editorHistory = editorHistory.slice(0, editorHistoryIndex + 1);
  editorHistory.push({ snapshot, serialized });
  if (editorHistory.length > 50) editorHistory.shift();
  editorHistoryIndex = editorHistory.length - 1;
  updateEditorHistoryButtons();
}

function scheduleEditorHistory() {
  if (editorHistoryTimer) window.clearTimeout(editorHistoryTimer);
  editorHistoryTimer = window.setTimeout(recordEditorHistory, 320);
}

function applyEditorSnapshot(snapshot) {
  restoringEditorHistory = true;
  clearEditorSelection();
  for (const element of document.querySelectorAll("[data-content]")) {
    const value = snapshot.content?.[element.dataset.content];
    if (typeof value === "string") element.textContent = value;
  }
  populateInlineTheme(snapshot.theme || {});
  applyContentLayout(snapshot.layout || {});
  renderCustomBlocks(snapshot.blocks || [], true);
  goToPage(snapshot.pageIndex || 0);
  restoringEditorHistory = false;
  updateEditorHistoryButtons();
}

function undoEditorChange() {
  if (editorHistoryIndex <= 0) return;
  editorHistoryIndex -= 1;
  applyEditorSnapshot(editorHistory[editorHistoryIndex].snapshot);
  setInlineMessage(elements.inlineSaveMessage, "已撤销上一步修改");
}

function redoEditorChange() {
  if (editorHistoryIndex >= editorHistory.length - 1) return;
  editorHistoryIndex += 1;
  applyEditorSnapshot(editorHistory[editorHistoryIndex].snapshot);
  setInlineMessage(elements.inlineSaveMessage, "已重做修改");
}

function renderSlideRail() {
  elements.inlineSlideList.replaceChildren();
  for (const [index, page] of elements.pages.entries()) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "ppt-slide-thumb";
    button.dataset.editorPage = String(index);
    button.setAttribute(
      "aria-label",
      `打开第 ${index + 1} 页：${page.dataset.pageTitle || ""}`,
    );

    const number = document.createElement("span");
    number.textContent = String(index + 1).padStart(2, "0");
    const preview = document.createElement("span");
    preview.className = "ppt-slide-preview";
    const title = document.createElement("strong");
    title.textContent = page.dataset.pageTitle || `页面 ${index + 1}`;
    const kind = document.createElement("small");
    kind.textContent = page.id.toUpperCase();
    preview.append(title, kind);
    button.append(number, preview);
    button.addEventListener("click", () => {
      clearEditorSelection();
      goToPage(index);
    });
    elements.inlineSlideList.append(button);
  }
  updateSlideRail();
}

function updateSlideRail() {
  if (!elements.inlineSlideList) return;
  for (const button of elements.inlineSlideList.querySelectorAll(
    "[data-editor-page]",
  )) {
    const active = Number(button.dataset.editorPage) === currentPageIndex;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-current", active ? "page" : "false");
  }
}

function makeCustomBlockDraggable(block, handle) {
  handle.addEventListener("pointerdown", (event) => {
    if (!state.inlineEditing) return;
    if (
      handle === block &&
      (block.classList.contains("is-text-editing") ||
        event.target.closest(".custom-block-controls, .custom-block-resize"))
    ) {
      return;
    }
    if (event.button !== undefined && event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    selectCustomBlock(block);
    const page = block.closest(".site-page");
    if (!page) return;
    const pointerId = event.pointerId;
    handle.setPointerCapture(event.pointerId);
    block.classList.add("is-dragging");
    const pageRect = page.getBoundingClientRect();
    const blockRect = block.getBoundingClientRect();
    const startX = event.clientX;
    const startY = event.clientY;
    const startLeft = blockRect.left - pageRect.left;
    const startTop = blockRect.top - pageRect.top;
    let moved = false;

    const move = (moveEvent) => {
      if (
        Math.abs(moveEvent.clientX - startX) > 2 ||
        Math.abs(moveEvent.clientY - startY) > 2
      ) {
        moved = true;
      }
      const rect = page.getBoundingClientRect();
      const maximumX = Math.min(
        90,
        Math.max(
          0,
          ((page.clientWidth - block.offsetWidth - 12) / page.clientWidth) *
            100,
        ),
      );
      const maximumY = Math.min(
        88,
        Math.max(
          10,
          ((page.clientHeight - block.offsetHeight - 12) / page.clientHeight) *
            100,
        ),
      );
      const x = Math.min(
        maximumX,
        Math.max(
          0,
          ((startLeft + moveEvent.clientX - startX) / rect.width) * 100,
        ),
      );
      const y = Math.min(
        maximumY,
        Math.max(
          10,
          ((startTop + moveEvent.clientY - startY) / rect.height) * 100,
        ),
      );
      positionCustomBlock(block, {
        xPercent: Number(x.toFixed(2)),
        yPercent: Number(y.toFixed(2)),
        width: Number(block.dataset.width),
        fontSize: Number(block.dataset.fontSize),
        color: block.dataset.color,
        fontFamily: block.dataset.fontFamily,
        fontWeight: Number(block.dataset.fontWeight),
        textAlign: block.dataset.textAlign,
        rotation: Number(block.dataset.rotation),
        zIndex: Number(block.dataset.zIndex),
      });
      updateBlockInspector();
    };

    const end = (endEvent) => {
      if (endEvent?.pointerId !== undefined && endEvent.pointerId !== pointerId) {
        return;
      }
      block.classList.remove("is-dragging");
      handle.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      if (handle.hasPointerCapture(pointerId)) {
        handle.releasePointerCapture(pointerId);
      }
      if (moved) {
        recordEditorHistory();
        setInlineMessage(
          elements.inlineSaveMessage,
          "文本框位置已调整，点击“保存并发布”后访客可见",
        );
      }
    };

    handle.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
  });
}

function makeCustomBlockResizable(block, handle) {
  handle.addEventListener("pointerdown", (event) => {
    if (!state.inlineEditing) return;
    event.preventDefault();
    event.stopPropagation();
    selectCustomBlock(block);
    const pointerId = event.pointerId;
    const startX = event.clientX;
    const startWidth = Number(block.dataset.width);
    handle.setPointerCapture(pointerId);

    const move = (moveEvent) => {
      const width = Math.min(
        600,
        Math.max(120, startWidth + moveEvent.clientX - startX),
      );
      positionCustomBlock(block, {
        ...collectCustomBlocks().find(
          (item) => item.id === block.dataset.blockId,
        ),
        width: Math.round(width),
      });
      updateBlockInspector();
    };

    const end = (endEvent) => {
      if (endEvent?.pointerId !== undefined && endEvent.pointerId !== pointerId) {
        return;
      }
      handle.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      if (handle.hasPointerCapture(pointerId)) {
        handle.releasePointerCapture(pointerId);
      }
      recordEditorHistory();
    };

    handle.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
  });
}

function renderCustomBlocks(blocks, editing = false) {
  const selectedBeforeRender = selectedBlockId;
  for (const existing of document.querySelectorAll(".custom-text-block")) {
    existing.remove();
  }
  inlineBlocksDraft = Array.isArray(blocks)
    ? blocks.map((block) => ({ ...block }))
    : [];

  for (const block of inlineBlocksDraft) {
    const page = document.getElementById(block.pageId);
    if (!page) continue;

    const element = document.createElement("article");
    element.className = "custom-text-block";
    element.dataset.blockId = block.id;
    element.dataset.pageId = block.pageId;
    positionCustomBlock(element, block);

    const text = document.createElement("span");
    text.className = "custom-block-text";
    text.textContent = block.text;
    text.contentEditable = "false";
    text.spellcheck = editing;
    if (editing) {
      text.addEventListener("focus", () => selectCustomBlock(element));
      text.addEventListener("dblclick", (event) => {
        event.preventDefault();
        event.stopPropagation();
        beginCustomTextEditing(element);
      });
      text.addEventListener("input", () => {
        updateBlockInspector();
        scheduleEditorHistory();
      });
      text.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          text.blur();
        }
      });
      text.addEventListener("blur", () => {
        text.contentEditable = "false";
        element.classList.remove("is-text-editing");
        recordEditorHistory();
      });
    }
    element.append(text);

    if (editing) {
      const controls = document.createElement("span");
      controls.className = "custom-block-controls";

      const handle = document.createElement("button");
      handle.type = "button";
      handle.className = "custom-block-handle";
      handle.setAttribute("aria-label", "拖动文本框");
      handle.textContent = "⠿";

      const resize = document.createElement("button");
      resize.type = "button";
      resize.className = "custom-block-resize";
      resize.setAttribute("aria-label", "调整文本框宽度");

      controls.append(handle);
      element.append(controls);
      element.append(resize);
      makeCustomBlockDraggable(element, handle);
      makeCustomBlockDraggable(element, element);
      makeCustomBlockResizable(element, resize);
      element.title = "拖动文本框移动；双击文字编辑";
    }

    page.append(element);
  }
  const selected = selectedBeforeRender
    ? document.querySelector(
        `.custom-text-block[data-block-id="${CSS.escape(selectedBeforeRender)}"]`,
      )
    : null;
  if (editing && selected) selectCustomBlock(selected);
  else if (editing) updateBlockInspector();
}

function collectCustomBlocks() {
  return [...document.querySelectorAll(".custom-text-block")]
    .map((element) => ({
      id: element.dataset.blockId,
      pageId: element.dataset.pageId,
      text: (
        element.querySelector(".custom-block-text")?.innerText || ""
      ).trim(),
      xPercent: Number(element.dataset.xPercent),
      yPercent: Number(element.dataset.yPercent),
      width: Number(element.dataset.width),
      fontSize: Number(element.dataset.fontSize),
      color: element.dataset.color,
      fontFamily: element.dataset.fontFamily,
      fontWeight: Number(element.dataset.fontWeight),
      textAlign: element.dataset.textAlign,
      rotation: Number(element.dataset.rotation),
      zIndex: Number(element.dataset.zIndex),
    }))
    .filter((block) => block.text);
}

function selectedBlockData() {
  const block = selectedCustomBlock();
  if (!block) return null;
  return collectCustomBlocks().find((item) => item.id === block.dataset.blockId);
}

function updateSelectedBlock(patch, immediateHistory = false) {
  const block = selectedCustomBlock();
  const current = selectedBlockData();
  if (!block || !current) return;
  positionCustomBlock(block, { ...current, ...patch });
  updateBlockInspector();
  if (immediateHistory) recordEditorHistory();
  else scheduleEditorHistory();
}

function selectedBuiltInContentData() {
  const element = selectedBuiltInContent();
  if (!element) return null;
  const key = layoutKeyForElement(element);
  return {
    key,
    element,
    item: normalizeClientLayoutItem(
      {
        xPercent: element.dataset.layoutXPercent,
        yPercent: element.dataset.layoutYPercent,
        fontFamily: element.dataset.contentFontFamily,
        fontSize: element.dataset.contentFontSize,
        color: element.dataset.contentColor,
        fontWeight: element.dataset.contentFontWeight,
        width: element.dataset.contentWidth,
        rotation: element.dataset.contentRotation,
        textAlign: element.dataset.contentTextAlign,
        zIndex: element.dataset.contentZIndex,
        hidden: element.dataset.contentHidden === "true",
      },
      key,
    ),
  };
}

function selectedBuiltInLayoutData() {
  const element = selectedBuiltInContent() || selectedBuiltInVisual();
  if (!element) return null;
  const key = layoutKeyForElement(element);
  return {
    key,
    element,
    item: normalizeClientLayoutItem(
      {
        xPercent: element.dataset.layoutXPercent,
        yPercent: element.dataset.layoutYPercent,
        fontFamily: element.dataset.contentFontFamily,
        fontSize: element.dataset.contentFontSize,
        color: element.dataset.contentColor,
        fontWeight: element.dataset.contentFontWeight,
        width: element.dataset.contentWidth,
        rotation: element.dataset.contentRotation,
        textAlign: element.dataset.contentTextAlign,
        zIndex: element.dataset.contentZIndex,
        hidden: element.dataset.contentHidden === "true",
      },
      key,
    ),
  };
}

function updateSelectedPositionObject(patch, immediateHistory = false) {
  const block = selectedBlockData();
  if (block) {
    updateSelectedBlock(
      {
        xPercent: patch.xPercent ?? block.xPercent,
        yPercent: patch.yPercent ?? block.yPercent,
      },
      immediateHistory,
    );
    return;
  }
  const selected = selectedBuiltInLayoutData();
  if (!selected) return;
  const next = normalizeClientLayoutItem(
    { ...selected.item, ...patch },
    selected.key,
  );
  positionBuiltInContentKey(selected.key, next);
  inlineContentLayoutDraft[selected.key] = next;
  updateBlockInspector();
  if (immediateHistory) recordEditorHistory();
  else scheduleEditorHistory();
}

function resetSelectedBuiltInPosition() {
  const selected = selectedBuiltInLayoutData();
  if (!selected) return;
  updateSelectedPositionObject({ xPercent: 0, yPercent: 0 }, true);
  setInlineMessage(elements.inlineSaveMessage, "对象已恢复到原始位置");
}

function nudgeSelectedObject(deltaX, deltaY) {
  const block = selectedBlockData();
  if (block) {
    updateSelectedPositionObject({
      xPercent: block.xPercent + deltaX,
      yPercent: block.yPercent + deltaY,
    });
  } else {
    const selected = selectedBuiltInLayoutData();
    if (!selected) return false;
    updateSelectedPositionObject({
      xPercent: selected.item.xPercent + deltaX,
      yPercent: selected.item.yPercent + deltaY,
    });
  }
  setInlineMessage(
    elements.inlineSaveMessage,
    "对象位置已微调，记得保存并发布",
  );
  return true;
}

function updateSelectedTextObject(patch, immediateHistory = false) {
  if (selectedCustomBlock()) {
    updateSelectedBlock(patch, immediateHistory);
    return;
  }
  const selected = selectedBuiltInContentData();
  if (!selected) return;
  const next = normalizeClientLayoutItem(
    { ...selected.item, ...patch },
    selected.key,
  );
  positionBuiltInContentKey(selected.key, next);
  inlineContentLayoutDraft[selected.key] = next;
  updateBlockInspector();
  if (immediateHistory) recordEditorHistory();
  else scheduleEditorHistory();
}

function duplicateSelectedBlock() {
  const blocks = collectCustomBlocks();
  if (blocks.length >= 50) {
    setInlineMessage(elements.inlineSaveMessage, "自由文本框最多创建 50 个", true);
    return;
  }
  let source = selectedBlockData();
  if (!source) {
    const selected = selectedBuiltInContentData();
    if (!selected) return;
    const page = selected.element.closest(".site-page");
    if (!page) return;
    const pageRect = page.getBoundingClientRect();
    const rect = selected.element.getBoundingClientRect();
    const computed = getComputedStyle(selected.element);
    const computedAlign = ["left", "center", "right"].includes(
      computed.textAlign,
    )
      ? computed.textAlign
      : "left";
    source = {
      pageId: page.id,
      text:
        (selected.element.innerText || selected.element.textContent || "").trim(),
      xPercent: Math.min(
        90,
        Math.max(0, ((rect.left - pageRect.left) / pageRect.width) * 100),
      ),
      yPercent: Math.min(
        88,
        Math.max(10, ((rect.top - pageRect.top) / pageRect.height) * 100),
      ),
      width: Math.min(600, Math.max(120, Math.round(rect.width))),
      fontSize: Math.min(
        72,
        Math.max(10, Math.round(Number.parseFloat(computed.fontSize) || 18)),
      ),
      color: cssColorToHex(computed.color, inlineThemeDraft?.textColor),
      fontFamily:
        selected.element.dataset.contentFontFamily ||
        inlineThemeDraft?.fontFamily ||
        "modern",
      fontWeight:
        Number.parseInt(computed.fontWeight, 10) >= 600 ? 700 : 400,
      textAlign: selected.item.textAlign || computedAlign,
      rotation: selected.item.rotation || 0,
      zIndex: Math.min(50, (selected.item.zIndex || 1) + 1),
    };
  }
  const copy = {
    ...source,
    id: crypto.randomUUID(),
    xPercent: Math.min(90, source.xPercent + 3),
    yPercent: Math.min(88, source.yPercent + 3),
    zIndex: Math.min(50, source.zIndex + 1),
  };
  blocks.push(copy);
  selectedBlockId = copy.id;
  renderCustomBlocks(blocks, true);
  selectCustomBlock(selectedCustomBlock());
  recordEditorHistory();
  setInlineMessage(elements.inlineSaveMessage, "已复制文本框");
}

function deleteSelectedBlock() {
  const block = selectedCustomBlock();
  if (block) {
    block.remove();
    selectedBlockId = "";
    updateBlockInspector();
    recordEditorHistory();
    setInlineMessage(elements.inlineSaveMessage, "已删除文本框，可使用撤销恢复");
    return;
  }
  const selected = selectedBuiltInContentData();
  if (!selected) return;
  const next = normalizeClientLayoutItem(
    { ...selected.item, hidden: true },
    selected.key,
  );
  positionBuiltInContentKey(selected.key, next);
  inlineContentLayoutDraft[selected.key] = next;
  clearEditorSelection();
  recordEditorHistory();
  setInlineMessage(
    elements.inlineSaveMessage,
    "原有文字已隐藏，可用“恢复本页隐藏文字”找回",
  );
}

function changeSelectedLayer(delta) {
  const data = selectedBlockData();
  if (data) {
    updateSelectedBlock(
      { zIndex: Math.min(50, Math.max(1, data.zIndex + delta)) },
      true,
    );
  } else {
    const selected = selectedBuiltInContentData();
    if (!selected) return;
    updateSelectedTextObject(
      {
        zIndex: Math.min(
          50,
          Math.max(1, (selected.item.zIndex || 1) + delta),
        ),
      },
      true,
    );
  }
  setInlineMessage(
    elements.inlineSaveMessage,
    delta > 0 ? "文本框已上移一层" : "文本框已下移一层",
  );
}

function restoreHiddenBuiltInContent() {
  const keys = hiddenBuiltInContentKeysForCurrentPage();
  if (!keys.length) return;
  for (const key of keys) {
    const next = { ...(inlineContentLayoutDraft[key] || {}) };
    delete next.hidden;
    const normalized = normalizeClientLayoutItem(next, key);
    positionBuiltInContentKey(key, normalized);
    inlineContentLayoutDraft[key] = normalized;
  }
  recordEditorHistory();
  updateBlockInspector();
  setInlineMessage(
    elements.inlineSaveMessage,
    `已恢复 ${keys.length} 个原有文字对象`,
  );
}

function applyInlineTheme() {
  if (!inlineThemeDraft) return;
  elements.inlineFontSizeOutput.textContent =
    `${inlineThemeDraft.baseFontSize}px`;
  applySiteSettings(
    settingsForDisplay({ content: {}, theme: inlineThemeDraft }),
  );
}

function populateInlineTheme(theme) {
  inlineThemeDraft = {
    fontFamily: theme.fontFamily || "modern",
    baseFontSize: Number(theme.baseFontSize) || 16,
    backgroundColor: theme.backgroundColor || "#f3f8ff",
    textColor: theme.textColor || "#17243d",
    primaryColor: theme.primaryColor || "#4f7fff",
    deepColor: theme.deepColor || "#244cc1",
  };
  elements.inlineFontFamily.value = inlineThemeDraft.fontFamily;
  elements.inlineFontSize.value = String(inlineThemeDraft.baseFontSize);
  elements.inlineBackgroundColor.value = inlineThemeDraft.backgroundColor;
  elements.inlineTextColor.value = inlineThemeDraft.textColor;
  elements.inlinePrimaryColor.value = inlineThemeDraft.primaryColor;
  elements.inlineDeepColor.value = inlineThemeDraft.deepColor;
  applyInlineTheme();
}

function enterInlineEditing(settings) {
  state.siteSettings = settings;
  state.inlineEditing = true;
  document.body.classList.add("is-inline-editing");
  elements.adminDock.hidden = false;
  selectedBlockId = "";
  applyContentLayout(settings.layout || {});
  renderCustomBlocks(settings.blocks || [], true);
  for (const element of document.querySelectorAll("[data-content]")) {
    element.contentEditable = "false";
    element.spellcheck = true;
  }
  populateInlineTheme(settings.theme || {});
  renderSlideRail();
  editorHistory = [];
  editorHistoryIndex = -1;
  recordEditorHistory();
  editorSavedSerialized = serializedPublishableEditorState();
  updateEditorSaveState();
  setInlineMessage(
    elements.inlineSaveMessage,
    "已进入可视化编辑器：修改会实时预览，保存后访客可见",
  );
}

function leaveInlineEditing(clearSession = true) {
  state.inlineEditing = false;
  document.body.classList.remove("is-inline-editing");
  elements.adminDock.hidden = true;
  if (editorHistoryTimer) window.clearTimeout(editorHistoryTimer);
  editorHistoryTimer = null;
  editorHistory = [];
  editorHistoryIndex = -1;
  editorSavedSerialized = "";
  clearEditorSelection();
  for (const element of document.querySelectorAll("[data-content]")) {
    element.contentEditable = "false";
    element.classList.remove("is-content-editing", "is-content-dragging");
  }
  if (state.siteSettings) {
    renderCustomBlocks(state.siteSettings.blocks || [], false);
    applySiteSettings(settingsForDisplay(state.siteSettings));
  }
  if (clearSession) {
    state.adminToken = "";
    sessionStorage.removeItem("canglingling_admin_token");
  }
}

async function loadInlineAdminSettings() {
  if (!state.adminToken) return false;
  const response = await fetch("/api/admin/site-settings", {
    headers: adminHeaders(),
  });
  if (!response.ok) {
    state.adminToken = "";
    sessionStorage.removeItem("canglingling_admin_token");
    return false;
  }
  enterInlineEditing(await response.json());
  return true;
}

function collectInlineContent() {
  const content = { ...(state.siteSettings?.content || {}) };
  for (const element of document.querySelectorAll("[data-content]")) {
    const key = element.dataset.content;
    const value = (element.innerText || element.textContent || "")
      .replace(/\u00a0/g, " ")
      .replace(/\r\n?/g, "\n")
      .trim();
    if (key && value) content[key] = value;
  }
  return content;
}

async function saveInlineSettings() {
  setInlineMessage(elements.inlineSaveMessage, "正在保存并发布……");
  elements.inlineSave.disabled = true;
  elements.inlineSave.dataset.saving = "true";
  elements.inlineSave.textContent = "正在保存…";
  try {
    const response = await fetch("/api/admin/site-settings", {
      method: "PUT",
      headers: {
        ...adminHeaders(),
        "content-type": "application/json",
      },
      body: JSON.stringify({
        content: collectInlineContent(),
        theme: inlineThemeDraft,
        blocks: collectCustomBlocks(),
        layout: collectContentLayout(),
      }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "保存失败");
    state.siteSettings = data.settings;
    inlineBlocksDraft = data.settings.blocks || [];
    editorSavedSerialized = serializedPublishableEditorState();
    setInlineMessage(elements.inlineSaveMessage, "已保存，访客页面现在就是这个效果");
  } catch (error) {
    setInlineMessage(elements.inlineSaveMessage, error.message, true);
  } finally {
    delete elements.inlineSave.dataset.saving;
    elements.inlineSave.disabled = false;
    updateEditorSaveState();
  }
}

elements.dragonSecret.addEventListener("click", async () => {
  if (state.adminToken) {
    try {
      if (await loadInlineAdminSettings()) return;
    } catch {
      state.adminToken = "";
      sessionStorage.removeItem("canglingling_admin_token");
    }
  }
  setInlineMessage(elements.inlineLoginMessage, "");
  elements.adminLoginDialog.showModal();
  elements.adminPasswordInput.focus();
});

elements.adminLoginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submit = elements.adminLoginForm.querySelector(
    'button[type="submit"]',
  );
  submit.disabled = true;
  setInlineMessage(elements.inlineLoginMessage, "正在验证……");
  try {
    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ password: elements.adminPasswordInput.value }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "登录失败");
    state.adminToken = data.token;
    sessionStorage.setItem("canglingling_admin_token", state.adminToken);
    elements.adminPasswordInput.value = "";
    if (!(await loadInlineAdminSettings())) throw new Error("会话验证失败");
    elements.adminLoginDialog.close();
  } catch (error) {
    setInlineMessage(elements.inlineLoginMessage, error.message, true);
  } finally {
    submit.disabled = false;
  }
});

for (const input of [
  elements.inlineFontFamily,
  elements.inlineFontSize,
  elements.inlineBackgroundColor,
  elements.inlineTextColor,
  elements.inlinePrimaryColor,
  elements.inlineDeepColor,
]) {
  input.addEventListener("input", () => {
    inlineThemeDraft = {
      fontFamily: elements.inlineFontFamily.value,
      baseFontSize: Number(elements.inlineFontSize.value),
      backgroundColor: elements.inlineBackgroundColor.value,
      textColor: elements.inlineTextColor.value,
      primaryColor: elements.inlinePrimaryColor.value,
      deepColor: elements.inlineDeepColor.value,
    };
    applyInlineTheme();
    scheduleEditorHistory();
  });
}

elements.inlineSave.addEventListener("click", saveInlineSettings);
elements.inlineUndo.addEventListener("click", undoEditorChange);
elements.inlineRedo.addEventListener("click", redoEditorChange);
elements.inlineDuplicate.addEventListener("click", duplicateSelectedBlock);
elements.inlineDelete.addEventListener("click", deleteSelectedBlock);
elements.inlineBringForward.addEventListener("click", () =>
  changeSelectedLayer(1),
);
elements.inlineSendBackward.addEventListener("click", () =>
  changeSelectedLayer(-1),
);

elements.inlineBlockFontFamily.addEventListener("change", () =>
  updateSelectedTextObject(
    { fontFamily: elements.inlineBlockFontFamily.value },
    true,
  ),
);
elements.inlineBlockFontSize.addEventListener("input", () =>
  updateSelectedTextObject({
    fontSize: Number(elements.inlineBlockFontSize.value),
  }),
);
elements.inlineBlockColor.addEventListener("input", () =>
  updateSelectedTextObject({ color: elements.inlineBlockColor.value }),
);
elements.inlineBlockX.addEventListener("input", () =>
  updateSelectedPositionObject({
    xPercent: Number(elements.inlineBlockX.value),
  }),
);
elements.inlineBlockY.addEventListener("input", () =>
  updateSelectedPositionObject({
    yPercent: Number(elements.inlineBlockY.value),
  }),
);
elements.inlineBlockWidth.addEventListener("input", () =>
  updateSelectedTextObject({
    width: Number(elements.inlineBlockWidth.value),
  }),
);
elements.inlineBlockRotation.addEventListener("input", () =>
  updateSelectedTextObject({
    rotation: Number(elements.inlineBlockRotation.value),
  }),
);
elements.inlineResetPosition.addEventListener(
  "click",
  resetSelectedBuiltInPosition,
);
elements.inlineRestoreHidden.addEventListener(
  "click",
  restoreHiddenBuiltInContent,
);
elements.inlineBlockBold.addEventListener("click", () => {
  const blockData = selectedBlockData();
  if (blockData) {
    updateSelectedTextObject(
      { fontWeight: blockData.fontWeight === 700 ? 400 : 700 },
      true,
    );
    return;
  }
  const selected = selectedBuiltInContentData();
  if (!selected) return;
  const computedWeight = Number.parseInt(
    getComputedStyle(selected.element).fontWeight,
    10,
  );
  const currentWeight =
    selected.item.fontWeight ||
    (Number.isFinite(computedWeight) && computedWeight >= 600 ? 700 : 400);
  updateSelectedTextObject(
    { fontWeight: currentWeight === 700 ? 400 : 700 },
    true,
  );
});
for (const button of elements.inlineBlockAlign) {
  button.addEventListener("click", () =>
    updateSelectedTextObject(
      { textAlign: button.dataset.blockAlign },
      true,
    ),
  );
}

for (const element of document.querySelectorAll("[data-content]")) {
  makeBuiltInContentDraggable(element);
}
for (const element of document.querySelectorAll("[data-visual]")) {
  makeBuiltInVisualDraggable(element);
}

window.addEventListener("resize", () => {
  applyContentLayout(
    state.inlineEditing
      ? collectContentLayout()
      : state.siteSettings?.layout || {},
  );
});

elements.inlineBlockAdd.addEventListener("click", () => {
  const blocks = collectCustomBlocks();
  if (blocks.length >= 50) {
    setInlineMessage(elements.inlineSaveMessage, "自由文本框最多创建 50 个", true);
    return;
  }
  const page = elements.pages[currentPageIndex];
  const id = crypto.randomUUID();
  blocks.push({
    id,
    pageId: page.id,
    text: "点击这里输入文字",
    xPercent: Math.min(68, 24 + (blocks.length % 5) * 7),
    yPercent: Math.min(72, 28 + (blocks.length % 4) * 9),
    width: 240,
    fontSize: 18,
    color: inlineThemeDraft?.textColor || "#17243d",
    fontFamily: inlineThemeDraft?.fontFamily || "modern",
    fontWeight: 400,
    textAlign: "left",
    rotation: 0,
    zIndex: Math.min(
      50,
      Math.max(0, ...blocks.map((block) => block.zIndex || 1)) + 1,
    ),
  });
  selectedBlockId = id;
  renderCustomBlocks(blocks, true);
  const block = document.querySelector(
    `.custom-text-block[data-block-id="${CSS.escape(id)}"]`,
  );
  if (block) selectCustomBlock(block, true);
  recordEditorHistory();
  setInlineMessage(
    elements.inlineSaveMessage,
    "文本框已新建：直接输入文字，拖动顶部手柄移动，拖动右下角缩放",
  );
});
elements.inlineAdminExit.addEventListener("click", () =>
  leaveInlineEditing(true),
);
elements.inlinePasswordOpen.addEventListener("click", () => {
  elements.adminPasswordForm.reset();
  setInlineMessage(elements.inlinePasswordMessage, "");
  elements.adminPasswordDialog.showModal();
  elements.currentAdminPassword.focus();
});

elements.adminPasswordForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (
    elements.newAdminPassword.value !== elements.confirmAdminPassword.value
  ) {
    setInlineMessage(elements.inlinePasswordMessage, "两次输入的新密码不一致", true);
    return;
  }
  const submit = elements.adminPasswordForm.querySelector(
    'button[type="submit"]',
  );
  submit.disabled = true;
  setInlineMessage(elements.inlinePasswordMessage, "正在更新密码……");
  try {
    const response = await fetch("/api/admin/password", {
      method: "PUT",
      headers: {
        ...adminHeaders(),
        "content-type": "application/json",
      },
      body: JSON.stringify({
        currentPassword: elements.currentAdminPassword.value,
        newPassword: elements.newAdminPassword.value,
      }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "修改失败");
    state.adminToken = data.token;
    sessionStorage.setItem("canglingling_admin_token", state.adminToken);
    elements.adminPasswordForm.reset();
    elements.adminPasswordDialog.close();
    setInlineMessage(
      elements.inlineSaveMessage,
      "管理员密码已更新，其他旧登录会话已失效",
    );
  } catch (error) {
    setInlineMessage(elements.inlinePasswordMessage, error.message, true);
  } finally {
    submit.disabled = false;
  }
});

for (const closeButton of document.querySelectorAll(".dialog-close")) {
  closeButton.addEventListener("click", () => closeButton.closest("dialog")?.close());
}

window.addEventListener("keydown", (event) => {
  if (!state.inlineEditing) return;
  const modifier = event.ctrlKey || event.metaKey;
  const key = event.key.toLowerCase();
  const target = event.target;
  const editingText =
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target?.isContentEditable;
  if (modifier && key === "s") {
    event.preventDefault();
    saveInlineSettings();
    return;
  }
  if (modifier && key === "z") {
    event.preventDefault();
    if (event.shiftKey) redoEditorChange();
    else undoEditorChange();
    return;
  }
  if (modifier && key === "y") {
    event.preventDefault();
    redoEditorChange();
    return;
  }
  if (modifier && key === "d" && !editingText) {
    event.preventDefault();
    duplicateSelectedBlock();
    return;
  }
  if (!editingText && event.key === "Escape") {
    event.preventDefault();
    clearEditorSelection();
    return;
  }
  if (
    !editingText &&
    ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)
  ) {
    const distance = event.shiftKey ? 1 : 0.1;
    const deltaX =
      event.key === "ArrowLeft"
        ? -distance
        : event.key === "ArrowRight"
          ? distance
          : 0;
    const deltaY =
      event.key === "ArrowUp"
        ? -distance
        : event.key === "ArrowDown"
          ? distance
          : 0;
    if (nudgeSelectedObject(deltaX, deltaY)) event.preventDefault();
    return;
  }
  if (!editingText && (event.key === "Delete" || event.key === "Backspace")) {
    event.preventDefault();
    deleteSelectedBlock();
  }
});

elements.content.addEventListener("input", () => {
  elements.count.textContent = String(elements.content.value.length);
});

elements.cancelReply.addEventListener("click", () => {
  state.replyTo = null;
  elements.replyBanner.hidden = true;
});

elements.commentOpen.addEventListener("click", () => {
  state.replyTo = null;
  elements.replyBanner.hidden = true;
  openCommentDialog(elements.author);
});
elements.commentClose.addEventListener("click", () => {
  elements.commentDialog.close();
});

elements.refresh.addEventListener("click", loadComments);
elements.carouselPrevious.addEventListener("click", () => {
  updateCarousel(carouselIndex - 1);
  startCarouselTimer();
});
elements.carouselNext.addEventListener("click", () => {
  updateCarousel(carouselIndex + 1);
  startCarouselTimer();
});

elements.avatar.addEventListener("change", () => {
  if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl);
  const file = elements.avatar.files?.[0];
  if (!file) {
    elements.avatarPreview.style.backgroundImage = "";
    elements.avatarPreview.textContent = "+";
    avatarPreviewUrl = null;
    return;
  }
  avatarPreviewUrl = URL.createObjectURL(file);
  elements.avatarPreview.style.backgroundImage = `url("${avatarPreviewUrl}")`;
  elements.avatarPreview.textContent = "";
});

elements.form.addEventListener("submit", async (event) => {
  event.preventDefault();
  setMessage("");

  const submitButton = elements.form.querySelector('button[type="submit"]');
  const formData = new FormData(elements.form);
  const turnstileToken =
    state.widgetId !== null && window.turnstile
      ? window.turnstile.getResponse(state.widgetId)
      : "";

  formData.set("page", location.pathname);
  formData.set("parentId", state.replyTo || "");
  formData.set("turnstileToken", turnstileToken);

  submitButton.disabled = true;

  try {
    const avatarFile = elements.avatar.files?.[0];
    if (avatarFile) {
      setMessage("正在检查并压缩头像……");
      const compressedAvatar = await compressImageFile(
        avatarFile,
        IMAGE_COMPRESSION_TARGETS.avatar,
      );
      formData.set("avatar", compressedAvatar.file);
      if (compressedAvatar.compressed) {
        setMessage(
          `头像已从 ${formatImageSize(compressedAvatar.originalBytes)} 压缩到 ` +
            `${formatImageSize(compressedAvatar.outputBytes)}，正在提交……`,
        );
      }
    }

    const response = await fetch("/api/comments", {
      method: "POST",
      body: formData,
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "提交失败");

    const savedAuthor = elements.author.value;
    elements.form.reset();
    elements.author.value = savedAuthor;
    elements.count.textContent = "0";
    state.replyTo = null;
    elements.replyBanner.hidden = true;
    if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl);
    avatarPreviewUrl = null;
    elements.avatarPreview.style.backgroundImage = "";
    elements.avatarPreview.textContent = "+";
    setMessage(data.message || "留言已经送出");

    if (state.widgetId !== null && window.turnstile) {
      window.turnstile.reset(state.widgetId);
    }

    if (data.status === "approved") await loadComments();
  } catch (error) {
    setMessage(error.message, true);
    if (state.widgetId !== null && window.turnstile) {
      window.turnstile.reset(state.widgetId);
    }
  } finally {
    submitButton.disabled = false;
  }
});

initializePageDeck();
loadConfig();
loadSiteSettings();
loadComments();
loadMedia();
