import test from "node:test";
import assert from "node:assert/strict";

import {
  normalizeContentLayout,
  validateContentLayout,
} from "../src/content-layout.js";

test("accepts positions for existing editable text", () => {
  const result = validateContentLayout({
    heroGreeting: { xPercent: 12.345, yPercent: -8.2 },
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.value, {
    heroGreeting: { xPercent: 12.35, yPercent: -8.2 },
  });
});

test("accepts positions for movable visual objects", () => {
  const result = validateContentLayout({
    "visual.heroPortrait": { xPercent: -6.4, yPercent: 9.125 },
    "visual.guestbookForm": { xPercent: 4, yPercent: 0 },
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.value, {
    "visual.heroPortrait": { xPercent: -6.4, yPercent: 9.13 },
    "visual.guestbookForm": { xPercent: 4, yPercent: 0 },
  });
});

test("accepts safe per-text font styling", () => {
  const result = validateContentLayout({
    aboutBody1: {
      xPercent: 0,
      yPercent: 0,
      fontFamily: "serif",
      fontSize: 19.125,
      color: "#AABBCC",
      fontWeight: 700,
    },
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.value, {
    aboutBody1: {
      xPercent: 0,
      yPercent: 0,
      fontFamily: "serif",
      fontSize: 19.13,
      color: "#aabbcc",
      fontWeight: 700,
    },
  });
});

test("gives original text the same box styling controls", () => {
  const result = validateContentLayout({
    aboutTitleSuffix: {
      xPercent: 2,
      yPercent: -1,
      width: 260.125,
      rotation: -7.555,
      textAlign: "center",
      zIndex: 12,
      hidden: true,
    },
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.value, {
    aboutTitleSuffix: {
      xPercent: 2,
      yPercent: -1,
      width: 260.13,
      rotation: -7.55,
      textAlign: "center",
      zIndex: 12,
      hidden: true,
    },
  });
});

test("clamps positions and removes zero offsets", () => {
  const result = validateContentLayout({
    heroLead: { xPercent: 500, yPercent: -500 },
    siteName: { xPercent: 0, yPercent: 0 },
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.value, {
    heroLead: { xPercent: 100, yPercent: -100 },
  });
});

test("rejects unknown content keys and invalid coordinates", () => {
  assert.equal(
    validateContentLayout({
      adminPassword: { xPercent: 1, yPercent: 1 },
    }).ok,
    false,
  );
  assert.equal(
    validateContentLayout({
      heroGreeting: {
        xPercent: 0,
        yPercent: 0,
        width: 10,
        textAlign: "justify",
        hidden: "yes",
      },
    }).ok,
    false,
  );
  assert.equal(
    validateContentLayout({
      "visual.unknownPanel": { xPercent: 1, yPercent: 1 },
    }).ok,
    false,
  );
  assert.equal(
    validateContentLayout({
      heroGreeting: {
        xPercent: 0,
        yPercent: 0,
        fontFamily: "remote-font",
      },
    }).ok,
    false,
  );
  assert.equal(
    validateContentLayout({
      "visual.heroPortrait": {
        xPercent: 0,
        yPercent: 0,
        color: "#ffffff",
      },
    }).ok,
    false,
  );
  assert.equal(
    validateContentLayout({
      heroGreeting: { xPercent: "not-a-number", yPercent: 1 },
    }).ok,
    false,
  );
  assert.deepEqual(normalizeContentLayout("broken"), {});
});
