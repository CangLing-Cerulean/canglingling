import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeCustomBlocks,
  validateCustomBlocks,
} from "../src/custom-blocks.js";

const validBlock = {
  id: "00000000-0000-4000-8000-000000000010",
  pageId: "about",
  text: "一段可以拖动的文字",
  xPercent: 36,
  yPercent: 42,
  width: 260,
  fontSize: 20,
  color: "#244cc1",
  fontFamily: "rounded",
  fontWeight: 700,
  textAlign: "center",
  rotation: -8,
  zIndex: 4,
};

test("accepts and normalizes draggable text blocks", () => {
  const result = validateCustomBlocks([validBlock]);
  assert.equal(result.ok, true);
  assert.deepEqual(result.value[0], validBlock);
});

test("rejects unsafe or excessive draggable text blocks", () => {
  assert.equal(
    validateCustomBlocks([{ ...validBlock, pageId: "admin" }]).ok,
    false,
  );
  assert.equal(
    validateCustomBlocks([{ ...validBlock, text: "<".repeat(1001) }]).ok,
    false,
  );
  assert.equal(
    validateCustomBlocks([validBlock, { ...validBlock }]).ok,
    false,
  );
  assert.equal(
    validateCustomBlocks([{ ...validBlock, fontFamily: "remote-font" }]).ok,
    false,
  );
  assert.equal(
    validateCustomBlocks([{ ...validBlock, textAlign: "justify" }]).ok,
    false,
  );
});

test("falls back to an empty list for corrupt stored blocks", () => {
  assert.deepEqual(normalizeCustomBlocks("broken"), []);
});

test("adds safe PPT editor defaults to legacy text blocks", () => {
  const legacy = {
    ...validBlock,
  };
  delete legacy.fontFamily;
  delete legacy.fontWeight;
  delete legacy.textAlign;
  delete legacy.rotation;
  delete legacy.zIndex;

  const result = validateCustomBlocks([legacy]);
  assert.equal(result.ok, true);
  assert.deepEqual(
    {
      fontFamily: result.value[0].fontFamily,
      fontWeight: result.value[0].fontWeight,
      textAlign: result.value[0].textAlign,
      rotation: result.value[0].rotation,
      zIndex: result.value[0].zIndex,
    },
    {
      fontFamily: "modern",
      fontWeight: 400,
      textAlign: "left",
      rotation: 0,
      zIndex: 1,
    },
  );
});
