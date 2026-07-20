import test from "node:test";
import assert from "node:assert/strict";
import {
  buildObjectKey,
  extensionOf,
  safeStorageLimit,
  safeFileName,
  validateObjectKey,
  validateUpload,
  verifyFileSignature,
} from "../src/media.js";

test("keeps the application below the free KV storage ceiling", () => {
  assert.equal(safeStorageLimit, 512 * 1024 * 1024);
});

test("accepts safe image and note formats", () => {
  assert.equal(
    validateUpload({ name: "avatar.webp", type: "image/webp", size: 1200 }, "avatar").ok,
    true,
  );
  assert.equal(
    validateUpload(
      { name: "control-notes.docx", type: "application/zip", size: 8000 },
      "note",
    ).ok,
    true,
  );
  assert.equal(
    validateUpload({ name: "readme.md", type: "text/plain", size: 300 }, "note").ok,
    true,
  );
});

test("rejects executable, mismatched, and oversized files", () => {
  assert.equal(
    validateUpload(
      { name: "payload.html", type: "text/html", size: 100 },
      "note",
    ).ok,
    false,
  );
  assert.equal(
    validateUpload(
      { name: "fake.png", type: "application/javascript", size: 100 },
      "carousel",
    ).ok,
    false,
  );
  assert.equal(
    validateUpload(
      { name: "huge.jpg", type: "image/jpeg", size: 2 * 1024 * 1024 },
      "avatar",
    ).ok,
    false,
  );
});

test("sanitizes names and validates generated object keys", () => {
  assert.equal(extensionOf("../../hello.PDF"), "pdf");
  assert.equal(safeFileName('bad<name>.pdf'), "bad-name-.pdf");
  const key = buildObjectKey(
    "note",
    "pdf",
    "00000000-0000-4000-8000-000000000003",
  );
  assert.equal(key, "notes/00000000-0000-4000-8000-000000000003.pdf");
  assert.equal(validateObjectKey(key), true);
  assert.equal(validateObjectKey("../secret.txt"), false);
});

test("checks binary signatures instead of trusting extensions", async () => {
  const png = new Blob([
    new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]),
  ]);
  const fakePng = new Blob(["<script>alert(1)</script>"]);
  const docx = new Blob([
    new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0]),
  ]);

  assert.equal(await verifyFileSignature(png, "png"), true);
  assert.equal(await verifyFileSignature(fakePng, "png"), false);
  assert.equal(await verifyFileSignature(docx, "docx"), true);
});
