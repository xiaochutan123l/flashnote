# Flashnote

Flashnote 2.0 是一个本地优先的桌面专注辅助工具。工作中出现新念头时，可以立即收进灵感箱；需要推进长期事项时，可以把计划拆小、选入今日，并用一个圆点明确此刻要回到的事情。

## 当前能力

- `Cmd/Ctrl + Shift + Space` 全局快捷键呼出悬浮条
- 回车保存、Esc 取消；保存和折叠是互相独立的交互
- 常驻模式下，鼠标离开且输入框失焦后按设置的时间折叠
- 折叠后显示容易找到的短胶囊，悬停或聚焦时立即展开
- 未保存内容在折叠后保留，再次展开可继续输入
- 折叠延迟支持 `1 / 3 / 5 / 10` 秒，也可以完全关闭自动折叠
- 原生窗口完全透明，只有圆角小条本身拥有背景、边框和阴影
- 左侧拖动柄可移动悬浮条，并可跨重启记住屏幕位置
- 悬浮条可直接打开“稍后看”列表
- 系统托盘常驻，可打开悬浮条或“稍后看”
- macOS 显示正常 Dock 图标；Windows 发布包不附带终端窗口
- 本地 SQLite 存储，不需要账号或网络
- 全部、未处理、已处理筛选
- 编辑、处理、删除与撤销删除
- 长期计划支持任意层级的子事项
- 计划事项可以选入“今日专注”，不复制计划结构、不改变原计划状态
- 今日事项使用一个圆点表示唯一的当前专注，点击即可随时切换
- 右键今日事项可标记完成；完成后显示绿色勾
- 今日专注浮窗可移动、常驻并自动折叠；折叠后只显示当前事项
- 今日随笔自动保存，专注完成情况、随笔和已处理灵感按日期进入历史
- 可选登录时启动
- 可分别控制灵感条和今日专注浮窗是否始终显示
- 可选始终置顶、自动折叠、折叠延迟与位置记忆
- macOS `.app/.dmg` 与 Windows `setup.exe/.msi` 打包配置
- 正式版本标签会把安装包直接发布到 GitHub Releases

## 开发

推荐使用 Docker 完成测试和 Linux 构建，避免把 Node/Rust/Tauri 依赖安装到 Host：

```bash
# 前端测试、生产构建、rustfmt、clippy、Rust 测试
docker compose build test

# 需要自动整理 Rust 源码时
docker compose run --rm format

# 生成 Linux deb/AppImage 到 artifacts/linux
docker compose build linux-build
docker compose run --rm linux-build

# 只预览前端，访问 http://localhost:1420
docker compose up ui
```

macOS 依赖 Xcode/macOS SDK，Windows 的 MSI 依赖 WiX，因此两种正式安装包由 `.github/workflows/build.yml` 中对应的原生 CI runner 构建，不能由普通 Linux Docker 镜像替代。

## 使用

- macOS 使用 `Cmd + Shift + Space`、Windows 使用 `Ctrl + Shift + Space` 呼出悬浮条。
- 按回车保存，按 Esc 隐藏；点击悬浮条右侧的列表图标可打开“稍后看”。
- 在“设置”中开启“悬浮条始终显示”和“离开后自动折叠”后，鼠标离开且输入框失焦才会开始倒计时。
- 倒计时与保存无关；重新移入、重新聚焦或使用快捷键会立即取消倒计时并展开。
- 按住悬浮条左侧六点拖动柄可移动位置；默认会记住位置并在显示器变化后自动限制到可见区域。
- 在“计划”中创建长期事项并逐层拆分，点击“加入今天”即可放进今日清单。
- 在“今日专注”中点击事项左侧圆点指定当前事项；右键事项可完成或从今天移除。
- 今日专注浮窗的“灵感”按钮会打开 1.0 的快速记录条，“打开列表”会回到完整今日界面。
- “今天的随笔”会在停止输入后自动保存，无需单独提交；“每日历史”按日期汇总完成情况和随笔。
- 关闭列表窗口只是隐藏，点击 macOS Dock 图标、Windows 任务栏图标或托盘菜单可再次打开。

## 发布

`main` 和 `codex/**` 开发分支会生成 Actions 测试产物。确认测试通过后再推送 `v*` 标签；工作流届时才会创建 GitHub Release，并直接上传 macOS `.dmg`、Windows `setup.exe` 和 `.msi`。

如果选择 Host 原生开发，则需要 Node.js 20+、Rust stable，以及各平台的 Tauri 系统依赖：

```bash
npm install
npm run desktop:dev
```

只查看和调试界面时不需要 Rust；浏览器适配器会使用 `localStorage`：

```bash
npm run dev
# 列表：http://localhost:1420/?window=inbox
# 悬浮条：http://localhost:1420/?window=capture
# 今日专注浮窗：http://localhost:1420/?window=focus
```

## 验证

```bash
npm test
npm run build
cargo test --manifest-path src-tauri/Cargo.toml
npm run desktop:build
```

更详细的边界、数据流和扩展方式见 [ARCHITECTURE.md](./ARCHITECTURE.md)。
