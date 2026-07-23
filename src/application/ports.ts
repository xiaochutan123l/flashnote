import type { Capture, CaptureFilter, CaptureStatus } from "../domain/capture";
import type {
  DailyNote,
  DailyRecord,
  FocusItem,
  PlanItem,
} from "../domain/planning";

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

export interface PlanningGateway {
  createPlanItem(title: string, parentId: string | null): Promise<PlanItem>;
  listPlanItems(): Promise<PlanItem[]>;
  updatePlanItem(id: string, title: string): Promise<PlanItem>;
  setPlanItemCompleted(id: string, completed: boolean): Promise<PlanItem>;
  deletePlanItem(id: string): Promise<void>;
  addPlanItemToDay(planItemId: string, day: string): Promise<FocusItem>;
  listFocusItems(day: string): Promise<FocusItem[]>;
  setCurrentFocusItem(id: string): Promise<FocusItem>;
  setFocusItemCompleted(id: string, completed: boolean): Promise<FocusItem>;
  removeFocusItem(id: string): Promise<void>;
  getDailyNote(day: string): Promise<DailyNote | null>;
  saveDailyNote(day: string, content: string): Promise<DailyNote | null>;
  listDailyRecords(): Promise<DailyRecord[]>;
  subscribe(listener: () => void): Promise<() => void>;
}

export interface AppSettings {
  launchAtLogin: boolean;
  shortcut: string;
  keepCaptureBarVisible: boolean;
  autoCollapseCaptureBar: boolean;
  captureBarCollapseDelayMs: number;
  captureBarAlwaysOnTop: boolean;
  rememberCaptureBarPosition: boolean;
  keepFocusWindowVisible: boolean;
  autoCollapseFocusWindow: boolean;
}

export type CaptureBarMode = "expanded" | "collapsed";
export type FocusWindowMode = "expanded" | "collapsed";
export type MainView = "inbox" | "today" | "plans" | "history";

/** OS/window operations are isolated so presentation code remains testable. */
export interface DesktopGateway {
  hideCaptureBar(): Promise<void>;
  showCaptureBar(): Promise<void>;
  openInbox(): Promise<void>;
  getSettings(): Promise<AppSettings>;
  setLaunchAtLogin(enabled: boolean): Promise<AppSettings>;
  setKeepCaptureBarVisible(enabled: boolean): Promise<AppSettings>;
  setAutoCollapseCaptureBar(enabled: boolean): Promise<AppSettings>;
  setCaptureBarCollapseDelay(delayMs: number): Promise<AppSettings>;
  setCaptureBarAlwaysOnTop(enabled: boolean): Promise<AppSettings>;
  setRememberCaptureBarPosition(enabled: boolean): Promise<AppSettings>;
  setCaptureBarMode(mode: CaptureBarMode): Promise<void>;
  startCaptureBarDrag(): Promise<void>;
  showFocusWindow(): Promise<void>;
  hideFocusWindow(): Promise<void>;
  setFocusWindowMode(mode: FocusWindowMode): Promise<void>;
  startFocusWindowDrag(): Promise<void>;
  openMainView(view: MainView): Promise<void>;
  setKeepFocusWindowVisible(enabled: boolean): Promise<AppSettings>;
  setAutoCollapseFocusWindow(enabled: boolean): Promise<AppSettings>;
  subscribeCaptureBarActivation(listener: () => void): Promise<() => void>;
  subscribeFocusWindowActivation(listener: () => void): Promise<() => void>;
  subscribeMainNavigation(listener: (view: MainView) => void): Promise<() => void>;
  subscribeSettingsChange(listener: () => void): Promise<() => void>;
}
