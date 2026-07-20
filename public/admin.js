import {
  compressImageFile,
  formatImageSize,
  IMAGE_COMPRESSION_TARGETS,
} from "./image-compression.js";

const adminState = {
  token: sessionStorage.getItem("canglingling_admin_token") || "",
  status: "pending",
};

const adminElements = {
  tokenForm: document.querySelector("#token-form"),
  token: document.querySelector("#admin-token"),
  tokenMessage: document.querySelector("#token-message"),
  panel: document.querySelector("#moderation-panel"),
  list: document.querySelector("#moderation-list"),
  message: document.querySelector("#admin-message"),
  refresh: document.querySelector("#refresh-admin"),
  tabs: [...document.querySelectorAll("[data-status]")],
  mediaManager: document.querySelector("#media-manager"),
  storageUsage: document.querySelector("#storage-usage"),
  carouselUploadForm: document.querySelector("#carousel-upload-form"),
  noteUploadForm: document.querySelector("#note-upload-form"),
  carouselUploadMessage: document.querySelector("#carousel-upload-message"),
  noteUploadMessage: document.querySelector("#note-upload-message"),
  carouselList: document.querySelector("#carousel-admin-list"),
  notesList: document.querySelector("#notes-admin-list"),
  mediaRefreshButtons: [
    ...document.querySelectorAll("[data-refresh-media]"),
  ],
};

adminElements.token.value = "";

function setTokenMessage(message, isError = false) {
  adminElements.tokenMessage.textContent = message;
  adminElements.tokenMessage.classList.toggle("is-error", isError);
}

function setAdminMessage(message, isError = false) {
  adminElements.message.textContent = message;
  adminElements.message.classList.toggle("is-error", isError);
}

function adminHeaders() {
  return {
    authorization: `Bearer ${adminState.token}`,
    accept: "application/json",
  };
}

function formatFileSize(bytes) {
  const value = Number(bytes) || 0;
  if (value <= 0) return "0 KB";
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function setUploadMessage(kind, message, isError = false) {
  const element =
    kind === "carousel"
      ? adminElements.carouselUploadMessage
      : adminElements.noteUploadMessage;
  element.textContent = message;
  element.classList.toggle("is-error", isError);
}

function renderAdminMedia(kind, items) {
  const list =
    kind === "carousel"
      ? adminElements.carouselList
      : adminElements.notesList;
  list.replaceChildren();

  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "library-empty";
    empty.textContent = kind === "carousel" ? "还没有图集文件" : "还没有笔记文件";
    list.append(empty);
    return;
  }

  for (const item of items) {
    const row = document.createElement("div");
    row.className = "library-item";
    const details = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = item.title;
    const meta = document.createElement("small");
    meta.textContent = `${item.fileName} · ${formatFileSize(item.sizeBytes)}`;
    details.append(title, meta);
    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "删除";
    remove.addEventListener("click", () => deleteMedia(item.id, kind));
    row.append(details, remove);
    list.append(row);
  }
}

async function loadAdminMedia(kind) {
  if (!adminState.token) return;
  try {
    const response = await fetch(
      `/api/admin/media?kind=${encodeURIComponent(kind)}`,
      { headers: adminHeaders() },
    );
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "无法读取文件列表");
    renderAdminMedia(kind, data.items || []);
    adminElements.storageUsage.textContent =
      `当前已使用 ${formatFileSize(data.usageBytes)} / ` +
      `${formatFileSize(data.storageLimitBytes)} 安全额度`;
  } catch (error) {
    setUploadMessage(kind, error.message, true);
  }
}

async function uploadMedia(event, kind) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('button[type="submit"]');
  const formData = new FormData(form);
  formData.set("kind", kind);
  setUploadMessage(kind, "正在上传，请稍候……");
  button.disabled = true;

  try {
    if (kind === "carousel") {
      const imageFile = form.elements.file?.files?.[0];
      const compressedImage = await compressImageFile(
        imageFile,
        IMAGE_COMPRESSION_TARGETS.carousel,
      );
      formData.set("file", compressedImage.file);
      if (compressedImage.compressed) {
        setUploadMessage(
          kind,
          `图片已从 ${formatImageSize(compressedImage.originalBytes)} 压缩到 ` +
            `${formatImageSize(compressedImage.outputBytes)}，正在上传……`,
        );
      }
    }

    const response = await fetch("/api/admin/media", {
      method: "POST",
      headers: adminHeaders(),
      body: formData,
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "上传失败");
    form.reset();
    setUploadMessage(kind, "上传成功，公开页面已更新");
    await loadAdminMedia(kind);
  } catch (error) {
    setUploadMessage(kind, error.message, true);
  } finally {
    button.disabled = false;
  }
}

async function deleteMedia(id, kind) {
  if (!window.confirm("确定永久删除这个文件吗？公开页面也会移除它。")) return;
  setUploadMessage(kind, "正在删除……");
  try {
    const response = await fetch(`/api/admin/media/${id}`, {
      method: "DELETE",
      headers: adminHeaders(),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "删除失败");
    setUploadMessage(kind, "文件已删除");
    await loadAdminMedia(kind);
  } catch (error) {
    setUploadMessage(kind, error.message, true);
  }
}

function formatAdminDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : new Intl.DateTimeFormat("zh-CN", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(date);
}

async function moderate(id, action) {
  if (action === "delete" && !window.confirm("确定永久删除这条评论吗？")) {
    return;
  }

  setAdminMessage("正在处理……");
  try {
    const response = await fetch(`/api/admin/comments/${id}`, {
      method: "PATCH",
      headers: { ...adminHeaders(), "content-type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "操作失败");
    setAdminMessage("操作完成");
    await loadAdminComments();
  } catch (error) {
    setAdminMessage(error.message, true);
  }
}

function makeAction(label, className, action, id) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.className = className;
  button.addEventListener("click", () => moderate(id, action));
  return button;
}

function renderAdminComments(comments) {
  adminElements.list.replaceChildren();

  if (!comments.length) {
    const empty = document.createElement("div");
    empty.className = "moderation-empty";
    empty.textContent =
      adminState.status === "pending" ? "没有等待审核的留言 ✦" : "这里还没有留言";
    adminElements.list.append(empty);
    return;
  }

  for (const comment of comments) {
    const card = document.createElement("article");
    card.className = "moderation-card";

    const body = document.createElement("div");
    const meta = document.createElement("div");
    meta.className = "moderation-meta";

    const author = document.createElement("strong");
    author.textContent = comment.author;
    const time = document.createElement("span");
    time.textContent = formatAdminDate(comment.createdAt);
    const page = document.createElement("span");
    page.textContent = comment.page;
    meta.append(author, time, page);

    const content = document.createElement("p");
    content.className = "moderation-content";
    content.textContent = comment.content;
    body.append(meta, content);

    const actions = document.createElement("div");
    actions.className = "moderation-actions";

    if (comment.status !== "approved") {
      actions.append(makeAction("通过", "approve", "approve", comment.id));
    }
    if (comment.status !== "rejected") {
      actions.append(makeAction("拒绝", "", "reject", comment.id));
    }
    actions.append(makeAction("删除", "danger", "delete", comment.id));

    card.append(body, actions);
    adminElements.list.append(card);
  }
}

async function loadAdminComments() {
  if (!adminState.token) return;
  setAdminMessage("正在读取留言……");
  adminElements.refresh.disabled = true;

  try {
    const response = await fetch(
      `/api/admin/comments?status=${encodeURIComponent(adminState.status)}`,
      { headers: adminHeaders() },
    );
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "无法读取留言");
    adminElements.panel.hidden = false;
    renderAdminComments(data.comments || []);
    setAdminMessage(`共 ${data.comments?.length || 0} 条`);
  } catch (error) {
    setAdminMessage(error.message, true);
    if (error.message === "未授权") {
      adminState.token = "";
      sessionStorage.removeItem("canglingling_admin_token");
      adminElements.mediaManager.hidden = true;
      adminElements.panel.hidden = true;
    }
  } finally {
    adminElements.refresh.disabled = false;
  }
}

adminElements.tokenForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = adminElements.tokenForm.querySelector('button[type="submit"]');
  button.disabled = true;
  setTokenMessage("正在验证密码……");
  try {
    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ password: adminElements.token.value }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "登录失败");
    adminState.token = data.token;
    sessionStorage.setItem("canglingling_admin_token", adminState.token);
    adminElements.token.value = "";
    adminElements.panel.hidden = false;
    adminElements.mediaManager.hidden = false;
    setTokenMessage("已进入管理模式");
    await Promise.all([
      loadAdminComments(),
      loadAdminMedia("carousel"),
      loadAdminMedia("note"),
    ]);
  } catch (error) {
    setTokenMessage(error.message, true);
  } finally {
    button.disabled = false;
  }
});

adminElements.refresh.addEventListener("click", loadAdminComments);
adminElements.carouselUploadForm.addEventListener("submit", (event) =>
  uploadMedia(event, "carousel"),
);
adminElements.noteUploadForm.addEventListener("submit", (event) =>
  uploadMedia(event, "note"),
);
for (const button of adminElements.mediaRefreshButtons) {
  button.addEventListener("click", () =>
    loadAdminMedia(button.dataset.refreshMedia),
  );
}

for (const tab of adminElements.tabs) {
  tab.addEventListener("click", async () => {
    adminState.status = tab.dataset.status;
    for (const item of adminElements.tabs) {
      item.classList.toggle("active", item === tab);
    }
    await loadAdminComments();
  });
}

if (adminState.token) {
  adminElements.panel.hidden = false;
  adminElements.mediaManager.hidden = false;
  Promise.all([
    loadAdminComments(),
    loadAdminMedia("carousel"),
    loadAdminMedia("note"),
  ]);
}
