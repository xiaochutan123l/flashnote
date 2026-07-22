import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { Capture, CaptureFilter, CaptureStatus } from "../domain/capture";
import type {
  AppSettings,
  CaptureBarMode,
  CaptureGateway,
  DesktopGateway,
} from "../application/ports";

/** Thin IPC adapter; command names mirror the Rust command boundary. */
export class TauriCaptureGateway implements CaptureGateway {
  create(content: string): Promise<Capture> {
    return invoke("create_capture", { content });
  }

  list(filter: CaptureFilter): Promise<Capture[]> {
    return invoke("list_captures", { filter });
  }

  update(id: string, content: string): Promise<Capture> {
    return invoke("update_capture", { id, content });
  }

  setStatus(id: string, status: CaptureStatus): Promise<Capture> {
    return invoke("set_capture_status", { id, status });
  }

  delete(id: string): Promise<void> {
    return invoke("delete_capture", { id });
  }

  restore(id: string): Promise<Capture> {
    return invoke("restore_capture", { id });
  }

  subscribe(listener: () => void): Promise<() => void> {
    return listen("captures://changed", listener);
  }
}

export class TauriDesktopGateway implements DesktopGateway {
  hideCaptureBar(): Promise<void> {
    return invoke("hide_capture_bar");
  }

  showCaptureBar(): Promise<void> {
    return invoke("show_capture_bar");
  }

  openInbox(): Promise<void> {
    return invoke("open_inbox");
  }

  getSettings(): Promise<AppSettings> {
    return invoke("get_settings");
  }

  setLaunchAtLogin(enabled: boolean): Promise<AppSettings> {
    return invoke("set_launch_at_login", { enabled });
  }

  setKeepCaptureBarVisible(enabled: boolean): Promise<AppSettings> {
    return invoke("set_keep_capture_bar_visible", { enabled });
  }

  setCaptureBarMode(mode: CaptureBarMode): Promise<void> {
    return invoke("set_capture_bar_mode", { mode });
  }

  startCaptureBarDrag(): Promise<void> {
    return invoke("start_capture_bar_drag");
  }

  subscribeCaptureBarActivation(listener: () => void): Promise<() => void> {
    return listen("capture://activated", listener);
  }
}
