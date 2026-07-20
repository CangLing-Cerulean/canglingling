import test from "node:test";
import assert from "node:assert/strict";
import {
  defaultContent,
  defaultTheme,
  mergeSettings,
  toPublicSettings,
  validateSettings,
} from "../src/site-settings.js";

test("merges defaults with stored site settings", () => {
  const settings = mergeSettings({
    content: { heroName: "新名字" },
    theme: { fontFamily: "serif", baseFontSize: 18 },
  });

  assert.equal(settings.content.heroName, "新名字");
  assert.equal(settings.content.aboutBody1, defaultContent.aboutBody1);
  assert.equal(settings.theme.fontFamily, "serif");
  assert.equal(settings.theme.baseFontSize, 18);
  assert.equal(settings.theme.primaryColor, defaultTheme.primaryColor);
});

test("rejects unsafe or out-of-range theme settings", () => {
  const invalid = validateSettings({
    content: { ...defaultContent },
    theme: {
      ...defaultTheme,
      fontFamily: "url(https://invalid.example/font)",
      baseFontSize: 50,
    },
  });
  assert.equal(invalid.ok, false);
});

test("rejects unknown fields and oversized content", () => {
  assert.equal(
    validateSettings({
      content: { ...defaultContent, script: "<script>alert(1)</script>" },
      theme: { ...defaultTheme },
    }).ok,
    false,
  );
  assert.equal(
    validateSettings({
      content: { ...defaultContent, heroName: "x".repeat(161) },
      theme: { ...defaultTheme },
    }).ok,
    false,
  );
});

test("returns an allowlisted public font stack", () => {
  const settings = toPublicSettings({
    content: defaultContent,
    theme: { ...defaultTheme, fontFamily: "mono" },
  });
  assert.match(settings.theme.fontStack, /monospace/);
});
