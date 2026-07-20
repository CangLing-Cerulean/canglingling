const AUTHOR_MAX = 24;
const CONTENT_MAX = 600;
const PAGE_MAX = 180;

export function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function validateComment(input) {
  const author = normalizeText(input?.author);
  const content = normalizeText(input?.content);
  const page = normalizeText(input?.page) || "/";
  const parentId = normalizeText(input?.parentId) || null;
  const website = normalizeText(input?.website);

  const errors = [];

  if (website) errors.push("提交内容无效");
  if (!author) errors.push("请填写昵称");
  if (author.length > AUTHOR_MAX) errors.push(`昵称不能超过 ${AUTHOR_MAX} 个字符`);
  if (!content) errors.push("请填写评论内容");
  if (content.length > CONTENT_MAX) errors.push(`评论不能超过 ${CONTENT_MAX} 个字符`);
  if (!page.startsWith("/") || page.length > PAGE_MAX) errors.push("页面地址无效");
  if (parentId && !/^[0-9a-f-]{36}$/i.test(parentId)) errors.push("回复目标无效");

  return {
    ok: errors.length === 0,
    errors,
    value: { author, content, page, parentId },
  };
}

export function validatePage(value) {
  const page = normalizeText(value) || "/";
  return page.startsWith("/") && page.length <= PAGE_MAX ? page : null;
}

export function validateModerationAction(value) {
  return ["approve", "reject", "delete"].includes(value) ? value : null;
}

export const limits = {
  author: AUTHOR_MAX,
  content: CONTENT_MAX,
};
