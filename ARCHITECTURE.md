# Flashnote 软件架构

## 1. 架构目标

Flashnote 采用本地优先的分层架构，目标是让“记录念头”保持稳定和极简，同时允许未来独立增加任务、同步、搜索等能力。

核心约束：

1. 领域层不依赖 React、Tauri、SQLite 或具体操作系统。
2. UI 不直接执行 SQL，也不直接操作插件权限。
3. Tauri 命令只做协议转换、调用应用服务和广播变更事件。
4. 平台差异集中在 `platform` 模块，不散落在业务代码中。
5. `capture` 永远代表原始想法。未来任务通过引用 capture 创建，避免让快速记录流程承载日期、优先级等复杂概念。

## 2. 依赖方向

```text
Presentation (React windows)
        │
        ▼
Application (use cases + ports)
        │
        ▼
Domain (Capture model + rules)

Infrastructure ──implements──> Application ports
Platform       ──called by───> Tauri command boundary
```

依赖只能向内：领域层和应用层不会反向引用外部框架。`src/application/container.ts` 与 `src-tauri/src/lib.rs` 是前后端各自的组合根，负责选择具体实现。

## 3. 前端模块

### `src/domain`

跨界面共享的 Capture 类型、状态和输入规则。这里不包含组件状态。

### `src/application`

- `ports.ts`：定义捕捉存储与桌面操作接口。
- `capture-service.ts`：表达创建、编辑、处理、恢复等用例。
- `container.ts`：选择 Tauri 或浏览器适配器。
- `services-context.tsx`：把构造好的用例注入 React。

### `src/infrastructure`

- `tauri-adapters.ts`：把应用端口翻译为 Tauri IPC。
- `browser-adapters.ts`：浏览器独立调试使用的 localStorage 实现。

两个实现共享同一接口，因此组件测试不需要桌面运行时，未来增加远端同步也无需修改组件。

### `src/capture-bar`

悬浮输入条是一个独立窗口入口，只关心一次捕捉会话：聚焦、输入、保存、确认、隐藏。它不知道 SQLite 的存在。

### `src/inbox`

稍后看窗口负责读取和处理已捕捉内容。`useCaptures` 订阅 `captures://changed`，因此悬浮条保存后列表可立即刷新。

### `src/settings`

只承载桌面偏好。当前包含登录启动，未来快捷键编辑可继续放在这里，但不应进入 capture 领域。

## 4. Rust 模块

### `domain/capture.rs`

领域实体、状态、筛选条件和内容规则。没有框架属性之外的运行时依赖。

### `application/capture_service.rs`

用例协调器。负责生成 ID/时间、验证输入、执行状态迁移，并通过 `CaptureRepository` 端口持久化。

### `application/ports.rs`

存储抽象。SQLite、测试内存库以及未来“本地库 + 同步队列”都可以实现此接口。

### `infrastructure/sqlite_capture_repository.rs`

SQLite 适配器。启用 WAL、忙等待和索引，使用软删除支持撤销。SQL 只存在于此模块。

### `commands.rs`

Tauri IPC 边界。命令调用应用服务后统一发送 `captures://changed` 事件；错误在边界被转换成可展示的中文字符串。

### `platform`

- `windows.rs`：窗口显示、隐藏和聚焦。
- `tray.rs`：托盘菜单及退出入口。
- `settings.rs`：登录启动等操作系统偏好。

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
  -> capture window hides
```

前后端均校验是有意的：前端提供即时反馈，Rust 层是可信边界，确保其他调用者不能写入非法数据。

## 6. 数据模型

`captures` 只保存捕捉本身：

- `id`：UUID
- `content`：规范化后的一句话，最多 500 字符
- `status`：`inbox` 或 `processed`
- `created_at` / `updated_at`
- `processed_at`
- `deleted_at`：软删除时间，用于撤销

未来任务模型应独立存在：

```text
tasks.source_capture_id -> captures.id
```

“转为任务”由未来 `TaskService` 完成，并把 capture 标记为 processed。不要给 `captures` 增加大量任务专属的可空字段。

## 7. 扩展策略

### 云同步

新增 `SyncQueueRepository` 与后台同步服务。SQLite 仍作为读写源，成功写入后记录 outbox 事件；UI 接口不变。

### 全文搜索

在基础设施层增加 SQLite FTS5 表和搜索端口，不改变 Capture 实体。

### 滴答式任务

建立独立 `task` 领域、`TaskRepository` 和任务窗口。通过 `source_capture_id` 保留来源。

### 原生窗口增强

保持 `platform::windows` 公共函数不变，在内部按 `cfg(target_os)` 分派到 macOS 和 Windows 实现。

## 8. 测试策略

- 领域测试：输入规范化和不变量。
- 应用测试：通过假端口验证用例编排。
- 存储测试：内存 SQLite 验证完整生命周期。
- UI 测试：可在浏览器适配器或 mock service 下运行。
- 打包测试：CI 分别在 macOS 与 Windows 原生 runner 上构建。

## 9. 构建环境边界

- `Dockerfile` 的 `test` target 是默认质量门：前端测试、TypeScript/Vite 构建、Rust 格式检查、Clippy 和 Rust 测试都在容器内完成。
- `linux-build` target 生成 `.deb` 和 AppImage。
- macOS 包依赖 Apple 的 Xcode/macOS SDK、签名和公证工具，只在 macOS CI runner 构建。
- Windows `.msi` 依赖 WiX，只在 Windows CI runner 构建；NSIS `setup.exe` 也跟随同一 runner，避免不稳定的交叉编译。
- Host 只需要 Docker 和 Git，不需要安装项目编译工具链。
