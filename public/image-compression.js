export const IMAGE_COMPRESSION_TARGETS = Object.freeze({
  avatar: Object.freeze({
    maxBytes: 900 * 1024,
    maxDimension: 512,
    label: "头像",
  }),
  carousel: Object.freeze({
    maxBytes: 4_700 * 1024,
    maxDimension: 2400,
    label: "轮播图片",
  }),
});

const MAX_SAFE_INPUT_BYTES = 50 * 1024 * 1024;
const COMPRESSIBLE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export function formatImageSize(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 KB";
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export function compressedImageName(originalName = "image") {
  const baseName = String(originalName)
    .replace(/\.[^.]+$/, "")
    .replace(/[^\p{L}\p{N}._-]+/gu, "-")
    .replace(/^-+|-+$/g, "");
  return `${baseName || "image"}.webp`;
}

function isGif(file) {
  return file.type === "image/gif" || /\.gif$/i.test(file.name || "");
}

function isCompressible(file) {
  if (COMPRESSIBLE_TYPES.has(file.type)) return true;
  return /\.(?:jpe?g|png|webp)$/i.test(file.name || "");
}

function canvasToWebp(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("浏览器无法生成压缩图片，请先手动缩小图片"));
          return;
        }
        if (blob.type !== "image/webp") {
          reject(new Error("当前浏览器不支持 WebP 压缩，请先手动缩小图片"));
          return;
        }
        resolve(blob);
      },
      "image/webp",
      quality,
    );
  });
}

async function decodeImage(file) {
  if (typeof globalThis.createImageBitmap === "function") {
    try {
      const bitmap = await globalThis.createImageBitmap(file, {
        imageOrientation: "from-image",
      });
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        cleanup: () => bitmap.close(),
      };
    } catch {
      // Some browsers reject imageOrientation. The image element fallback is
      // still able to decode the same file.
    }
  }

  if (typeof document === "undefined" || typeof URL === "undefined") {
    throw new Error("当前环境无法压缩图片");
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("无法读取图片，请换一张图片重试"));
      element.src = objectUrl;
    });
    return {
      source: image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      cleanup: () => URL.revokeObjectURL(objectUrl),
    };
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    throw error;
  }
}

export async function compressImageFile(file, options) {
  const { maxBytes, maxDimension, label = "图片" } = options || {};
  if (!file || !Number.isFinite(file.size)) {
    throw new Error(`请选择要上传的${label}`);
  }
  if (!Number.isFinite(maxBytes) || maxBytes <= 0) {
    throw new Error("图片压缩上限设置无效");
  }
  if (file.size <= maxBytes) {
    return {
      file,
      compressed: false,
      originalBytes: file.size,
      outputBytes: file.size,
    };
  }
  if (file.size > MAX_SAFE_INPUT_BYTES) {
    throw new Error(`${label}超过 50MB，浏览器无法安全处理，请先手动缩小`);
  }
  if (isGif(file)) {
    throw new Error(
      `GIF 动图超过 ${formatImageSize(maxBytes)}，为避免动画丢失，请先手动压缩`,
    );
  }
  if (!isCompressible(file)) {
    throw new Error(`${label}格式不支持自动压缩`);
  }
  if (typeof document === "undefined") {
    throw new Error("当前环境无法压缩图片");
  }

  const decoded = await decodeImage(file);
  try {
    if (!decoded.width || !decoded.height) {
      throw new Error("图片尺寸无效，请换一张图片重试");
    }

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { alpha: true });
    if (!context) throw new Error("浏览器无法启动图片压缩");

    const longestSide = Math.max(decoded.width, decoded.height);
    const initialScale = Math.min(1, maxDimension / longestSide);
    let scale = initialScale;
    let quality = 0.88;
    let result = null;
    let renderedWidth = 0;
    let renderedHeight = 0;

    for (let attempt = 0; attempt < 15; attempt += 1) {
      const width = Math.max(1, Math.round(decoded.width * scale));
      const height = Math.max(1, Math.round(decoded.height * scale));
      if (width !== renderedWidth || height !== renderedHeight) {
        canvas.width = width;
        canvas.height = height;
        context.clearRect(0, 0, width, height);
        context.drawImage(decoded.source, 0, 0, width, height);
        renderedWidth = width;
        renderedHeight = height;
      }

      result = await canvasToWebp(canvas, quality);
      if (result.size <= maxBytes) break;

      if (quality > 0.5) {
        quality = Math.max(0.48, quality - 0.1);
      } else {
        scale *= 0.82;
        quality = 0.76;
      }
    }

    if (!result || result.size > maxBytes) {
      throw new Error(
        `${label}压缩后仍超过 ${formatImageSize(maxBytes)}，请换一张尺寸更小的图片`,
      );
    }

    return {
      file: new File([result], compressedImageName(file.name), {
        type: "image/webp",
        lastModified: Date.now(),
      }),
      compressed: true,
      originalBytes: file.size,
      outputBytes: result.size,
    };
  } finally {
    decoded.cleanup();
  }
}
