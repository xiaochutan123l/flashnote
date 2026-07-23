import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { Capture, CaptureFilter, CaptureStatus } from "../domain/capture";
import type {
  DailyNote,
  DailyRecord,
  FocusItem,
  PlanItem,
} from "../domain/planning";
import type {
  AppSettings,
  CaptureBarMode,
  CaptureGateway,
  DesktopGateway,
  FocusWindowMode,
  MainView,
  PlanningGateway,
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

export class TauriPlanningGateway implements PlanningGateway {
  createPlanItem(title: string, parentId: string | null): Promise<PlanItem> {
    return invoke("create_plan_item", { title, parentId });
  }

  listPlanItems(): Promise<PlanItem[]> {
    return invoke("list_plan_items");
  }

  updatePlanItem(id: string, title: string): Promise<PlanItem> {
    return invoke("update_plan_item", { id, title });
  }

  setPlanItemCompleted(id: string, completed: boolean): Promise<PlanItem> {
    return invoke("set_plan_item_completed", { id, completed });
  }

  deletePlanItem(id: string): Promise<void> {
    return invoke("delete_plan_item", { id });
  }

  addPlanItemToDay(planItemId: string, day: string): Promise<FocusItem> {
    return invoke("add_plan_item_to_day", { planItemId, day });
  }

  listFocusItems(day: string): Promise<FocusItem[]> {
    return invoke("list_focus_items", { day });
  }

  setCurrentFocusItem(id: string): Promise<FocusItem> {
    return invoke("set_current_focus_item", { id });
  }

  setFocusItemCompleted(id: string, completed: boolean): Promise<FocusItem> {
    return invoke("set_focus_item_completed", { id, completed });
  }

  removeFocusItem(id: string): Promise<void> {
    return invoke("remove_focus_item", { id });
  }

  getDailyNote(day: string): Promise<DailyNote | null> {
    return invoke("get_daily_note", { day });
  }

  saveDailyNote(day: string, content: string): Promise<DailyNote | null> {
    return invoke("save_daily_note", { day, content });
  }

  listDailyRecords(): Promise<DailyRecord[]> {
    return invoke("list_daily_records");
  }

  subscribe(listener: () => void): Promise<() => void> {
    return listen("planning://changed", listener);
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

  setAutoCollapseCaptureBar(enabled: boolean): Promise<AppSettings> {
    return invoke("set_auto_collapse_capture_bar", { enabled });
  }

  setCaptureBarCollapseDelay(delayMs: number): Promise<AppSettings> {
    return invoke("set_capture_bar_collapse_delay", { delayMs });
  }

  setCaptureBarAlwaysOnTop(enabled: boolean): Promise<AppSettings> {
    return invoke("set_capture_bar_always_on_top", { enabled });
  }

  setRememberCaptureBarPosition(enabled: boolean): Promise<AppSettings> {
    return invoke("set_remember_capture_bar_position", { enabled });
  }

  setCaptureBarMode(mode: CaptureBarMode): Promise<void> {
    return invoke("set_capture_bar_mode", { mode });
  }

  startCaptureBarDrag(): Promise<void> {
    return invoke("start_capture_bar_drag");
  }

  showFocusWindow(): Promise<void> {
    return invoke("show_focus_window");
  }

  hideFocusWindow(): Promise<void> {
    return invoke("hide_focus_window");
  }

  setFocusWindowMode(mode: FocusWindowMode): Promise<void> {
    return invoke("set_focus_window_mode", { mode });
  }

  startFocusWindowDrag(): Promise<void> {
    return invoke("start_focus_window_drag");
  }

  openMainView(view: MainView): Promise<void> {
    return invoke("open_main_view", { view });
  }

  setKeepFocusWindowVisible(enabled: boolean): Promise<AppSettings> {
    return invoke("set_keep_focus_window_visible", { enabled });
  }

  setAutoCollapseFocusWindow(enabled: boolean): Promise<AppSettings> {
    return invoke("set_auto_collapse_focus_window", { enabled });
  }

  subscribeCaptureBarActivation(listener: () => void): Promise<() => void> {
    return listen("capture://activated", listener);
  }

  subscribeFocusWindowActivation(listener: () => void): Promise<() => void> {
    return listen("focus://activated", listener);
  }

  subscribeMainNavigation(listener: (view: MainView) => void): Promise<() => void> {
    return listen<MainView>("main://navigate", (event) => listener(event.payload));
  }

  subscribeSettingsChange(listener: () => void): Promise<() => void> {
    return listen("settings://changed", listener);
  }
}
