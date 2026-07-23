# Flashnote

Flashnote 1.0 是一个本地优先的桌面念头收件箱。它只解决一件事：工作中出现新念头时，用全局快捷键唤出细条悬浮窗，写下一句话，按回车后立即回到当前工作。

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
- 可选登录时启动
- 可选始终显示、始终置顶与位置记忆
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
- 关闭列表窗口只是隐藏，点击 macOS Dock 图标、Windows 任务栏图标或托盘菜单可再次打开。

## 发布

普通 `main` 分支构建仍会生成 Actions 测试产物。确认测试通过后推送 `v*` 标签，工作流会创建对应的 GitHub Release，并直接上传 macOS `.dmg`、Windows `setup.exe` 和 `.msi`，用户不需要进入 Actions 页面下载。

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
```

## 验证

```bash
npm test
npm run build
cargo test --manifest-path src-tauri/Cargo.toml
npm run desktop:build
```

更详细的边界、数据流和扩展方式见 [ARCHITECTURE.md](./ARCHITECTURE.md)。
