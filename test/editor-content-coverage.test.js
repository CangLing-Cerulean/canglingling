import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { defaultContent } from "../src/site-settings.js";

test("maps every stored text field to one editable page element", async () => {
  const html = await readFile(
    new URL("../public/index.html", import.meta.url),
    "utf8",
  );
  const mappedKeys = [
    ...html.matchAll(/\sdata-content="([a-zA-Z0-9]+)"/g),
  ].map((match) => match[1]);
  const uniqueMappedKeys = new Set(mappedKeys);

  assert.equal(
    mappedKeys.length,
    uniqueMappedKeys.size,
    "each editable content key should appear exactly once",
  );
  assert.deepEqual(
    [...uniqueMappedKeys].sort(),
    Object.keys(defaultContent).sort(),
    "stored text fields and editable page elements must stay in sync",
  );
});

test("keeps reported punctuation and the portrait directly editable", async () => {
  const html = await readFile(
    new URL("../public/index.html", import.meta.url),
    "utf8",
  );

  assert.match(html, /data-content="heroEnding">。<\/span>/);
  assert.match(html, /data-content="aboutTitleSuffix">的小窝。<\/span>/);
  assert.match(
    html,
    /data-visual="heroAvatarPhoto" data-visual-label="首页头像图片"/,
  );
});
