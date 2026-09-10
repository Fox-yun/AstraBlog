# AstraBlog

一个把长文、短动态、读者交流和个人酒谱放在一起的博客项目，使用同一套 Next.js 应用、数据库与管理后台。

[English](./README.md) · [简体中文](./README.zh-CN.md) · [酒单实施与上线说明](./docs/bar.md)

![AstraBlog 预览](./public/og.png)

## 已有功能

| 模块 | 功能 |
| --- | --- |
| 内容发布 | 文章、短动态、自定义页面、Markdown 编辑、安全预览、图片插入、草稿、定时发布与修订记录 |
| 内容检索 | 归档搜索、分类、标签、分页、RSS、站点地图与社交分享元数据 |
| 读者交流 | 注册登录、邮箱验证、个人资料、嵌套评论、审核与留言板 |
| 酒单 Bar | 按现有材料筛选酒谱、搜索、用量与步骤、收藏和浏览器偏好记忆 |
| Studio 后台 | 内容工作台、媒体库、评论管理，以及仅 Owner 可用的酒谱、材料与类型标签管理 |

首页提供 Notes、Chat、Bar、Guestbook、About 五个索引入口。页面沿用深色背景、衬线标题、细边框与琥珀色强调。

## 技术栈与运行环境

- Next.js 16.2.10、React 19.2.4、TypeScript
- Tailwind CSS 4；酒谱表单使用 React Hook Form 与 Zod
- Neon PostgreSQL、Drizzle ORM、版本化 SQL 迁移
- Better Auth，复用 member / admin / owner 角色
- Cloudflare R2 存储博客图片，Resend 发送邮件
- Vitest 与 Playwright 自动化测试

开发环境使用 Node.js 22.x 或 24.x，以及 npm。内容持久化、认证和 Studio 需要 Neon 数据库。未配置 `DATABASE_URL` 时可以查看公开页面的空状态，但不代表站点已经完整初始化。

## 快速开始

### 1. 安装项目

```sh
git clone https://github.com/Fox-yun/AstraBlog.git
cd AstraBlog
npm ci
```

将 [`.env.example`](./.env.example) 复制为 `.env.local`：

```sh
# macOS / Linux
cp .env.example .env.local
```

```powershell
# PowerShell
Copy-Item .env.example .env.local
```

### 2. 配置环境变量

填写 Neon 数据库的运行时与迁移连接：

```dotenv
NEXT_PUBLIC_SITE_URL=http://localhost:3000
DATABASE_URL=postgresql://your-neon-runtime-connection
DATABASE_URL_DIRECT=postgresql://your-neon-migration-connection
BETTER_AUTH_URL=http://localhost:3000
BETTER_AUTH_SECRET=replace-with-a-random-secret-of-at-least-32-characters
DEV_EMAIL_MODE=console
```

可以使用以下命令在本地生成随机密钥：

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

数据库连接和密钥放在环境变量中，不提交到 Git。

### 3. 初始化数据库

对于全新的空数据库，执行仓库中已提交的迁移：

```sh
node --env-file=.env.local node_modules/drizzle-kit/bin.cjs migrate
```

Next.js 会为应用加载 `.env.local`，但当前 Drizzle 配置直接读取进程环境变量。上面的命令会显式加载该文件；如果变量已经导入终端环境，也可以运行 `npm run db:migrate`。

**酒单初始化必须使用迁移，不能仅执行 `db:push`。** 初始类型标签、冰水系统材料、材料身份保护触发器和路由冲突检查都在 SQL 迁移中。

已有站点升级前，先备份数据库并核对迁移历史。如果曾使用 `db:push` 建表，需要先对齐迁移基线，不能直接对已有表重放初始迁移。酒单迁移也会检查是否有自定义页面占用 `/bar`，发现冲突时停止，需先重命名旧页面。详见[迁移说明](./docs/bar.md)。

### 4. 启动站点并设置 Owner

```sh
npm run dev
```

打开 [localhost:3000](http://localhost:3000)，访问 `/auth/register` 注册账号并完成邮箱验证。控制台邮件模式下，验证链接会打印在服务端终端中。

用已注册账号的邮箱和资料用户名设置 Owner：

```sh
node --env-file=.env.local --import tsx scripts/create-owner.ts owner@example.com owner_username
```

重新登录后进入 `/studio/dashboard` 或 `/studio/bar`。请先通过注册流程建立密码凭据；Owner 脚本不会创建登录密码，也不会静默引入另一个不同的 Owner。

`npm run seed` 会生成博客示例内容和开发身份，仅适合可丢弃的开发数据库，不用于初始化真实 Owner，也不会填充酒谱。

## 个人酒单

公开页面 `/bar` 一次读取已发布酒谱及其引用材料。此后选择材料、搜索、切换视图、收藏和查看详情均在浏览器完成。

| 操作或规则 | 说明 |
| --- | --- |
| 选择材料 | 表示“我拥有这些”，不要求配方使用全部已选材料 |
| 筛选视图 | 材料齐全、最多缺一种、全部酒谱 |
| 缺料判断 | 按固定材料 ID 去重；可选装饰不计入缺料 |
| 冰与普通饮用水 | 固定视为已有，没有标签或开关，不计入已选数量 |
| 苏打水与汤力水 | 属于普通材料，需要手动选择 |
| 搜索 | 支持中英文酒名、酒名别名、材料名称和别名；每个关键词都需要命中 |
| 详情 | 原料与用量、有序步骤、杯型、用冰、制作方式、公开说明与来源 |
| 本地偏好 | 已选材料、收藏和筛选视图保存在当前浏览器 |

材料类型标签由后台管理，不写死在前端。初始标签为 **金酒、朗姆、威士忌、伏特加、龙舌兰、白兰地、利口酒、味美思、苦精、果汁、水果、糖浆、汽水、乳制品、其他**。Owner 可以新增、改名、调整顺序和删除标签。删除前需要先将其中的材料移到其他类型；切换类型不会清除其他类型中已选的材料。

录入并发布一份酒谱：

1. 在 `/studio/bar/categories` 管理类型标签，在 `/studio/bar/ingredients` 管理材料。
2. 进入 `/studio/bar/new` 新建配方，填写材料、数值或文字用量、有序步骤。字典中缺少的材料可以直接在编辑器里创建。
3. 内容未完成时保存草稿；补齐必需字段后发布。
4. 在 `/bar` 中通过现有材料和搜索找到酒谱。

已发布配方通过 **“更新线上配方”** 直接更新。试验新比例时先复制为草稿；下架进入归档，归档恢复后仍是草稿。保存时原子检查修订号，旧版本无法覆盖新内容，酒谱主体与配料写入一起提交或回滚。

私人备注仅出现在 Owner 编辑、后台预览与完整备份中。JSON 导出包含类型标签、材料、酒谱、配料明细和私人备注，请私下保管；不生成公开下载地址，V1 暂不提供恢复导入界面。

V1 不管理剩余库存、不自动替换材料、不跨设备同步偏好，也不新增酒谱图片上传。“材料齐全”仅判断种类，不判断用量、杯子或工具是否足够。迁移只初始化字典，不插入示例酒谱，因此发布第一份配方前酒单为空。

四张业务表、校验规则、备份格式与集成测试详见[酒单文档](./docs/bar.md)。

## 页面与权限

| 路由 | 用途 | 访问范围 |
| --- | --- | --- |
| `/` | 首页索引 | 公开 |
| `/notes`、`/notes/[slug]` | 文章归档与详情 | 已发布内容 |
| `/chat`、`/about`、`/[slug]` | 短动态、关于页、自定义页面 | 已发布内容 |
| `/categories/[slug]`、`/tags/[slug]` | 博客分类与标签归档 | 公开 |
| `/bar` | 调酒工具页 | 已发布酒谱 |
| `/guestbook` | 留言板 | 公开阅读，登录后留言 |
| `/account/profile` | 个人资料 | 当前登录账号 |
| `/studio/dashboard`、`/studio/notes`、`/studio/chat`、`/studio/pages` | 内容工作台 | Admin / Owner |
| `/studio/categories`、`/studio/tags`、`/studio/media`、`/studio/comments` | 博客管理 | Admin / Owner，部分操作仅 Owner 可用 |
| `/studio/bar`、`/studio/bar/new`、`/studio/bar/[id]/edit` | 酒谱管理 | 仅 Owner |
| `/studio/bar/ingredients`、`/studio/bar/categories` | 材料与类型标签 | 仅 Owner |
| `/feed.xml`、`/sitemap.xml`、`/robots.txt` | 内容发现 | 公开 |

酒单管理查询、每项写入和完整导出均独立验证 Owner 会话。公开查询采用字段白名单，不包含私人备注、草稿，以及仅被草稿引用的材料与类型。

博客分类/标签和酒单材料类型是独立字典。自定义页面的保留路由名称（包括 `bar`）定义在 [site.ts](./src/config/site.ts)。

## 配置与个性化

完整变量模板见 [`.env.example`](./.env.example)。

| 环境变量 | 用途 |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL`、`BETTER_AUTH_URL` | 部署后的站点与认证地址 |
| `DATABASE_URL`、`DATABASE_URL_DIRECT`、`BETTER_AUTH_SECRET` | 运行时/迁移连接与私有认证密钥 |
| `NEXT_PUBLIC_SITE_NAME`、`NEXT_PUBLIC_SITE_WORDMARK`、`NEXT_PUBLIC_SITE_OWNER` | 站点身份 |
| `NEXT_PUBLIC_SITE_DESCRIPTION` | 元数据中的站点描述 |
| `NEXT_PUBLIC_SITE_LOCALE`、`NEXT_PUBLIC_SITE_LANGUAGE`、`NEXT_PUBLIC_POSTS_PER_PAGE` | 页面区域、RSS 语言和分页大小 |
| `NEXT_PUBLIC_CONTACT_EMAIL`、`NEXT_PUBLIC_GITHUB_URL`、`NEXT_PUBLIC_X_URL` | 可选的公开联系信息 |
| `DEV_EMAIL_MODE`、`RESEND_API_KEY`、`EMAIL_FROM` | 本地控制台邮件或 Resend 投递 |
| `R2_ACCOUNT_ID`、`R2_ACCESS_KEY_ID`、`R2_SECRET_ACCESS_KEY`、`R2_BUCKET`、`R2_PUBLIC_BASE_URL` | 博客图片存储和公开资源地址 |
| `CRON_SECRET` | 定时发布接口的 Bearer 密钥 |

需要真实邮件投递时，配置 Resend 与已验证发件人，并移除 `DEV_EMAIL_MODE=console`。没有 API Key 时，邮件链接会写入日志而非投递。

使用媒体上传时，配置全部 `R2_*` 变量，并允许站点来源向存储桶发送浏览器 `PUT` 请求。支持 JPEG、PNG、WebP、AVIF；内容图片上限为 10 MB，头像为 2 MB。

导航与首页索引在 [src/config/site.ts](./src/config/site.ts) 中配置，颜色与排版规则在 [src/app/globals.css](./src/app/globals.css) 中维护。

## 开发与验证

| 命令 | 用途 |
| --- | --- |
| `npm run dev` | 启动开发服务 |
| `npm run build` / `npm start` | 构建 / 运行生产服务 |
| `npm run typecheck` | TypeScript 检查 |
| `npm test` | Vitest 测试 |
| `npm run test:e2e` | Playwright 测试，需要 `localhost:3000` 上运行站点 |
| `npm run db:generate` | 数据结构变更后生成 SQL，执行前需审阅 |
| `npm run db:migrate` | 应用已提交迁移，前提是连接变量已导入进程环境 |
| `npm run db:studio` | 打开数据库浏览工具 |
| `npm run owner -- <email> <username>` | 提升已注册账号为 Owner |
| `npm run seed` | 写入可选博客演示数据 |

部署前运行类型检查、Vitest 和生产构建。执行浏览器测试前，先通过 `npx playwright install chromium` 安装 Chromium，在另一个终端启动 `npm run dev`，再运行 `npm run test:e2e`。

酒单 PostgreSQL 集成测试为可选套件：设置 `BAR_TEST_PGLITE_MODULE` 后使用隔离的 PGlite 引擎执行，否则明确标记跳过。[测试说明](./docs/bar.md#验证) 包含安装方式、覆盖范围和限制。浏览器编辑器测试使用动作桩，仍需在测试环境验证真实认证与数据库事务。

仓库原有 `lint` / `format` 脚本目前引用的是 `biome` 包，而不是 `@biomejs/biome`，暂不能作为有效的 Biome 验收命令；项目另有 ESLint 配置。

## 部署

1. 备份数据库，在测试环境验证迁移。应先应用酒单迁移，再启动查询新表的代码。
2. 配置支持 Next.js Node.js 运行时的部署环境，填写数据库、站点地址、认证密钥，以及所需邮件和媒体服务。
3. 运行 `npm ci`、`npm run build`，再通过 `npm start` 或部署平台的 Next.js 集成启动。当前字体配置会在构建时下载 Google Fonts，构建环境需要能够访问相应服务。
4. 验证目标数据库上的公开页面、登录、内容发布和 Owner 专属酒单操作。
5. 需要定时发布文章时，配置带认证信息的请求：

   ```http
   GET /api/cron/publish
   Authorization: Bearer <CRON_SECRET>
   ```

仓库中的 [vercel.json](./vercel.json) 将该接口设为每天 `00:00 UTC` 执行。密钥缺失或不匹配时拒绝请求；其他部署环境需要自行配置定时任务。

项目是常规 Next.js 服务端应用，不是纯静态导出；`.next` 目录也不是 Cloudflare Worker 部署包。酒谱 JSON 导出不能代替数据库备份。

## 目录索引

```text
src/app/                 公开页面、账号认证与 Studio 路由
src/actions/             服务端写入与权限检查
src/components/bar/      酒谱浏览、编辑器与材料/标签管理界面
src/lib/bar/             匹配、校验、本地偏好与酒单查询
src/db/schema/bar.ts     酒谱、材料、配料明细与类型标签
src/db/                  公共数据结构、关系、查询与事务
src/config/site.ts       站点身份、导航与保留 Slug
drizzle/                 已提交迁移和结构快照
docs/bar.md              酒单初始化、行为约定与集成测试说明
scripts/                 Owner 设置、演示数据与媒体维护
tests-e2e/               浏览器交互与样式回归测试
```
