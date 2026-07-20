import test from "node:test";
import assert from "node:assert/strict";
import {
  createAdminSession,
  hashAdminPassword,
  passwordMatches,
  validateNewPassword,
  verifyAdminSession,
} from "../src/admin-auth.js";

test("accepts administrator passwords without a length limit", () => {
  assert.equal(validateNewPassword("dragon2026blue").ok, true);
  assert.equal(validateNewPassword("1").ok, true);
  assert.equal(validateNewPassword("x".repeat(1000)).ok, true);
  assert.equal(validateNewPassword("一条很长而且容易记住的小龙密码").ok, true);
  assert.equal(validateNewPassword("").ok, false);
});

test("hashes passwords with the deployment secret and salt", async () => {
  const hash = await hashAdminPassword("secret", "salt-a", "dragon2026");
  assert.equal(
    await passwordMatches("secret", "salt-a", "dragon2026", hash),
    true,
  );
  assert.equal(
    await passwordMatches("secret", "salt-a", "wrong-password", hash),
    false,
  );
});

test("creates expiring and versioned administrator sessions", async () => {
  const now = 1_800_000_000_000;
  const token = await createAdminSession("secret", 4, now);
  assert.equal(await verifyAdminSession("secret", token, 4, now + 1000), true);
  assert.equal(await verifyAdminSession("secret", token, 5, now + 1000), false);
  assert.equal(
    await verifyAdminSession("secret", token, 4, now + 13 * 60 * 60 * 1000),
    false,
  );
});
