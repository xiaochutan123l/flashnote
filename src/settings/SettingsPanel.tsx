import { useEffect, useState } from "react";
import type { AppSettings } from "../application/ports";
import { useServices } from "../application/services-context";

export function SettingsPanel({ onClose }: { onClose(): void }) {
  const { desktop } = useServices();
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void desktop.getSettings().then(setSettings).catch((cause) => {
      setError(cause instanceof Error ? cause.message : String(cause));
    });
  }, [desktop]);

  async function toggleLaunchAtLogin() {
    if (!settings) return;
    try {
      setSettings(await desktop.setLaunchAtLogin(!settings.launchAtLogin));
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
            <strong>登录时启动</strong>
            <p>让悬浮条随系统启动，在需要时随时可用。</p>
          </div>
          <button
            className={`switch ${settings?.launchAtLogin ? "is-on" : ""}`}
            role="switch"
            aria-checked={settings?.launchAtLogin ?? false}
            disabled={!settings}
            onClick={() => void toggleLaunchAtLogin()}
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

