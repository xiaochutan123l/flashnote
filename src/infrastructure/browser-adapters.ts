import type { Capture, CaptureFilter, CaptureStatus } from "../domain/capture";
import type {
  AppSettings,
  CaptureGateway,
  DesktopGateway,
} from "../application/ports";

const STORAGE_KEY = "flashnote.browser.captures";
const SETTINGS_STORAGE_KEY = "flashnote.browser.settings";
const CHANGE_EVENT = "flashnote:captures-changed";

const defaultSettings: AppSettings = {
  launchAtLogin: false,
  shortcut: "CommandOrControl+Shift+Space",
  keepCaptureBarVisible: false,
};

function readSettings(): AppSettings {
  const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
  if (!raw) return defaultSettings;
  try {
    return { ...defaultSettings, ...(JSON.parse(raw) as Partial<AppSettings>) };
  } catch {
    return defaultSettings;
  }
}

function writeSettings(settings: AppSettings): AppSettings {
  localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  return settings;
}

function readCaptures(): Capture[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as Capture[];
  } catch {
    return [];
  }
}

function writeCaptures(captures: Capture[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(captures));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/**
 * Development adapter for `npm run dev`. It is intentionally not used in the
 * packaged app, but makes the complete UI reviewable without a Rust toolchain.
 */
export class BrowserCaptureGateway implements CaptureGateway {
  async create(content: string): Promise<Capture> {
    const now = Date.now();
    const capture: Capture = {
      id: crypto.randomUUID(),
      content,
      status: "inbox",
      createdAt: now,
      updatedAt: now,
      processedAt: null,
    };
    writeCaptures([capture, ...readCaptures()]);
    return capture;
  }

  async list(filter: CaptureFilter): Promise<Capture[]> {
    return readCaptures()
      .filter((capture) => filter === "all" || capture.status === filter)
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  async update(id: string, content: string): Promise<Capture> {
    return this.change(id, (capture) => ({
      ...capture,
      content,
      updatedAt: Date.now(),
    }));
  }

  async setStatus(id: string, status: CaptureStatus): Promise<Capture> {
    return this.change(id, (capture) => ({
      ...capture,
      status,
      updatedAt: Date.now(),
      processedAt: status === "processed" ? Date.now() : null,
    }));
  }

  async delete(id: string): Promise<void> {
    writeCaptures(readCaptures().filter((capture) => capture.id !== id));
  }

  async restore(): Promise<Capture> {
    throw new Error("浏览器预览不支持跨刷新撤销");
  }

  async subscribe(listener: () => void): Promise<() => void> {
    window.addEventListener(CHANGE_EVENT, listener);
    return () => window.removeEventListener(CHANGE_EVENT, listener);
  }

  private change(
    id: string,
    mutate: (capture: Capture) => Capture,
  ): Capture {
    let changed: Capture | undefined;
    const captures = readCaptures().map((capture) => {
      if (capture.id !== id) return capture;
      changed = mutate(capture);
      return changed;
    });
    if (!changed) throw new Error("记录不存在");
    writeCaptures(captures);
    return changed;
  }
}

export class BrowserDesktopGateway implements DesktopGateway {
  async hideCaptureBar(): Promise<void> {}

  async showCaptureBar(): Promise<void> {
    window.location.search = "?window=capture";
  }

  async openInbox(): Promise<void> {
    window.location.search = "?window=inbox";
  }

  async getSettings(): Promise<AppSettings> {
    return readSettings();
  }

  async setLaunchAtLogin(enabled: boolean): Promise<AppSettings> {
    return writeSettings({ ...readSettings(), launchAtLogin: enabled });
  }

  async setKeepCaptureBarVisible(enabled: boolean): Promise<AppSettings> {
    return writeSettings({
      ...readSettings(),
      keepCaptureBarVisible: enabled,
    });
  }
}
