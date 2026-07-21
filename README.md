# Flashnote

Flashnote 是一个本地优先的桌面念头收件箱。它只解决一件事：工作中出现新念头时，用全局快捷键唤出细条悬浮窗，写下一句话，按回车后立即回到当前工作。

## 第一版能力

- `Cmd/Ctrl + Shift + Space` 全局快捷键呼出悬浮条
- 回车保存、Esc 取消、保存后自动隐藏
- 系统托盘常驻，可打开悬浮条或“稍后看”
- 本地 SQLite 存储，不需要账号或网络
- 全部、未处理、已处理筛选
- 编辑、处理、删除与撤销删除
- 可选登录时启动
- macOS `.app/.dmg` 与 Windows `setup.exe/.msi` 打包配置

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
