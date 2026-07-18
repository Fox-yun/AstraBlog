<div align="center">

# AstraBlog

**一个面向长文、短动态与读者交流的可复用、自托管博客框架。**

[English](./README.md) · [简体中文](./README.zh-CN.md)

![AstraBlog 社交预览图](./public/og.png)

</div>

AstraBlog 是一个基于 Next.js 16、React 19、Neon PostgreSQL、Drizzle ORM
和 Better Auth 的全栈博客框架。
## 核心能力

| 范畴 | 已包含能力 |
| --- | --- |
| 内容发布 | 长文 Notes、短动态 Chat、自定义页面、草稿、定时发布、版本记录、置顶与精选状态 |
| 内容发现 | 全文检索、分类/标签筛选、分页、RSS、站点地图、robots、Canonical、Open Graph 与 JSON-LD |
| 写作体验 | Markdown 源文、HTML 安全清洗、GFM、Shiki 代码高亮、自动目录与阅读时长 |
| 社区互动 | 注册、邮箱验证、账号资料、嵌套评论、审核、举报与登录后可用的 Guestbook |
| 管理后台 | 角色保护的仪表盘、编辑器、分类标签管理、评论审核和基于 R2 的媒体库 |
| 框架复用 | 集中式站点配置、环境变量品牌化、自定义页面路由、可迁移数据库结构与明确的部署边界 |

## 技术栈

| 层级 | 技术 |
| --- | --- |
| 应用 | Next.js 16 App Router、React 19、TypeScript |
| 样式 | Tailwind CSS 4，以及项目自有的排版规则与设计令牌 |
| 数据 | Neon PostgreSQL、Drizzle ORM、Drizzle Kit |
| 认证 | Better Auth，启用邮箱密码、用户名和管理员插件 |
| 内容处理 | Unified、Remark、Rehype、Shiki |
| 媒体 | 通过 S3 兼容接口访问 Cloudflare R2 |
| 邮件 | Resend；本地开发可使用控制台投递模式 |
| 测试 | Vitest、Playwright |

## 项目结构

```text
src/
├─ actions/               文章、分类标签、评论与用户的 Server Actions
├─ app/
│  ├─ notes/              文章归档与文章详情
│  ├─ categories/         公开分类归档
│  ├─ tags/               公开标签归档
│  ├─ chat/               短动态时间线
│  ├─ guestbook/          登录用户留言墙
│  ├─ studio/             Owner/Admin 内容工作台
│  ├─ account/            会员账号页面
│  ├─ auth/               注册、登录、验证与密码重置
│  ├─ api/                认证、媒体与定时发布接口
│  └─ [slug]/             数据库驱动的公开自定义页面
├─ components/            内容、评论、编辑器、认证和后台组件
├─ config/site.ts         集中式站点身份与导航配置
├─ db/                    数据结构、关系、查询客户端与事务
└─ lib/                   认证、内容查询、Markdown、邮件与 R2 工具

drizzle/                  版本化数据库迁移文件
scripts/                  示例数据、Owner 初始化与媒体维护脚本
tests-e2e/                Playwright 浏览器测试
```

## 环境要求

- Node.js `20.9.0` 或更高版本
- npm
- 用于持久内容和认证的 Neon PostgreSQL 数据库
- 可选：用于生产邮件和媒体存储的 Resend、Cloudflare R2

未配置数据库时，公开站点外壳仍然可以正常渲染。文章归档、认证、评论、
Guestbook 和 Studio 等数据库功能需要 PostgreSQL。

## 快速开始

1. 安装依赖。

   ```bash
   npm install
   ```

2. 创建本地环境变量文件。

   ```powershell
   # PowerShell
   Copy-Item .env.example .env.local
   ```

   ```bash
   # macOS / Linux
   cp .env.example .env.local
   ```

3. 至少在 `.env.local` 中配置以下变量。

   ```dotenv
   NEXT_PUBLIC_SITE_URL=http://localhost:3000
   DATABASE_URL=postgresql://...
   DATABASE_URL_DIRECT=postgresql://...
   BETTER_AUTH_URL=http://localhost:3000
   BETTER_AUTH_SECRET=替换为至少32位的随机密钥
   DEV_EMAIL_MODE=console
   ```

4. 应用数据库结构。

   ```bash
   npm run db:push
   ```

5. 启动开发服务器。

   ```bash
   npm run dev
   ```

6. 打开 `http://localhost:3000`。

## 创建首个 Owner

为了确保账号可以正常登录，请先通过 `/auth/register` 注册。使用
`DEV_EMAIL_MODE=console` 时，邮箱验证链接会输出到服务器终端。

注册完成后，将该账号提升为 Owner：

```bash
npm run owner -- owner@example.com owner_username
```

随后登录并打开 `/studio/dashboard`。该命令会拒绝静默创建第二个 Owner。

`npm run seed` 是可选操作，它会创建可复用的示例分类、标签、文章、评论和
开发身份，适合演示与本地探索，不应代替真实 Owner 的注册流程。

## 环境变量

请以 [`.env.example`](./.env.example) 为起点。

### 站点身份

| 变量 | 是否必需 | 用途 |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | 生产环境必需 | Metadata、RSS、站点地图与 robots 使用的规范站点地址 |
| `NEXT_PUBLIC_SITE_NAME` | 否 | 完整站点名称，默认 `AstraBlog` |
| `NEXT_PUBLIC_SITE_WORDMARK` | 否 | 页头和页脚字标 |
| `NEXT_PUBLIC_SITE_OWNER` | 否 | 对外展示的作者/所有者名称 |
| `NEXT_PUBLIC_SITE_DESCRIPTION` | 否 | 主描述与搜索发现文案 |
| `NEXT_PUBLIC_SITE_DESCRIPTION_ZH` | 否 | 首页第二语言描述 |
| `NEXT_PUBLIC_SITE_LOCALE` | 否 | HTML 和日期区域设置 |
| `NEXT_PUBLIC_SITE_LANGUAGE` | 否 | RSS 语言字段 |
| `NEXT_PUBLIC_POSTS_PER_PAGE` | 否 | 归档分页数量，默认 `12` |
| `NEXT_PUBLIC_CONTACT_EMAIL` | 否 | 公开联系邮箱；留空时不展示 |
| `NEXT_PUBLIC_GITHUB_URL` | 否 | 公开 GitHub 主页 |
| `NEXT_PUBLIC_X_URL` | 否 | 公开 X/Twitter 主页 |

### 数据库与认证

| 变量 | 是否必需 | 用途 |
| --- | --- | --- |
| `DATABASE_URL` | 是 | Neon Serverless 运行时连接 |
| `DATABASE_URL_DIRECT` | 是 | Drizzle Kit 使用的直连地址 |
| `BETTER_AUTH_URL` | 是 | 对外认证地址 |
| `BETTER_AUTH_SECRET` | 是 | 会话与认证签名密钥 |

### 邮件、媒体与自动发布

| 变量 | 是否必需 | 用途 |
| --- | --- | --- |
| `DEV_EMAIL_MODE` | 本地环境 | 设置为 `console` 后在终端输出验证/重置链接 |
| `RESEND_API_KEY` | 可选 | 启用真实事务邮件 |
| `EMAIL_FROM` | 可选 | 已验证的发件人身份 |
| `R2_ACCOUNT_ID` | 媒体功能 | Cloudflare 账号标识 |
| `R2_ACCESS_KEY_ID` | 媒体功能 | R2 的 S3 兼容访问密钥 |
| `R2_SECRET_ACCESS_KEY` | 媒体功能 | R2 的 S3 兼容密钥 |
| `R2_BUCKET` | 媒体功能 | R2 Bucket 名称 |
| `R2_PUBLIC_BASE_URL` | 媒体功能 | Markdown 图片地址使用的公开资源域名 |
| `CRON_SECRET` | 定时发布 | 保护定时发布接口的 Bearer Token |

## 内容与路由

### 公开路由

| 路由 | 用途 |
| --- | --- |
| `/` | 可配置首页/索引 |
| `/notes` | 支持搜索、筛选和分页的文章归档 |
| `/notes/[slug]` | 包含目录、Metadata、标签与评论的长文详情 |
| `/categories/[slug]` | 分类归档 |
| `/tags/[slug]` | 标签归档 |
| `/chat` | 短动态时间线 |
| `/guestbook` | 登录用户留言墙 |
| `/about` | 可配置的关于与联系页面 |
| `/[slug]` | 在 Studio 创建并发布的自定义页面 |
| `/feed.xml` | RSS 2.0 Feed |
| `/sitemap.xml` | 静态与数据库内容的站点地图 |

### Studio 路由

| 路由 | 用途 |
| --- | --- |
| `/studio/dashboard` | 内容工作台概览 |
| `/studio/notes` | 全部内容记录 |
| `/studio/chat` | Chat 动态管理 |
| `/studio/pages` | 自定义页面管理 |
| `/studio/categories` | 分类管理 |
| `/studio/tags` | 标签管理 |
| `/studio/media` | R2 图片上传与 Markdown 引用复制 |
| `/studio/comments` | 评论审核 |

自定义页面不能占用框架路由。保留的顶级 Slug 包括 `notes`、`chat`、
`guestbook`、`about`、`studio`、`account`、`auth`、`api`、`categories`
和 `tags`。

## 内容发布流程

1. 在 Studio 中创建分类和标签。
2. 创建 Note、Chat 动态或自定义页面。
3. 使用 Markdown 编辑，并查看经过安全清洗的实时预览。
4. 草稿通过乐观版本检查自动保存。
5. 立即发布，或选择计划发布时间。

如需定时发布，请让托管平台的调度器调用：

```http
GET /api/cron/publish
Authorization: Bearer <CRON_SECRET>
```

未配置 `CRON_SECRET` 时，该接口会主动拒绝执行。

## 媒体上传

配置全部 `R2_*` 变量后即可启用 Studio 媒体上传。Bucket 的 CORS 策略需要
允许站点域名发起浏览器 `PUT` 请求，并允许 `image/jpeg`、`image/png`、
`image/webp` 和 `image/avif` 内容类型。

当前内容图片上限为 10 MB，头像上限为 2 MB。Studio 会在媒体记录进入
Ready 状态前检查存储对象是否真实存在。

## 在不改变视觉体系的前提下复用

- 通过 `.env.local` 修改公开站点身份。
- 在 `src/config/site.ts` 修改导航和页脚技术标签。
- 在 `src/app/globals.css` 顶部修改颜色与字体设计令牌。
- 修改字标或主描述后，用 `1.91:1` 横版图片替换 `public/og.png`。

默认美术方向已经封装为可复用的设计令牌和内容排版组件，因此更换品牌不需要
重写页面组件。

## 数据库工作流

本地快速迭代：

```bash
npm run db:push
```

生产环境使用经过审阅的迁移：

```bash
npm run db:generate
npm run db:migrate
```

应用到生产数据库之前，请检查 `drizzle/` 下生成的 SQL。

## 可用命令

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | 启动开发服务器 |
| `npm run build` | 生成 Next.js 生产构建 |
| `npm start` | 启动生产服务器 |
| `npm run typecheck` | 运行 TypeScript 类型检查，不生成文件 |
| `npm run lint` | 使用 Biome 检查仓库 |
| `npm run format` | 使用 Biome 格式化支持的文件 |
| `npm test` | 运行一次 Vitest 测试 |
| `npm run test:e2e` | 运行 Playwright 端到端测试 |
| `npm run db:push` | 开发阶段推送当前数据库结构 |
| `npm run db:generate` | 生成待审阅的数据库迁移 |
| `npm run db:migrate` | 应用已生成迁移 |
| `npm run db:studio` | 打开 Drizzle Studio |
| `npm run seed` | 创建可复用示例数据 |
| `npm run owner -- <邮箱> <用户名>` | 创建或提升唯一 Owner |

## 验证

部署前运行完整质量检查：

```bash
npm run typecheck
npm test
npm run lint
npm run build
```

Playwright 测试需要已经配置并运行的测试环境：

```bash
npm run test:e2e
```

## 部署

AstraBlog 当前生成标准的 Next.js Node.js 输出。请选择支持 Next.js Server
Runtime 的托管平台，在平台中配置同一组环境变量，应用数据库迁移，并按需要
设置定时发布请求。

部署到 Vercel 时，仓库中的 `vercel.json` 会在每天 UTC 00:00 调用一次
`/api/cron/publish`，兼容 Hobby 套餐的调度限制。付费套餐可以按需提高执行
频率。在 Vercel 项目中设置 `CRON_SECRET` 后，平台会自动以 Bearer Token
形式把它发送给该接口。

仓库当前不包含 `.openai/hosting.json` 或 Cloudflare Worker 兼容的服务器
Bundle。部署到仅支持 Workers 的平台前需要添加适配器，不能直接把标准
`.next` 输出视为 Worker 部署产物。

## 安全说明

- 公开 Markdown 在渲染已存储 HTML 前会经过安全清洗。
- Studio 写操作会在服务端检查已验证、状态正常的 Owner/Admin 会话。
- 评论操作会检查邮箱验证、审核状态与资源所有权。
- 媒体接口会检查角色、MIME 类型、文件大小、资源所有权和存储对象是否存在。
- 定时发布必须提供 `CRON_SECRET`，缺少密钥时拒绝运行。
- 不要提交 `.env.local`、数据库地址、认证密钥、Resend Key、R2 凭据或生成的
  仓库访问凭据。
