import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const readPublicFile = (name) =>
  readFile(new URL(`../public/${name}`, import.meta.url), "utf8");

test("keeps the visitor message form behind a separate entry", async () => {
  const html = await readPublicFile("index.html");
  const dialogStart = html.indexOf('id="comment-dialog"');
  const formStart = html.indexOf('id="comment-form"', dialogStart);
  const dialogEnd = html.indexOf("</dialog>", formStart);

  assert.match(html, /id="open-comment-form"/);
  assert.ok(dialogStart >= 0);
  assert.ok(formStart > dialogStart);
  assert.ok(dialogEnd > formStart);
});

test("uses the supplied dragon art for the brand and administrator surfaces", async () => {
  const html = await readPublicFile("index.html");
  assert.equal(
    [...html.matchAll(/src="\/dragon-secret\.png"/g)].length,
    3,
  );
  assert.match(
    html,
    /class="brand-mark"[\s\S]*?<img src="\/dragon-secret\.png"/,
  );
});

test("places gallery names last at the bottom of each image", async () => {
  const [script, styles] = await Promise.all([
    readPublicFile("app.js"),
    readPublicFile("styles.css"),
  ]);
  assert.ok(
    script.indexOf("caption.append(description)") <
      script.indexOf("caption.append(title)"),
  );

  const captionRule = styles.slice(
    styles.indexOf(".carousel-caption {"),
    styles.indexOf(".carousel-caption strong"),
  );
  assert.match(captionRule, /bottom:\s*0/);
  assert.match(captionRule, /width:\s*100%/);
});

test("shows complete gallery images over a blurred image extension", async () => {
  const [script, styles] = await Promise.all([
    readPublicFile("app.js"),
    readPublicFile("styles.css"),
  ]);

  assert.match(script, /backdrop\.className = "carousel-backdrop"/);
  assert.match(script, /figure\.append\(backdrop, image, caption\)/);

  const imageRule = styles.slice(
    styles.indexOf(".carousel-slide .carousel-image {"),
    styles.indexOf(".carousel-caption {"),
  );
  assert.match(imageRule, /object-fit:\s*contain/);
  assert.match(imageRule, /inset:\s*16px/);

  const backdropRule = styles.slice(
    styles.indexOf(".carousel-slide .carousel-backdrop {"),
    styles.indexOf(".carousel-slide .carousel-image {"),
  );
  assert.match(backdropRule, /object-fit:\s*cover/);
  assert.match(backdropRule, /filter:\s*blur\(30px\)/);
});

test("uses the shared light theme on the fourth page", async () => {
  const styles = await readPublicFile("styles.css");
  const nowRule = styles.slice(
    styles.indexOf(".now-section {"),
    styles.indexOf(".label-light"),
  );
  assert.match(nowRule, /var\(--paper\)/);
  assert.doesNotMatch(nowRule, /#16243e/);
});

test("keeps the page centered without a separate paging control", async () => {
  const [html, script, styles] = await Promise.all([
    readPublicFile("index.html"),
    readPublicFile("app.js"),
    readPublicFile("styles.css"),
  ]);

  assert.doesNotMatch(html, /class="page-controls"/);
  assert.doesNotMatch(script, /pagePrevious|pageNext|pageCurrent|pageTotal/);
  assert.doesNotMatch(styles, /\.page-controls/);
  assert.match(
    styles,
    /\.page-body \.site-header \{[\s\S]*?left:\s*50%[\s\S]*?translateX\(-50%\)/,
  );
  assert.match(
    styles,
    /\.site-page\.shell \{[\s\S]*?left:\s*50%[\s\S]*?translate:\s*-50% 0/,
  );
  assert.match(styles, /scrollbar-gutter:\s*stable both-edges/);
  assert.match(
    styles,
    /html \{[\s\S]*?overflow-x:\s*clip/,
    "the root page must not retain a hidden horizontal scroll range",
  );
  assert.match(
    styles,
    /\.page-body \{[\s\S]*?overflow:\s*clip/,
    "page navigation must not shift toward off-screen decoration",
  );
  assert.match(
    script,
    /function resetHorizontalViewport\(\)[\s\S]*?window\.scrollTo\(0, window\.scrollY\)/,
    "every page must recover from a browser-restored horizontal offset",
  );
  assert.match(
    script,
    /window\.addEventListener\("scroll", resetHorizontalViewport/,
    "the shared page deck must stay centered on every chapter",
  );
});

test("lets touch devices swipe through every page without visible paging keys", async () => {
  const [html, script] = await Promise.all([
    readPublicFile("index.html"),
    readPublicFile("app.js"),
  ]);

  assert.doesNotMatch(html, /class="page-controls"/);
  assert.match(script, /"touchstart"/);
  assert.match(script, /"touchend"/);
  assert.match(script, /gesture\.startedAtBottom/);
  assert.match(script, /gesture\.startedAtTop/);
  assert.match(
    script,
    /goToPage\(currentPageIndex \+ \(goingDown \? 1 : -1\)\)/,
  );
});
