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
- 私有查询、每项 Server Action 和完整导出均独立调用原有 `requireOwner()`。普通 Admin 不具有酒单管理权限。
- 保存主体、替换配料在同一事务中。`UPDATE ... WHERE id = ? AND revision = ?` 原子检查修订号并递增；冲突返回可读提示，输入保留。配料写入失败时整个保存回滚。
- 已发布酒谱的保存按钮为“更新线上配方”。下架进入归档，归档只恢复为草稿；复制会新建独立草稿。V1 不提供酒谱永久删除。
- 材料 `id` 和 `code` 创建后不可更改，冰水不可删除，数据库触发器和外键提供额外保护。
- `astrablog:bar:preferences:v1` 只保存材料 ID、收藏酒谱 ID 和材料视图。首次读完偏好才允许写入；搜索词只留在当前页面。不可用存储会提示，但不妨碍筛选。
- 完整 JSON 导出含格式版本、导出时间、类型字典、材料字典、酒谱和配料，包含私人备注。下载来自经 Owner 检查的 Server Action，在当前浏览器生成临时 Blob，不生成公开下载路径。它不能替代生产数据库备份。

## 验证

```sh
npm run typecheck
npm test
npm run dev
# 另一个终端，开发服务已启动后：
npm run test:e2e
npm run build
```

Vitest 覆盖冰水、去重、可选项、搜索交集、用量及来源链接校验、偏好损坏和存储禁用。Playwright 通过隔离的测试数据运行真实公开组件和编辑器，检查跨类型选择、请求数量、移动端布局、焦点恢复、新增材料和发布按钮等；编辑器测试中的动作使用测试桩。另有真实路由冒烟检查和原有博客样式回归。

`src/lib/bar/bar.integration.test.ts` 是可选的数据库语义测试：在临时目录安装 `@electric-sql/pglite`，将其 `dist/index.js` 的绝对路径设置到 `BAR_TEST_PGLITE_MODULE` 后执行 `npm test`。没有该环境变量时此套件明确标为跳过，不连接任何现有数据库。

例如 PowerShell：

```powershell
npm install --prefix "$env:TEMP/astrablog-bar-verification" --no-save --package-lock=false @electric-sql/pglite
$env:BAR_TEST_PGLITE_MODULE = "$env:TEMP/astrablog-bar-verification/node_modules/@electric-sql/pglite/dist/index.js"
npm test
```

该套件在内存 PostgreSQL 引擎中执行新增迁移和实际 Drizzle SQL，用最小父表提供原有用户/页面外键目标。覆盖系统身份、种子幂等、所有管理入口的非 Owner 拒绝、公开字段隔离、并发修订冲突、强制配料插入失败的回滚、下架恢复、独立复制、引用约束和完整导出。它不替代目标 Neon 环境的迁移和网络事务验收。
