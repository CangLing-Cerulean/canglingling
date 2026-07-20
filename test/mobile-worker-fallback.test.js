import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("serves a cache-safe mobile paging fallback until new assets are live", async () => {
  const worker = await readFile(
    new URL("../src/worker.js", import.meta.url),
    "utf8",
  );

  assert.match(worker, /url\.pathname === "\/app\.js"/);
  assert.match(worker, /script\.includes\("pageTouchGesture"\)/);
  assert.match(worker, /__canglingMobilePaging/);
  assert.match(worker, /headers\.set\("cache-control", "no-store"\)/);
});
