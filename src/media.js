export const uploadLimits = Object.freeze({
  avatar: 1 * 1024 * 1024,
  carousel: 5 * 1024 * 1024,
  note: 10 * 1024 * 1024,
});

export const safeStorageLimit = 512 * 1024 * 1024;

const IMAGE_TYPES = Object.freeze({
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
});

const CAROUSEL_TYPES = Object.freeze({
  ...IMAGE_TYPES,
  gif: "image/gif",
});

const NOTE_TYPES = Object.freeze({
  md: "text/markdown",
  markdown: "text/markdown",
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  txt: "text/plain",
  rtf: "application/rtf",
  odt: "application/vnd.oasis.opendocument.text",
});

const KIND_CONFIG = Object.freeze({
  avatar: { types: IMAGE_TYPES, prefix: "avatars" },
  carousel: { types: CAROUSEL_TYPES, prefix: "carousel" },
  note: { types: NOTE_TYPES, prefix: "notes" },
});

export function safeFileName(value) {
  const name = typeof value === "string" ? value.split(/[\\/]/).pop() : "";
  const cleaned = (name || "file")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[<>:"|?*;']/g, "-")
    .trim();
  return cleaned.slice(0, 120) || "file";
}

export function extensionOf(fileName) {
  const match = safeFileName(fileName).toLowerCase().match(/\.([a-z0-9]+)$/);
  return match ? match[1] : "";
}

export function validateUpload(file, kind) {
  const config = KIND_CONFIG[kind];
  if (!config) return { ok: false, error: "上传类型无效" };
  if (!file || typeof file !== "object") {
    return { ok: false, error: "请选择文件" };
  }

  const size = Number(file.size);
  if (!Number.isFinite(size) || size <= 0) {
    return { ok: false, error: "文件内容为空" };
  }
  if (size > uploadLimits[kind]) {
    const megabytes = Math.round(uploadLimits[kind] / 1024 / 1024);
    return { ok: false, error: `文件不能超过 ${megabytes}MB` };
  }

  const extension = extensionOf(file.name);
  const expectedMime = config.types[extension];
  if (!expectedMime) return { ok: false, error: "不支持这种文件格式" };

  const suppliedMime = String(file.type || "").toLowerCase();
  const acceptedMimes = new Set([expectedMime]);
  if (extension === "md" || extension === "markdown") {
    acceptedMimes.add("text/plain");
    acceptedMimes.add("application/octet-stream");
  }
  if (extension === "rtf") acceptedMimes.add("text/rtf");
  if (extension === "docx" || extension === "odt") {
    acceptedMimes.add("application/zip");
    acceptedMimes.add("application/octet-stream");
  }
  if (extension === "doc") acceptedMimes.add("application/octet-stream");

  if (suppliedMime && !acceptedMimes.has(suppliedMime)) {
    return { ok: false, error: "文件扩展名与内容类型不匹配" };
  }

  return {
    ok: true,
    value: {
      extension,
      mimeType: expectedMime,
      originalName: safeFileName(file.name),
      prefix: config.prefix,
      size,
    },
  };
}

export function buildObjectKey(kind, extension, id = crypto.randomUUID()) {
  const config = KIND_CONFIG[kind];
  if (!config || !/^[a-z0-9]+$/i.test(extension)) {
    throw new Error("INVALID_OBJECT_KEY");
  }
  return `${config.prefix}/${id}.${extension.toLowerCase()}`;
}

export function validateObjectKey(key) {
  return /^(avatars|carousel|notes)\/[0-9a-f-]{36}\.[a-z0-9]+$/i.test(
    String(key || ""),
  );
}

function startsWith(bytes, signature) {
  return signature.every((byte, index) => bytes[index] === byte);
}

export async function verifyFileSignature(file, extension) {
  if (!file || typeof file.slice !== "function") return false;
  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const ascii = new TextDecoder().decode(bytes);

  if (["md", "markdown", "txt"].includes(extension)) return true;
  if (extension === "jpg" || extension === "jpeg") {
    return startsWith(bytes, [0xff, 0xd8, 0xff]);
  }
  if (extension === "png") {
    return startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  }
  if (extension === "gif") {
    return ascii.startsWith("GIF87a") || ascii.startsWith("GIF89a");
  }
  if (extension === "webp") {
    return ascii.startsWith("RIFF") && ascii.slice(8, 12) === "WEBP";
  }
  if (extension === "pdf") return ascii.startsWith("%PDF-");
  if (extension === "doc") {
    return startsWith(bytes, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
  }
  if (extension === "docx" || extension === "odt") {
    return startsWith(bytes, [0x50, 0x4b, 0x03, 0x04]);
  }
  if (extension === "rtf") return ascii.startsWith("{\\rtf");
  return false;
}

export const acceptedFormats = Object.freeze({
  avatar: Object.keys(IMAGE_TYPES),
  carousel: Object.keys(CAROUSEL_TYPES),
  note: Object.keys(NOTE_TYPES),
});
