import test from "node:test";
import assert from "node:assert/strict";
import {
  validateComment,
  validateModerationAction,
  validatePage,
} from "../src/validation.js";

test("accepts a valid comment", () => {
  const result = validateComment({
    author: "路过的小龙",
    content: "你好呀！",
    page: "/",
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.author, "路过的小龙");
});

test("rejects empty and oversized comments", () => {
  assert.equal(validateComment({ author: "", content: "" }).ok, false);
  assert.equal(
    validateComment({ author: "A", content: "x".repeat(601) }).ok,
    false,
  );
});

test("rejects honeypot submissions", () => {
  const result = validateComment({
    author: "bot",
    content: "spam",
    website: "https://spam.invalid",
  });
  assert.equal(result.ok, false);
});

test("validates page and moderation values", () => {
  assert.equal(validatePage("/notes/hello"), "/notes/hello");
  assert.equal(validatePage("javascript:alert(1)"), null);
  assert.equal(validateModerationAction("approve"), "approve");
  assert.equal(validateModerationAction("unknown"), null);
});
