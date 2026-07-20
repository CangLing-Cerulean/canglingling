# 沧翎翎的小窝

一个运行在 Cloudflare Workers 上的个人网站，包含由 Cloudflare D1 驱动的访客留言板。

## 已实现

- 响应式个人主页
- 六章节一屏翻页主页，支持按钮、导航、键盘与页面边界滚轮切换
- 首页小龙秘密入口与主页内联编辑模式
- 直接点击主页文字编辑，并实时预览字体、字号和主题颜色
- 在任意主页章节新建自由文本框，支持直接编辑、拖拽定位和删除
- 管理员密码可在主页内修改，旧登录会话会立即失效
- 访客评论与多级回复
- 评论待审核流程
- 私有管理页面 `/admin.html`
- 后台编辑首页主要文字内容
- 后台选择全站字体、基础字号与主题颜色
- 内容和外观设置持久化到 D1，保存后即时生效
- 后台上传轮播图片并在首页横向滑动展示
- 后台上传 Markdown、PDF、Word、TXT、RTF、ODT 笔记
- 访客可为留言上传 JPG、PNG 或 WebP 头像
- 图片、头像和笔记使用 Cloudflare Workers KV 免费存储
- 站内文件总量设为 512MB 硬上限，避免接近 KV 的 1GB 免费额度
- 昵称与评论长度校验
- 隐藏字段反机器人检查
- 基于 IP 单向哈希的提交频率限制
- 可选 Cloudflare Turnstile 人机验证
- 安全响应头与严格 CSP
- GitHub Actions 自动测试、迁移和部署

## 本地开发

```bash
npm install
npx wrangler d1 migrations apply canglingling-comments --local
npm run dev
```

本地首次登录需要在 `.dev.vars` 中设置初始管理员密码和会话签名密钥：

```dotenv
ADMIN_TOKEN=your-local-admin-token
RATE_LIMIT_SALT=your-local-random-value
```

`.dev.vars` 已加入 `.gitignore`，不会提交到 GitHub。

## Cloudflare 资源

首次部署前需要：

1. 创建 D1 数据库 `canglingling-comments`。
2. 创建 Workers KV 命名空间 `canglingling-media`，将命名空间 ID 写入 `wrangler.jsonc`。
3. 将真实 `database_id` 写入 `wrangler.jsonc`。
4. 使用 `wrangler secret put ADMIN_TOKEN` 设置审核口令。
5. 使用 `wrangler secret put RATE_LIMIT_SALT` 设置随机限流盐值。
6. 可选创建 Turnstile Widget，并设置：
   - 普通变量 `TURNSTILE_SITE_KEY`
   - Secret `TURNSTILE_SECRET`
7. 对远程 D1 执行迁移，再部署 Worker。

上传限制：

- 访客头像：JPG、PNG、WebP，最大 1MB
- 轮播图片：JPG、PNG、WebP、GIF，最大 5MB
- 笔记：MD、PDF、DOC、DOCX、TXT、RTF、ODT，最大 10MB

应用内文件总量最多 512MB。Workers KV 免费计划的存储和每日操作都有硬额度；达到 Cloudflare 免费额度时操作会失败，不会自动产生超额费用。请保持 Workers Free，不要启用 Workers Paid 或其他付费产品。

上传接口同时检查扩展名、MIME 类型和常见二进制文件头，不允许 SVG、HTML 或脚本文件。

生产环境的初始管理员密码/会话签名密钥和 Turnstile Secret 只保存在 Cloudflare Secrets 中，不得写入代码仓库。首次使用小龙秘密入口登录后，可以在主页编辑工具中修改管理员密码；新密码仅保存为带随机盐的密钥哈希，修改后旧会话立即失效。

## GitHub 自动部署

仓库需要配置两个 Actions Secrets：

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

推送到 `main` 后，工作流会先运行测试、应用 D1 迁移，再部署 Worker 和静态资源。
