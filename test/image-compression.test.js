import test from "node:test";
import assert from "node:assert/strict";

import {
  compressedImageName,
  formatImageSize,
  IMAGE_COMPRESSION_TARGETS,
} from "../public/image-compression.js";

test("uses safe WebP names for compressed uploads", () => {
  assert.equal(compressedImageName("旅行 照片.PNG"), "旅行-照片.webp");
  assert.equal(compressedImageName("avatar"), "avatar.webp");
  assert.equal(compressedImageName("!!!.jpg"), "image.webp");
});

test("keeps compressed files below server upload limits", () => {
  assert.ok(IMAGE_COMPRESSION_TARGETS.avatar.maxBytes < 1024 * 1024);
  assert.ok(IMAGE_COMPRESSION_TARGETS.carousel.maxBytes < 5 * 1024 * 1024);
  assert.equal(IMAGE_COMPRESSION_TARGETS.avatar.maxDimension, 512);
  assert.equal(IMAGE_COMPRESSION_TARGETS.carousel.maxDimension, 2400);
});

test("formats compression progress sizes for visitors", () => {
  assert.equal(formatImageSize(0), "0 KB");
  assert.equal(formatImageSize(1024), "1 KB");
  assert.equal(formatImageSize(1536 * 1024), "1.50 MB");
});
