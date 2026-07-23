import { useEffect, useState } from "react";
import type { AppSettings } from "../application/ports";
import { useServices } from "../application/services-context";

const collapseDelays = [
  { value: 1_000, label: "1 秒" },
  { value: 3_000, label: "3 秒" },
  { value: 5_000, label: "5 秒" },
  { value: 10_000, label: "10 秒" },
];

export function SettingsPanel({ onClose }: { onClose(): void }) {
  const { desktop } = useServices();
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void desktop.getSettings().then(setSettings).catch((cause) => {
      setError(cause instanceof Error ? cause.message : String(cause));
    });
  }, [desktop]);

  async function updateSettings(action: () => Promise<AppSettings>) {
    if (!settings) return;
    try {
      setSettings(await action());
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="settings-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <p className="eyebrow">偏好设置</p>
            <h2 id="settings-title">保持简单，也保持顺手</h2>
          </div>
          <button className="icon-button close-button" onClick={onClose} aria-label="关闭">
            ×
          </button>
        </header>
        <div className="settings-row">
          <div>
            <strong>悬浮条始终显示</strong>
            <p>常驻桌面；是否折叠以及等待多久由下方设置决定。</p>
          </div>
          <button
            className={`switch ${settings?.keepCaptureBarVisible ? "is-on" : ""}`}
            role="switch"
            aria-checked={settings?.keepCaptureBarVisible ?? false}
            disabled={!settings}
            onClick={() =>
              void updateSettings(() =>
                desktop.setKeepCaptureBarVisible(
                  !settings!.keepCaptureBarVisible,
                ),
              )
            }
          >
            <span />
          </button>
        </div>
        <div className="settings-row">
          <div>
            <strong>离开后自动折叠</strong>
            <p>鼠标离开且输入框失焦后开始倒计时，与保存动作无关。</p>
          </div>
          <button
            className={`switch ${settings?.autoCollapseCaptureBar ? "is-on" : ""}`}
            role="switch"
            aria-checked={settings?.autoCollapseCaptureBar ?? false}
            disabled={!settings}
            onClick={() =>
              void updateSettings(() =>
                desktop.setAutoCollapseCaptureBar(
                  !settings!.autoCollapseCaptureBar,
                ),
              )
            }
          >
            <span />
          </button>
        </div>
        <div className="settings-row settings-row--stacked">
          <div>
            <strong>折叠等待时间</strong>
            <p>重新移入或聚焦会立即取消当前倒计时。</p>
          </div>
          <div className="delay-options" aria-label="折叠等待时间">
            {collapseDelays.map((delay) => (
              <button
                key={delay.value}
                className={
                  settings?.captureBarCollapseDelayMs === delay.value
                    ? "is-active"
                    : ""
                }
                disabled={!settings || !settings.autoCollapseCaptureBar}
                onClick={() =>
                  void updateSettings(() =>
                    desktop.setCaptureBarCollapseDelay(delay.value),
                  )
                }
              >
                {delay.label}
              </button>
            ))}
          </div>
        </div>
        <div className="settings-row">
          <div>
            <strong>悬浮条始终置顶</strong>
            <p>保持在其他窗口上方，需要时仍可随时关闭。</p>
          </div>
          <button
            className={`switch ${settings?.captureBarAlwaysOnTop ? "is-on" : ""}`}
            role="switch"
            aria-checked={settings?.captureBarAlwaysOnTop ?? false}
            disabled={!settings}
            onClick={() =>
              void updateSettings(() =>
                desktop.setCaptureBarAlwaysOnTop(
                  !settings!.captureBarAlwaysOnTop,
                ),
              )
            }
          >
            <span />
          </button>
        </div>
        <div className="settings-row">
          <div>
            <strong>记住悬浮条位置</strong>
            <p>重新启动后恢复到上次拖动的位置，并自动限制在可见屏幕内。</p>
          </div>
          <button
            className={`switch ${settings?.rememberCaptureBarPosition ? "is-on" : ""}`}
            role="switch"
            aria-checked={settings?.rememberCaptureBarPosition ?? false}
            disabled={!settings}
            onClick={() =>
              void updateSettings(() =>
                desktop.setRememberCaptureBarPosition(
                  !settings!.rememberCaptureBarPosition,
                ),
              )
            }
          >
            <span />
          </button>
        </div>
        <div className="settings-row">
          <div>
            <strong>登录时启动</strong>
            <p>让悬浮条随系统启动，在需要时随时可用。</p>
          </div>
          <button
            className={`switch ${settings?.launchAtLogin ? "is-on" : ""}`}
            role="switch"
            aria-checked={settings?.launchAtLogin ?? false}
            disabled={!settings}
            onClick={() =>
              void updateSettings(() =>
                desktop.setLaunchAtLogin(!settings!.launchAtLogin),
              )
            }
          >
            <span />
          </button>
        </div>
        <div className="settings-row">
          <div>
            <strong>呼出悬浮条</strong>
            <p>第一版使用固定快捷键，后续可在此自定义。</p>
          </div>
          <kbd>⌘ / Ctrl · ⇧ · Space</kbd>
        </div>
        {error ? <p className="inline-error">{error}</p> : null}
      </section>
    </div>
  );
}
