# Flashnote 软件架构

## 1. 架构目标

Flashnote 采用本地优先的分层架构。2.0 在不改变快速记录流程的前提下，增加长期计划、今日专注、每日随笔和历史归档。

核心约束：

1. 领域层不依赖 React、Tauri、SQLite 或具体操作系统。
2. UI 不直接执行 SQL，也不直接操作插件权限。
3. Tauri 命令只做协议转换、调用应用服务和广播变更事件。
4. 平台差异集中在 `platform` 模块，不散落在业务代码中。
5. `capture` 永远代表原始想法，`plan` 与 `focus` 独立建模，避免让快速记录流程承载计划层级或日期。
6. 每日历史来自现有数据的按日读取，不维护容易失真的冗余“日报”副本。

## 2. 依赖方向

```text
Presentation (React windows)
        │
        ▼
Application (use cases + ports)
        │
        ▼
Domain (Capture + Planning models and rules)

Infrastructure ──implements──> Application ports
Platform       ──called by───> Tauri command boundary
```

依赖只能向内：领域层和应用层不会反向引用外部框架。`src/application/container.ts` 与 `src-tauri/src/lib.rs` 是前后端各自的组合根，负责选择具体实现。

## 3. 前端模块

### `src/domain`

跨界面共享的 Capture、PlanItem、FocusItem、DailyNote 与 DailyRecord 类型及输入规则。这里不包含组件状态。

### `src/application`

- `ports.ts`：定义捕捉、计划存储与桌面操作接口。
- `capture-service.ts`：表达创建、编辑、处理、恢复等用例。
- `planning-service.ts`：表达计划拆分、选入今日、切换当前事项、完成和每日随笔等用例。
- `container.ts`：选择 Tauri 或浏览器适配器。
- `services-context.tsx`：把构造好的用例注入 React。

### `src/infrastructure`

- `tauri-adapters.ts`：把应用端口翻译为 Tauri IPC。
- `browser-adapters.ts`：浏览器独立调试使用的 localStorage 实现。

两个实现共享同一接口，因此组件测试不需要桌面运行时，未来替换存储实现也无需修改组件。

### `src/capture-bar`

悬浮输入条是一个独立窗口入口，只关心一次捕捉会话：聚焦、输入、保存、折叠和隐藏。折叠逻辑位于共享的 `src/shared/idle-collapse-controller.ts`，由灵感条和今日专注浮窗共同使用。它只接收指针、焦点和折叠策略，不接收“保存成功”事件，因此保存生命周期与窗口折叠彻底解耦。

状态机规则：

```text
pointer inside OR focus within
  -> expanded

pointer outside AND focus outside AND auto collapse enabled
  -> pending
  -> configured delay
  -> collapsed capsule
```

草稿属于 `CaptureBar` 会话状态。折叠只切换展示和原生窗口尺寸，不会清空草稿。

### `src/inbox`

稍后看窗口负责读取和处理已捕捉内容。`useCaptures` 订阅 `captures://changed`，因此悬浮条保存后列表可立即刷新。

### `src/planning`

- `PlansPage`：长期计划树的增删改、子事项拆分和选入今日。
- `TodayFocusPage`：当天清单、唯一当前事项、右键完成、计划选择器和每日随笔。
- `HistoryPage`：按本地日期读取专注完成情况、随笔和已处理灵感。
- `use-planning.ts`：统一订阅 `planning://changed`，隔离页面与 IPC 刷新细节。

今日清单保存计划标题快照。之后重命名或删除长期计划不会改写过去每天的记录。

### `src/focus-window`

今日专注浮窗是第二个独立窗口入口。展开时展示今日清单并允许切换当前事项；折叠时只展示当前事项。它通过“灵感”按钮复用 1.0 捕捉窗，不复制记录逻辑。

### `src/main-window`

主窗口只负责顶层导航，在稍后看、今日专注、计划、每日历史和设置之间切换。页面内部业务仍由各自模块维护。

### `src/settings`

只承载桌面偏好。当前包含登录启动、两个浮窗的常驻开关、自动折叠、共享折叠延迟、置顶和各自的位置记忆。设置通过 `settings://changed` 广播，已挂载但隐藏的窗口不需要重新创建就能应用最新策略。

## 4. Rust 模块

### `domain/capture.rs`

领域实体、状态、筛选条件和内容规则。没有框架属性之外的运行时依赖。

### `application/capture_service.rs`

用例协调器。负责生成 ID/时间、验证输入、执行状态迁移，并通过 `CaptureRepository` 端口持久化。

### `domain/planning.rs`

计划、今日事项、每日随笔和历史记录的领域实体，以及标题、日期、随笔的规范化规则。

### `application/planning_service.rs`

计划相关用例协调器。它不包含 SQL 或窗口逻辑；“同一天只有一个当前事项”等规则由服务和存储事务共同保证。

### `application/ports.rs`

存储抽象。`CaptureRepository` 与 `PlanningRepository` 分开定义，使灵感箱与计划模块可以独立演进。

### `infrastructure/sqlite_capture_repository.rs`

SQLite 适配器。启用 WAL、忙等待和索引，使用软删除支持撤销。SQL 只存在于此模块。

### `infrastructure/sqlite_planning_repository.rs`

计划模块的 SQLite 适配器。负责计划树、今日清单、唯一当前事项事务和历史查询。它与捕捉仓储共享同一个数据库文件，但互不直接调用。

### `commands.rs`

Tauri IPC 边界。命令调用应用服务后发送 `captures://changed` 或 `planning://changed`；错误在边界被转换成可展示的中文字符串。

### `platform`

- `windows.rs`：主窗口、灵感条和今日专注浮窗的显示、隐藏、聚焦、原生拖动、置顶和展开/折叠尺寸切换。
- `tray.rs`：三个窗口的托盘入口及退出入口。
- `settings.rs`：组合操作系统管理的登录启动状态与应用自己的 `preferences.json` 偏好；两个浮窗的位置分别保存为物理中心点。

如果以后需要更原生的 macOS `NSPanel` 或 Windows `HWND_TOPMOST` 行为，只扩展这个目录。

## 5. 保存数据流

```text
global shortcut
  -> show capture window
  -> CaptureBar submit
  -> CaptureService.create (TypeScript validation)
  -> invoke create_capture
  -> CaptureService.create (Rust authoritative validation)
  -> CaptureRepository.insert
  -> SQLite transaction
  -> emit captures://changed
  -> inbox refresh
  -> 非常驻模式：短暂确认后隐藏
  -> 常驻模式：保持当前指针/焦点驱动的展示状态

pointer leave + focus leave
  -> configured delay
  -> set_capture_bar_mode(collapsed capsule)
  -> mouse enter / focus / global shortcut
  -> set_capture_bar_mode(expanded)
```

窗口配置使用 `create: false`，由 `platform::windows` 在 `AppState` 注册后统一创建。这避免 Windows 冷启动较快时，前端在共享状态注册前调用命令的竞争条件。

前后端均校验是有意的：前端提供即时反馈，Rust 层是可信边界，确保其他调用者不能写入非法数据。

## 6. 计划数据流

```text
PlansPage create child
  -> PlanningService.createPlanItem
  -> invoke create_plan_item
  -> PlanningService (Rust validation)
  -> PlanningRepository insert
  -> emit planning://changed
  -> plan tree refresh

add plan to today
  -> day_focus_items stores plan id + title snapshot
  -> click circle
  -> transaction clears the day's previous current item
  -> selected item becomes current
  -> main page and floating window refresh

daily note input stops briefly
  -> upsert daily_notes by local YYYY-MM-DD
  -> history reads focus items + note + processed captures
```

## 7. 数据模型

`captures` 只保存捕捉本身：

- `id`：UUID
- `content`：规范化后的一句话，最多 500 字符
- `status`：`inbox` 或 `processed`
- `created_at` / `updated_at`
- `processed_at`
- `deleted_at`：软删除时间，用于撤销

`plan_items` 保存长期计划树：

- `id` / `parent_id`：通过父引用形成任意层级
- `title`：计划标题
- `is_completed`
- `created_at` / `updated_at`
- `deleted_at`：删除计划树时递归软删除

`day_focus_items` 保存某天真正要推进的少量事项：

- `id` / `day`
- `plan_item_id`：可选来源引用
- `title_snapshot`：保留当天和历史展示
- `is_current`：同一天最多一个
- `is_completed` / `completed_at`
- `sort_order`

`daily_notes` 以 `day` 为主键保存当天随笔。历史页面不额外写表，而是按日期组合上述数据和 `captures.processed_at`。

## 8. 扩展策略

### 云同步

新增 `SyncQueueRepository` 与后台同步服务。SQLite 仍作为读写源，成功写入后记录 outbox 事件；UI 接口不变。

### 全文搜索

在基础设施层增加 SQLite FTS5 表和搜索端口，不改变 Capture 实体。

### 更完整的任务能力

如果未来需要截止时间、提醒或重复规则，应建立独立 `task` 领域，而不是继续给 `plan_items` 添加大量可空字段。

### 原生窗口增强

保持 `platform::windows` 公共函数不变，在内部按 `cfg(target_os)` 分派到 macOS 和 Windows 实现。

## 9. 测试策略

- 领域测试：输入规范化和不变量。
- 应用测试：通过假端口验证用例编排。
- 存储测试：内存 SQLite 验证完整生命周期。
- UI 测试：可在浏览器适配器或 mock service 下运行。
- 打包测试：CI 分别在 macOS 与 Windows 原生 runner 上构建。

## 10. 构建环境边界

- `Dockerfile` 的 `test` target 是默认质量门：前端测试、TypeScript/Vite 构建、Rust 格式检查、Clippy 和 Rust 测试都在容器内完成。
- `linux-build` target 生成 `.deb` 和 AppImage。
- macOS 包依赖 Apple 的 Xcode/macOS SDK、签名和公证工具，只在 macOS CI runner 构建。
- Windows `.msi` 依赖 WiX，只在 Windows CI runner 构建；NSIS `setup.exe` 也跟随同一 runner，避免不稳定的交叉编译。
- Host 只需要 Docker 和 Git，不需要安装项目编译工具链。
