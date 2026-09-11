# 酒单模块 V1

公开工具位于 `/bar`，Owner 在 `/studio/bar` 维护酒谱，在 `/studio/bar/ingredients` 维护材料，在 `/studio/bar/categories` 管理材料类型标签。

材料类型不是固定枚举。迁移初始化金酒、朗姆、威士忌、伏特加、龙舌兰、白兰地、利口酒、味美思、苦精、果汁、水果、糖浆、汽水、乳制品、其他，可在后台增删、改名、调整展示顺序。每种材料归入一个类型，被材料引用的类型不能直接删除，需先移走材料。切换类型仅改变材料标签的展示，不清空其他类型中的选择。

数据库新增 `bar_ingredient_categories`、`bar_ingredients`、`bar_recipes` 和 `bar_recipe_ingredients` 四张表。相比原始三表方案，增加材料类型表是为了支持后台管理标签。

## 初始化与部署

1. 先备份生产数据库。在独立测试数据库配置 `DATABASE_URL`（应用与事务连接）和 `DATABASE_URL_DIRECT`（Drizzle 迁移连接）。沿用项目原有认证配置。
2. 审阅新增的 `drizzle/0001_bar_catalog.sql`。原迁移未修改。迁移会检查是否有首段 Slug 为 `bar` 的自定义页面，包含草稿和归档；有冲突则报 `BAR_ROUTE_CONFLICT`，必须先重命名旧页面。可提前只读检查：

   ```sql
   SELECT id, title, slug, status FROM posts
   WHERE type = 'page' AND lower(split_part(slug::text, '/', 1)) = 'bar';
   ```

3. 在测试环境执行仓库原有的 `npm run db:migrate`，验证录入、发布、筛选、并发编辑和下架流程，再在生产按同样顺序迁移、部署。Drizzle 从环境变量读取连接；运行脚本前须将配置载入进程环境。
4. 迁移初始化 `ice`、`water` 系统材料和具体类型标签。只初始化字典，不填充示例酒谱。不要用 `db:push` 替代迁移：身份保护触发器、路由冲突检查、系统种子数据都在 SQL 迁移中。

当前没有数据库配置时，公开页与博客现有模式一致显示空酒单。未连接数据库不代表迁移或后台完整流程已经在目标环境验收。

## 行为约定

- 冰和普通饮用水按固定 `code` 默认具备，不出现在材料标签和已选数量中。苏打水、汤力水仍需选择。配方的用量、冰型和制作步骤正常显示。
- 匹配对必需材料 ID 去重，可选材料不参与缺料计算；数量、杯子和工具不参与匹配。
- 公开查询使用一次 SQL 联表及字段白名单，仅返回已发布酒谱及其引用的材料、类型；草稿专用的材料和类型不会泄露，私人备注及管理字段不被读取到公开结果中。
- 私有查询、每项 Server Action、批量导入和完整导出均独立调用原有 `requireOwner()`。普通 Admin 不具有酒单管理权限。
- 保存主体、替换配料在同一事务中。`UPDATE ... WHERE id = ? AND revision = ?` 原子检查修订号并递增；冲突返回可读提示，输入保留。配料写入失败时整个保存回滚。
- 已发布酒谱的保存按钮为“更新线上配方”。下架进入归档，归档只恢复为草稿；复制会新建独立草稿。V1 不提供酒谱永久删除。
- 材料 `id` 和 `code` 创建后不可更改，冰水不可删除，数据库触发器和外键提供额外保护。
- `astrablog:bar:preferences:v1` 只保存材料 ID、收藏酒谱 ID 和材料视图。首次读完偏好才允许写入；搜索词只留在当前页面。不可用存储会提示，但不妨碍筛选。
- 完整 JSON 导出含格式版本、导出时间、类型字典、材料字典、酒谱和配料，包含私人备注。下载来自经 Owner 检查的 Server Action，在当前浏览器生成临时 Blob，不生成公开下载路径。它不能替代生产数据库备份。

## JSON 批量导入与导出

Owner 在 `/studio/bar` 的“JSON 批量导入”中选择本地文件，校验后预览标签、材料、酒谱、配料数量与前五个酒名，点击“确认导入为草稿”执行。格式沿用导出的 `formatVersion: 1`，旧导出文件可直接使用。服务端重新校验权限、文件大小和全部数据，不依赖浏览器校验结果。

[完整示例](./examples/bar-import.v1.json)可直接导入为一份待完善草稿；不是生产酒谱种子。手工生成时，四个数组都必须存在，允许为空。只导入字典时，将酒谱与配料数组设为空即可。

| 字段 | 内容 |
| --- | --- |
| `formatVersion` | 固定数字 `1` |
| `exportedAt` | ISO 8601 日期时间，带 `Z` 或时区偏移 |
| `categories` | 类型标签：`id`、`name`、`sortOrder` |
| `ingredients` | 材料：`id`、`code`、`name`、`nameEn`、`aliases`、`categoryId`、`sortOrder` |
| `recipes` | 酒谱：`id`、`status`，以及编辑器中的名称、别名、说明、风味、方法、杯型、冰型、步骤、公私备注、来源等字段，详见示例 |
| `recipeIngredients` | 配料明细：`id`、`recipeId`、`ingredientId`、`amount`、`unit`、`amountText`、`isOptional`、`note`、`sortOrder` |

导出附带的 `createdAt`、`updatedAt`，以及酒谱的 `createdBy`、`updatedBy`、`revision`、`publishedAt` 可以保留，手工文件中也可省略。导入时不以这些字段覆盖本地管理信息。正文相关字段按示例完整提供；空文本用 `""`，列表用 `[]`，无数值用量用 `null`。`amount` 是 JSON 数字，不是字符串；数值加单位与 `amountText` 二选一。`sortOrder` 在同一酒谱内不可重复，按升序展示。

文件内每个数组的 ID 必须唯一，UUID 大小写会统一；标签名称、材料 `code` 也不可重复。材料必须引用文件中的类型，配料必须引用文件中的酒谱和材料。来源仅接受现有规则允许的 HTTP(S) 链接。已发布状态的源酒谱仍须符合发布字段校验，草稿和归档允许未完成内容。

导入采用合并新增：

- 类型按 ID 或相同名称复用；如果 ID 与名称指向两条不同记录则拒绝整批。材料按 ID 或固定 `code` 复用，并将文件中的引用映射为本地 ID。已有标签、材料的名称、类别等字段不被覆盖；ID 已被其他 `code` 使用则整批失败。
- `ice` 和 `water` 复用迁移创建的系统材料，不创建或更改系统身份。新材料、新类型沿用文件中的 ID。
- 酒谱按 ID 去重，同名不同 ID 仍会新增。已有酒谱整份跳过，包含配料、正文、状态和修订号；重复导入同一文件不会复制酒谱。
- 新酒谱全部是草稿，包括源文件中的已发布和归档酒谱。保留正文、私人备注和顺序；创建者与更新者使用当前 Owner，时间重新生成、修订号为 1、发布时间为空，配料明细生成新 ID。审阅后逐份发布。
- 标签、材料、酒谱及配料在一个事务内写入，任一条失败整批回滚。发生并发冲突可重试原文件；已有酒谱会跳过。界面显示实际新增和跳过数量，失败时保留文件。

单文件最大 **5 MiB（5,242,880 字节）**，最多 1,000 个类型、5,000 种材料、1,000 份酒谱、80,000 项配料，每份酒谱最多 80 项配料。大备份可按酒谱拆分：每份保留所需的材料、类型字典和相应配料，保持 ID 不变。导出仍提供全部记录，不受导入批次大小限制。Next.js 的 Server Action 请求上限设为 6 MiB，为文件和表单边界留出空间。

本功能无需新增数据库迁移；原酒单迁移必须已完成。JSON 导入用于批量录入与内容迁移，不提供覆盖恢复、自动重新发布或恢复旧修订历史，不能代替数据库备份。

## 验证

```sh
npm run typecheck
npm test
npm run dev
# 另一个终端，开发服务已启动后：
npm run test:e2e
npm run build
```

Vitest 覆盖冰水、去重、可选项、搜索交集、用量及来源链接校验、偏好损坏和存储禁用，以及导入格式、UUID、引用、重复项、大小限制和示例文件。Playwright 通过隔离数据运行真实公开组件、编辑器和酒谱管理组件，检查跨类型选择、请求数量、移动端布局、焦点恢复、新增材料、发布按钮、导出文件重新选择导入、失败后重试和非法文件拦截；管理动作使用测试桩。另有真实路由冒烟检查和原有博客样式回归。

`src/lib/bar/bar.integration.test.ts` 是可选的数据库语义测试：在临时目录安装 `@electric-sql/pglite`，将其 `dist/index.js` 的绝对路径设置到 `BAR_TEST_PGLITE_MODULE` 后执行 `npm test`。没有该环境变量时此套件明确标为跳过，不连接任何现有数据库。

例如 PowerShell：

```powershell
npm install --prefix "$env:TEMP/astrablog-bar-verification" --no-save --package-lock=false @electric-sql/pglite
$env:BAR_TEST_PGLITE_MODULE = "$env:TEMP/astrablog-bar-verification/node_modules/@electric-sql/pglite/dist/index.js"
npm test
```

该套件在内存 PostgreSQL 引擎中执行新增迁移和实际 Drizzle SQL，用最小父表提供原有用户/页面外键目标。覆盖系统身份、种子幂等、所有管理入口的非 Owner 拒绝、公开字段隔离、并发修订冲突、强制配料插入失败的回滚、下架恢复、独立复制、引用约束和完整导出。导入测试覆盖真实导出后导回、跨库字典与冰水映射、重复导入保留本地编辑、批次回滚后重试和相同文件的并发提交。它不替代目标 Neon 环境的迁移和网络事务验收。
