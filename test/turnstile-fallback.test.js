import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canUseModeratedTurnstileFallback } from "../src/validation.js";

test("allows a Turnstile fallback only when comments require moderation", () => {
  assert.equal(canUseModeratedTurnstileFallback("required"), true);
  assert.equal(canUseModeratedTurnstileFallback(undefined), true);
  assert.equal(canUseModeratedTurnstileFallback("disabled"), false);
});

test("hides a failed widget and explains the moderated fallback", async () => {
  const appSource = await readFile(new URL("../public/app.js", import.meta.url), "utf8");

  assert.match(appSource, /"error-callback"/);
  assert.match(appSource, /elements\.turnstile\.hidden = true/);
  assert.match(appSource, /留言会进入人工审核/);
});
