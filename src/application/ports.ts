import type { Capture, CaptureFilter, CaptureStatus } from "../domain/capture";

/**
 * Port implemented by the Tauri adapter in production and an in-browser adapter
 * during UI development. UI modules never depend on SQLite or Tauri directly.
 */
export interface CaptureGateway {
  create(content: string): Promise<Capture>;
  list(filter: CaptureFilter): Promise<Capture[]>;
  update(id: string, content: string): Promise<Capture>;
  setStatus(id: string, status: CaptureStatus): Promise<Capture>;
  delete(id: string): Promise<void>;
  restore(id: string): Promise<Capture>;
  subscribe(listener: () => void): Promise<() => void>;
}

export interface AppSettings {
  launchAtLogin: boolean;
  shortcut: string;
  keepCaptureBarVisible: boolean;
}

/** OS/window operations are isolated so presentation code remains testable. */
export interface DesktopGateway {
  hideCaptureBar(): Promise<void>;
  showCaptureBar(): Promise<void>;
  openInbox(): Promise<void>;
  getSettings(): Promise<AppSettings>;
  setLaunchAtLogin(enabled: boolean): Promise<AppSettings>;
  setKeepCaptureBarVisible(enabled: boolean): Promise<AppSettings>;
}
