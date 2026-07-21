import {
  canUseModeratedTurnstileFallback,
  limits,
  normalizeText,
  validateComment,
  validateModerationAction,
  validatePage,
} from "./validation.js";
import {
  mergeSettings,
  toPublicSettings,
  validateSettings,
} from "./site-settings.js";
import {
  acceptedFormats,
  buildObjectKey,
  safeStorageLimit,
  uploadLimits,
  validateObjectKey,
  validateUpload,
  verifyFileSignature,
} from "./media.js";
import {
  createAdminSession,
  hashAdminPassword,
  passwordMatches,
  secureEqual,
  validateNewPassword,
  verifyAdminSession,
} from "./admin-auth.js";
import {
  normalizeCustomBlocks,
  validateCustomBlocks,
} from "./custom-blocks.js";
import {
  normalizeContentLayout,
  validateContentLayout,
} from "./content-layout.js";

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
};

const SECURITY_HEADERS = {
  "content-security-policy":
    "default-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; img-src 'self' https://avatars.githubusercontent.com data: blob:; style-src 'self'; script-src 'self' https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com; connect-src 'self' https://challenges.cloudflare.com",
  "permissions-policy": "camera=(), microphone=(), geolocation=()",
  "referrer-policy": "strict-origin-when-cross-origin",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
};

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...JSON_HEADERS, ...SECURITY_HEADERS, ...extraHeaders },
  });
}

function withSecurityHeaders(response) {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    headers.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function digest(value) {
  const bytes = new TextEncoder().encode(value);
  const result = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(result)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function readAdminAuth(env) {
  return env.DB.prepare(
    `SELECT password_salt AS passwordSalt, password_hash AS passwordHash,
            session_version AS sessionVersion
       FROM admin_auth
      WHERE id = 1`,
  ).first();
}

async function isAdmin(request, env) {
  const header = request.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return false;
  const auth = await readAdminAuth(env);
  if (!auth) {
    return (
      (await secureEqual(token, env.ADMIN_TOKEN)) ||
      (await verifyAdminSession(env.ADMIN_TOKEN, token, 0))
    );
  }
  return verifyAdminSession(
    env.ADMIN_TOKEN,
    token,
    Number(auth.sessionVersion),
  );
}

async function readJson(request, maximumBytes = 20_000) {
  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (declaredLength > maximumBytes) throw new Error("PAYLOAD_TOO_LARGE");
  return request.json();
}

async function readFormData(request, maximumBytes) {
  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (declaredLength && declaredLength > maximumBytes) {
    throw new Error("PAYLOAD_TOO_LARGE");
  }
  return request.formData();
}

async function verifyTurnstile(request, env, token) {
  if (!env.TURNSTILE_SECRET) return { success: true, skipped: true };
  if (!token) return { success: false };

  const form = new FormData();
  form.set("secret", env.TURNSTILE_SECRET);
  form.set("response", token);
  const ip = request.headers.get("CF-Connecting-IP");
  if (ip) form.set("remoteip", ip);

  const response = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    { method: "POST", body: form },
  );
  return response.json();
}

async function getIpHash(request, env) {
  const ip = request.headers.get("CF-Connecting-IP") || "local";
  return digest(`${env.RATE_LIMIT_SALT || "local-development"}:${ip}`);
}

async function isAdminLoginRateLimited(env, ipHash) {
  const row = await env.DB.prepare(
    `SELECT COUNT(*) AS total
       FROM admin_login_attempts
      WHERE ip_hash = ?
        AND julianday(attempted_at) >= julianday('now', '-15 minutes')`,
  )
    .bind(ipHash)
    .first();
  return Number(row?.total || 0) >= 5;
}

async function loginAdmin(request, env) {
  let payload;
  try {
    payload = await readJson(request);
  } catch {
    return json({ error: "登录格式无效" }, 400);
  }

  const password =
    typeof payload?.password === "string" ? payload.password : "";
  if (!password) {
    return json({ error: "密码错误" }, 401);
  }

  const ipHash = await getIpHash(request, env);
  if (await isAdminLoginRateLimited(env, ipHash)) {
    return json({ error: "尝试次数过多，请十五分钟后再试" }, 429);
  }

  const auth = await readAdminAuth(env);
  const valid = auth
    ? await passwordMatches(
        env.ADMIN_TOKEN,
        auth.passwordSalt,
        password,
        auth.passwordHash,
      )
    : await secureEqual(password, env.ADMIN_TOKEN);

  if (!valid) {
    await env.DB.prepare(
      "INSERT INTO admin_login_attempts (ip_hash) VALUES (?)",
    )
      .bind(ipHash)
      .run();
    return json({ error: "密码错误" }, 401);
  }

  await env.DB.prepare(
    "DELETE FROM admin_login_attempts WHERE ip_hash = ? OR julianday(attempted_at) < julianday('now', '-1 day')",
  )
    .bind(ipHash)
    .run();

  const version = auth ? Number(auth.sessionVersion) : 0;
  return json({
    ok: true,
    token: await createAdminSession(env.ADMIN_TOKEN, version),
    expiresIn: 12 * 60 * 60,
    passwordInitialized: Boolean(auth),
  });
}

async function changeAdminPassword(request, env) {
  if (!(await isAdmin(request, env))) return json({ error: "未授权" }, 401);

  let payload;
  try {
    payload = await readJson(request);
  } catch {
    return json({ error: "密码设置格式无效" }, 400);
  }

  const currentPassword =
    typeof payload?.currentPassword === "string"
      ? payload.currentPassword
      : "";
  const newPasswordValidation = validateNewPassword(payload?.newPassword);
  if (!newPasswordValidation.ok) {
    return json({ error: newPasswordValidation.error }, 400);
  }
  if (await secureEqual(currentPassword, newPasswordValidation.value)) {
    return json({ error: "新密码不能与当前密码相同" }, 400);
  }

  const auth = await readAdminAuth(env);
  const currentValid = auth
    ? await passwordMatches(
        env.ADMIN_TOKEN,
        auth.passwordSalt,
        currentPassword,
        auth.passwordHash,
      )
    : await secureEqual(currentPassword, env.ADMIN_TOKEN);
  if (!currentValid) return json({ error: "当前密码错误" }, 401);

  const salt = crypto.randomUUID();
  const passwordHash = await hashAdminPassword(
    env.ADMIN_TOKEN,
    salt,
    newPasswordValidation.value,
  );
  const version = auth ? Number(auth.sessionVersion) + 1 : 1;

  await env.DB.prepare(
    `INSERT INTO admin_auth
       (id, password_salt, password_hash, session_version, updated_at)
     VALUES (1, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
     ON CONFLICT(id) DO UPDATE SET
       password_salt = excluded.password_salt,
       password_hash = excluded.password_hash,
       session_version = excluded.session_version,
       updated_at = excluded.updated_at`,
  )
    .bind(salt, passwordHash, version)
    .run();

  return json({
    ok: true,
    token: await createAdminSession(env.ADMIN_TOKEN, version),
    expiresIn: 12 * 60 * 60,
  });
}

async function isRateLimited(env, ipHash) {
  const row = await env.DB.prepare(
    `SELECT COUNT(*) AS total
       FROM comments
      WHERE ip_hash = ?
        AND julianday(created_at) >= julianday('now', '-10 minutes')`,
  )
    .bind(ipHash)
    .first();
  return Number(row?.total || 0) >= 3;
}

async function getStorageUsage(env) {
  const row = await env.DB.prepare(
    `SELECT
       COALESCE((SELECT SUM(size_bytes) FROM media_items), 0) +
       COALESCE((SELECT SUM(avatar_size_bytes) FROM comments), 0) AS total`,
  ).first();
  return Number(row?.total || 0);
}

async function hasStorageCapacity(env, incomingBytes) {
  const usageBytes = await getStorageUsage(env);
  return {
    allowed: usageBytes + incomingBytes <= safeStorageLimit,
    usageBytes,
  };
}

async function getComments(request, env) {
  const url = new URL(request.url);
  const page = validatePage(url.searchParams.get("page"));
  if (!page) return json({ error: "页面地址无效" }, 400);

  const result = await env.DB.prepare(
    `SELECT id, parent_id AS parentId, author, content,
            avatar_key AS avatarKey, created_at AS createdAt
       FROM comments
      WHERE page = ? AND status = 'approved'
      ORDER BY created_at ASC
      LIMIT 200`,
  )
    .bind(page)
    .all();

  const comments = (result.results || []).map((comment) => ({
    ...comment,
    avatarUrl: comment.avatarKey ? `/media/${comment.avatarKey}` : null,
  }));
  return json({ comments });
}

async function readCommentSubmission(request) {
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.includes("multipart/form-data")) {
    return { payload: await readJson(request), avatar: null };
  }

  const form = await readFormData(request, uploadLimits.avatar + 80_000);
  return {
    payload: {
      author: form.get("author"),
      content: form.get("content"),
      website: form.get("website"),
      page: form.get("page"),
      parentId: form.get("parentId"),
      turnstileToken: form.get("turnstileToken"),
    },
    avatar: form.get("avatar"),
  };
}

async function createComment(request, env) {
  let submission;
  try {
    submission = await readCommentSubmission(request);
  } catch (error) {
    const status = error?.message === "PAYLOAD_TOO_LARGE" ? 413 : 400;
    return json({ error: status === 413 ? "提交内容过大" : "提交格式无效" }, status);
  }

  const { payload, avatar } = submission;
  const validation = validateComment(payload);
  if (!validation.ok) return json({ error: validation.errors[0] }, 400);

  let avatarMetadata = null;
  if (avatar && Number(avatar.size || 0) > 0) {
    const avatarValidation = validateUpload(avatar, "avatar");
    if (!avatarValidation.ok) {
      return json({ error: avatarValidation.error }, 400);
    }
    avatarMetadata = avatarValidation.value;
    if (!(await verifyFileSignature(avatar, avatarMetadata.extension))) {
      return json({ error: "头像文件内容与格式不匹配" }, 400);
    }
  }

  const turnstile = await verifyTurnstile(
    request,
    env,
    normalizeText(payload.turnstileToken),
  );
  const verificationFallback =
    !turnstile.success &&
    canUseModeratedTurnstileFallback(env.COMMENT_MODERATION);
  if (!turnstile.success && !verificationFallback) {
    return json({ error: "人机验证失败，请重试" }, 400);
  }

  const ipHash = await getIpHash(request, env);
  if (await isRateLimited(env, ipHash)) {
    return json({ error: "提交得太快了，请十分钟后再试" }, 429);
  }

  const { author, content, page, parentId } = validation.value;

  if (parentId) {
    const parent = await env.DB.prepare(
      `SELECT id FROM comments
        WHERE id = ? AND page = ? AND status = 'approved'`,
    )
      .bind(parentId, page)
      .first();
    if (!parent) return json({ error: "要回复的评论不存在" }, 400);
  }

  const id = crypto.randomUUID();
  const status = env.COMMENT_MODERATION === "disabled" ? "approved" : "pending";
  const avatarKey = avatarMetadata
    ? buildObjectKey("avatar", avatarMetadata.extension)
    : null;

  try {
    if (avatarKey) {
      const capacity = await hasStorageCapacity(env, avatarMetadata.size);
      if (!capacity.allowed) {
        return json({ error: "免费存储安全额度已满，暂时无法上传头像" }, 507);
      }
      await env.MEDIA.put(avatarKey, await avatar.arrayBuffer(), {
        metadata: {
          contentType: avatarMetadata.mimeType,
          cacheControl: "public, max-age=31536000, immutable",
          originalName: avatarMetadata.originalName,
        },
      });
    }

    await env.DB.prepare(
      `INSERT INTO comments
        (id, page, parent_id, author, content, status, ip_hash, avatar_key,
         avatar_size_bytes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        id,
        page,
        parentId,
        author,
        content,
        status,
        ipHash,
        avatarKey,
        avatarMetadata?.size || 0,
      )
      .run();
  } catch (error) {
    if (avatarKey) await env.MEDIA.delete(avatarKey).catch(() => {});
    throw error;
  }

  return json(
    {
      ok: true,
      id,
      status,
      verificationFallback,
      message:
        verificationFallback
          ? "验证服务暂时不可用，留言已安全送入人工审核"
          : status === "pending"
          ? "评论已送到小窝，审核后就会出现啦"
          : "评论发布成功",
    },
    201,
  );
}

async function getAdminComments(request, env) {
  if (!(await isAdmin(request, env))) return json({ error: "未授权" }, 401);

  const url = new URL(request.url);
  const requestedStatus = url.searchParams.get("status") || "pending";
  const status = ["pending", "approved", "rejected"].includes(requestedStatus)
    ? requestedStatus
    : "pending";

  const result = await env.DB.prepare(
    `SELECT id, page, parent_id AS parentId, author, content, status,
            created_at AS createdAt, moderated_at AS moderatedAt
       FROM comments
      WHERE status = ?
      ORDER BY created_at DESC
      LIMIT 200`,
  )
    .bind(status)
    .all();

  return json({ comments: result.results || [] });
}

async function moderateComment(request, env, id) {
  if (!(await isAdmin(request, env))) return json({ error: "未授权" }, 401);

  let payload;
  try {
    payload = await readJson(request);
  } catch {
    return json({ error: "提交格式无效" }, 400);
  }

  const action = validateModerationAction(payload?.action);
  if (!action) return json({ error: "审核操作无效" }, 400);

  const existing = await env.DB.prepare(
    "SELECT id, avatar_key AS avatarKey FROM comments WHERE id = ?",
  )
    .bind(id)
    .first();
  if (!existing) return json({ error: "评论不存在" }, 404);

  if (action === "delete") {
    const avatarRows = await env.DB.prepare(
      `WITH RECURSIVE thread(id, avatar_key) AS (
         SELECT id, avatar_key FROM comments WHERE id = ?
         UNION ALL
         SELECT child.id, child.avatar_key
           FROM comments child
           JOIN thread parent ON child.parent_id = parent.id
       )
       SELECT avatar_key AS avatarKey FROM thread WHERE avatar_key IS NOT NULL`,
    )
      .bind(id)
      .all();

    const avatarKeys = (avatarRows.results || [])
      .map((row) => row.avatarKey)
      .filter(Boolean);
    if (avatarKeys.length) {
      await Promise.all(avatarKeys.map((key) => env.MEDIA.delete(key)));
    }
    await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO moderation_log (comment_id, action) VALUES (?, ?)",
      ).bind(id, action),
      env.DB.prepare("DELETE FROM comments WHERE id = ?").bind(id),
    ]);
  } else {
    await env.DB.batch([
      env.DB.prepare(
        `UPDATE comments
            SET status = ?, moderated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
          WHERE id = ?`,
      ).bind(action === "approve" ? "approved" : "rejected", id),
      env.DB.prepare(
        "INSERT INTO moderation_log (comment_id, action) VALUES (?, ?)",
      ).bind(id, action),
    ]);
  }

  return json({ ok: true });
}

function publicMediaItem(row) {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    description: row.description,
    fileName: row.fileName,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    createdAt: row.createdAt,
    url: `/media/${row.objectKey}`,
  };
}

async function queryMedia(env, kind, includeHidden = false) {
  const statusClause = includeHidden ? "" : "AND status = 'active'";
  const result = await env.DB.prepare(
    `SELECT id, kind, object_key AS objectKey, title, description,
            file_name AS fileName, mime_type AS mimeType,
            size_bytes AS sizeBytes, status, created_at AS createdAt
       FROM media_items
      WHERE kind = ? ${statusClause}
      ORDER BY sort_order ASC, created_at DESC
      LIMIT 100`,
  )
    .bind(kind)
    .all();
  return result.results || [];
}

async function getPublicMedia(request, env) {
  const url = new URL(request.url);
  const kind = url.searchParams.get("kind");
  if (!["carousel", "note"].includes(kind)) {
    return json({ error: "媒体类型无效" }, 400);
  }
  const items = await queryMedia(env, kind);
  return json({
    items: items.map(publicMediaItem),
    acceptedFormats,
    uploadLimits,
  });
}

async function getAdminMedia(request, env) {
  if (!(await isAdmin(request, env))) return json({ error: "未授权" }, 401);
  const url = new URL(request.url);
  const kind = url.searchParams.get("kind") || "carousel";
  if (!["carousel", "note"].includes(kind)) {
    return json({ error: "媒体类型无效" }, 400);
  }
  const items = await queryMedia(env, kind, true);
  return json({
    items: items.map(publicMediaItem),
    usageBytes: await getStorageUsage(env),
    storageLimitBytes: safeStorageLimit,
  });
}

async function uploadAdminMedia(request, env) {
  if (!(await isAdmin(request, env))) return json({ error: "未授权" }, 401);

  let form;
  try {
    form = await readFormData(request, uploadLimits.note + 100_000);
  } catch (error) {
    const status = error?.message === "PAYLOAD_TOO_LARGE" ? 413 : 400;
    return json({ error: status === 413 ? "文件过大" : "上传格式无效" }, status);
  }

  const kind = normalizeText(form.get("kind"));
  if (!["carousel", "note"].includes(kind)) {
    return json({ error: "媒体类型无效" }, 400);
  }
  const file = form.get("file");
  const validation = validateUpload(file, kind);
  if (!validation.ok) return json({ error: validation.error }, 400);

  const metadata = validation.value;
  if (!(await verifyFileSignature(file, metadata.extension))) {
    return json({ error: "文件内容与格式不匹配" }, 400);
  }
  const fallbackTitle = metadata.originalName.replace(/\.[^.]+$/, "");
  const title = normalizeText(form.get("title")) || fallbackTitle;
  const description = normalizeText(form.get("description"));
  if (title.length > 100 || description.length > 400) {
    return json({ error: "标题或说明文字过长" }, 400);
  }

  const capacity = await hasStorageCapacity(env, metadata.size);
  if (!capacity.allowed) {
    return json({ error: "免费存储安全额度已满，请先删除不需要的文件" }, 507);
  }

  const id = crypto.randomUUID();
  const objectKey = buildObjectKey(kind, metadata.extension);
  const inline =
    kind === "carousel" ||
    ["pdf", "md", "markdown", "txt"].includes(metadata.extension);
  const disposition = inline ? "inline" : "attachment";
  const encodedName = encodeURIComponent(metadata.originalName).replace(
    /['()*]/g,
    (character) =>
      `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );

  try {
    await env.MEDIA.put(objectKey, await file.arrayBuffer(), {
      metadata: {
        contentType: metadata.mimeType,
        contentDisposition: `${disposition}; filename*=UTF-8''${encodedName}`,
        cacheControl: "public, max-age=31536000, immutable",
        originalName: metadata.originalName,
      },
    });

    await env.DB.prepare(
      `INSERT INTO media_items
        (id, kind, object_key, title, description, file_name, mime_type, size_bytes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        id,
        kind,
        objectKey,
        title,
        description,
        metadata.originalName,
        metadata.mimeType,
        metadata.size,
      )
      .run();
  } catch (error) {
    await env.MEDIA.delete(objectKey).catch(() => {});
    throw error;
  }

  return json(
    {
      ok: true,
      item: publicMediaItem({
        id,
        kind,
        objectKey,
        title,
        description,
        fileName: metadata.originalName,
        mimeType: metadata.mimeType,
        sizeBytes: metadata.size,
        createdAt: new Date().toISOString(),
      }),
    },
    201,
  );
}

async function deleteAdminMedia(request, env, id) {
  if (!(await isAdmin(request, env))) return json({ error: "未授权" }, 401);
  const item = await env.DB.prepare(
    "SELECT object_key AS objectKey FROM media_items WHERE id = ?",
  )
    .bind(id)
    .first();
  if (!item) return json({ error: "文件不存在" }, 404);

  await env.MEDIA.delete(item.objectKey);
  await env.DB.prepare("DELETE FROM media_items WHERE id = ?").bind(id).run();
  return json({ ok: true });
}

async function serveMedia(request, env, key) {
  if (!["GET", "HEAD"].includes(request.method)) {
    return json({ error: "请求方法无效" }, 405, { allow: "GET, HEAD" });
  }
  if (!validateObjectKey(key)) return json({ error: "文件地址无效" }, 400);

  const object = await env.MEDIA.getWithMetadata(key, {
    type: "stream",
    cacheTtl: 3600,
  });
  if (!object.value) return json({ error: "文件不存在" }, 404);

  const headers = new Headers(SECURITY_HEADERS);
  const metadata = object.metadata || {};
  headers.set("content-type", metadata.contentType || "application/octet-stream");
  headers.set(
    "cache-control",
    metadata.cacheControl || "public, max-age=31536000, immutable",
  );
  if (metadata.contentDisposition) {
    headers.set("content-disposition", metadata.contentDisposition);
  }
  headers.set("x-content-type-options", "nosniff");
  return new Response(request.method === "HEAD" ? null : object.value, {
    headers,
  });
}

async function readStoredSettings(env) {
  const row = await env.DB.prepare(
    `SELECT content_json AS contentJson, theme_json AS themeJson,
            custom_blocks_json AS customBlocksJson,
            content_layout_json AS contentLayoutJson
       FROM site_settings
      WHERE id = 1`,
  ).first();

  if (!row) return { ...mergeSettings(), blocks: [], layout: {} };

  try {
    return {
      ...mergeSettings({
        content: JSON.parse(row.contentJson),
        theme: JSON.parse(row.themeJson),
      }),
      blocks: normalizeCustomBlocks(JSON.parse(row.customBlocksJson || "[]")),
      layout: normalizeContentLayout(
        JSON.parse(row.contentLayoutJson || "{}"),
      ),
    };
  } catch {
    return { ...mergeSettings(), blocks: [], layout: {} };
  }
}

async function getSiteSettings(env) {
  const settings = await readStoredSettings(env);
  return json({
    ...toPublicSettings(settings),
    blocks: settings.blocks,
    layout: settings.layout,
  });
}

async function getAdminSiteSettings(request, env) {
  if (!(await isAdmin(request, env))) return json({ error: "未授权" }, 401);
  return json(await readStoredSettings(env));
}

async function updateAdminSiteSettings(request, env) {
  if (!(await isAdmin(request, env))) return json({ error: "未授权" }, 401);

  let payload;
  try {
    payload = await readJson(request, 100_000);
  } catch (error) {
    const status = error?.message === "PAYLOAD_TOO_LARGE" ? 413 : 400;
    return json({ error: status === 413 ? "设置内容过大" : "设置格式无效" }, status);
  }

  const validation = validateSettings(payload);
  if (!validation.ok) return json({ error: validation.error }, 400);

  const existingSettings = await readStoredSettings(env);
  const blocksValidation =
    payload.blocks === undefined
      ? { ok: true, value: existingSettings.blocks }
      : validateCustomBlocks(payload.blocks);
  if (!blocksValidation.ok) {
    return json({ error: blocksValidation.error }, 400);
  }
  const layoutValidation =
    payload.layout === undefined
      ? { ok: true, value: existingSettings.layout }
      : validateContentLayout(payload.layout);
  if (!layoutValidation.ok) {
    return json({ error: layoutValidation.error }, 400);
  }

  const { content, theme } = validation.value;
  const blocks = blocksValidation.value;
  const layout = layoutValidation.value;
  await env.DB.prepare(
    `INSERT INTO site_settings
       (id, content_json, theme_json, custom_blocks_json,
        content_layout_json, updated_at)
     VALUES (1, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
     ON CONFLICT(id) DO UPDATE SET
       content_json = excluded.content_json,
       theme_json = excluded.theme_json,
       custom_blocks_json = excluded.custom_blocks_json,
       content_layout_json = excluded.content_layout_json,
       updated_at = excluded.updated_at`,
  )
    .bind(
      JSON.stringify(content),
      JSON.stringify(theme),
      JSON.stringify(blocks),
      JSON.stringify(layout),
    )
    .run();

  return json({ ok: true, settings: { content, theme, blocks, layout } });
}

async function handleApi(request, env, pathname) {
  if (pathname === "/api/config" && request.method === "GET") {
    return json({
      turnstileSiteKey: env.TURNSTILE_SITE_KEY || null,
      limits,
      moderationRequired: env.COMMENT_MODERATION !== "disabled",
    });
  }

  if (pathname === "/api/comments") {
    if (request.method === "GET") return getComments(request, env);
    if (request.method === "POST") return createComment(request, env);
  }

  if (pathname === "/api/site-settings" && request.method === "GET") {
    return getSiteSettings(env);
  }

  if (pathname === "/api/admin/login" && request.method === "POST") {
    return loginAdmin(request, env);
  }

  if (pathname === "/api/admin/password" && request.method === "PUT") {
    return changeAdminPassword(request, env);
  }

  if (pathname === "/api/media" && request.method === "GET") {
    return getPublicMedia(request, env);
  }

  if (pathname === "/api/admin/site-settings") {
    if (request.method === "GET") return getAdminSiteSettings(request, env);
    if (request.method === "PUT") return updateAdminSiteSettings(request, env);
  }

  if (pathname === "/api/admin/media") {
    if (request.method === "GET") return getAdminMedia(request, env);
    if (request.method === "POST") return uploadAdminMedia(request, env);
  }

  const adminMediaMatch = pathname.match(
    /^\/api\/admin\/media\/([0-9a-f-]{36})$/i,
  );
  if (adminMediaMatch && request.method === "DELETE") {
    return deleteAdminMedia(request, env, adminMediaMatch[1]);
  }

  if (pathname === "/api/admin/comments" && request.method === "GET") {
    return getAdminComments(request, env);
  }

  const adminMatch = pathname.match(
    /^\/api\/admin\/comments\/([0-9a-f-]{36})$/i,
  );
  if (adminMatch && request.method === "PATCH") {
    return moderateComment(request, env, adminMatch[1]);
  }

  return json({ error: "接口不存在" }, 404);
}

const mobilePagingCompatibilityPatch = String.raw`
;(() => {
  if (window.__canglingMobilePaging) return;
  window.__canglingMobilePaging = true;
  const pages = [...document.querySelectorAll(".site-page")];
  const deck = document.querySelector("#page-deck");
  if (!deck || pages.length < 2) return;
  let gesture = null;
  let lockedUntil = 0;

  const openPage = (index) => {
    const page = pages[Math.max(0, Math.min(pages.length - 1, index))];
    if (!page) return;
    const link = document.querySelector('a[href="#' + page.id + '"]');
    if (link) link.click();
  };

  deck.addEventListener("touchstart", (event) => {
    if (event.touches.length !== 1 || document.querySelector("dialog[open]")) {
      gesture = null;
      return;
    }
    const activeIndex = pages.findIndex((page) => page.classList.contains("is-active"));
    const page = pages[activeIndex];
    const touch = event.touches[0];
    if (!page || !touch) return;
    gesture = {
      activeIndex,
      startX: touch.clientX,
      startY: touch.clientY,
      atTop: page.scrollTop <= 3,
      atBottom: page.scrollTop + page.clientHeight >= page.scrollHeight - 3,
    };
  }, { passive: true });

  deck.addEventListener("touchend", (event) => {
    const current = gesture;
    gesture = null;
    if (!current || document.querySelector("dialog[open]")) return;
    const touch = event.changedTouches[0];
    if (!touch) return;
    const deltaX = touch.clientX - current.startX;
    const deltaY = touch.clientY - current.startY;
    if (Math.abs(deltaY) < 56 || Math.abs(deltaY) <= Math.abs(deltaX) * 1.15) return;
    const forward = deltaY < 0;
    if ((forward && !current.atBottom) || (!forward && !current.atTop)) return;
    const now = Date.now();
    if (now < lockedUntil) return;
    lockedUntil = now + 650;
    openPage(current.activeIndex + (forward ? 1 : -1));
  }, { passive: true });

  deck.addEventListener("touchcancel", () => {
    gesture = null;
  }, { passive: true });
})();`;

async function servePageScript(request, env) {
  const response = await env.ASSETS.fetch(request);
  if (!response.ok) return response;
  const script = await response.text();
  const body = script.includes("pageTouchGesture")
    ? script
    : `${script}\n${mobilePagingCompatibilityPatch}`;
  const headers = new Headers(response.headers);
  headers.set("cache-control", "no-store");
  headers.delete("content-length");
  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);
      if (url.pathname.startsWith("/media/")) {
        const key = decodeURIComponent(url.pathname.slice("/media/".length));
        return await serveMedia(request, env, key);
      }
      if (url.pathname.startsWith("/api/")) {
        return await handleApi(request, env, url.pathname);
      }
      if (url.pathname === "/app.js") {
        return withSecurityHeaders(await servePageScript(request, env));
      }
      return withSecurityHeaders(await env.ASSETS.fetch(request));
    } catch (error) {
      console.error("Unhandled request error", error);
      return json({ error: "小窝暂时出了点问题，请稍后再试" }, 500);
    }
  },
};
