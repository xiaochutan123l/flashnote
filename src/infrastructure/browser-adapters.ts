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

const STORAGE_KEY = "flashnote.browser.captures";
const SETTINGS_STORAGE_KEY = "flashnote.browser.settings";
const PLANS_STORAGE_KEY = "flashnote.browser.plans";
const FOCUS_STORAGE_KEY = "flashnote.browser.focus";
const NOTES_STORAGE_KEY = "flashnote.browser.daily-notes";
const CHANGE_EVENT = "flashnote:captures-changed";
const PLANNING_CHANGE_EVENT = "flashnote:planning-changed";
const SETTINGS_CHANGE_EVENT = "flashnote:settings-changed";

const defaultSettings: AppSettings = {
  launchAtLogin: false,
  shortcut: "CommandOrControl+Shift+Space",
  keepCaptureBarVisible: false,
  autoCollapseCaptureBar: true,
  captureBarCollapseDelayMs: 3_000,
  captureBarAlwaysOnTop: true,
  rememberCaptureBarPosition: true,
  keepFocusWindowVisible: false,
  autoCollapseFocusWindow: true,
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
  window.dispatchEvent(new Event(SETTINGS_CHANGE_EVENT));
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

function readJson<T>(key: string, fallback: T): T {
  const raw = localStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writePlanning<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new Event(PLANNING_CHANGE_EVENT));
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

export class BrowserPlanningGateway implements PlanningGateway {
  async createPlanItem(title: string, parentId: string | null): Promise<PlanItem> {
    const now = Date.now();
    const item: PlanItem = {
      id: crypto.randomUUID(),
      title,
      parentId,
      position: now,
      createdAt: now,
      updatedAt: now,
      completedAt: null,
    };
    writePlanning(PLANS_STORAGE_KEY, [...this.plans(), item]);
    return item;
  }

  async listPlanItems(): Promise<PlanItem[]> {
    return this.plans().sort(
      (left, right) => left.position - right.position,
    );
  }

  async updatePlanItem(id: string, title: string): Promise<PlanItem> {
    return this.changePlan(id, (item) => ({
      ...item,
      title,
      updatedAt: Date.now(),
    }));
  }

  async setPlanItemCompleted(id: string, completed: boolean): Promise<PlanItem> {
    return this.changePlan(id, (item) => ({
      ...item,
      completedAt: completed ? Date.now() : null,
      updatedAt: Date.now(),
    }));
  }

  async deletePlanItem(id: string): Promise<void> {
    const removed = new Set([id]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const item of this.plans()) {
        if (item.parentId && removed.has(item.parentId) && !removed.has(item.id)) {
          removed.add(item.id);
          changed = true;
        }
      }
    }
    writePlanning(
      PLANS_STORAGE_KEY,
      this.plans().filter((item) => !removed.has(item.id)),
    );
  }

  async addPlanItemToDay(planItemId: string, day: string): Promise<FocusItem> {
    const plan = this.plans().find((item) => item.id === planItemId);
    if (!plan) throw new Error("记录不存在");
    const focusItems = this.focusItems();
    if (focusItems.some((item) => item.day === day && item.planItemId === planItemId)) {
      throw new Error("这项计划已经加入当天专注");
    }
    const now = Date.now();
    const item: FocusItem = {
      id: crypto.randomUUID(),
      day,
      planItemId,
      title: plan.title,
      position: now,
      isCurrent: false,
      createdAt: now,
      updatedAt: now,
      completedAt: null,
    };
    writePlanning(FOCUS_STORAGE_KEY, [...focusItems, item]);
    return item;
  }

  async listFocusItems(day: string): Promise<FocusItem[]> {
    return this.focusItems()
      .filter((item) => item.day === day)
      .sort((left, right) => left.position - right.position);
  }

  async setCurrentFocusItem(id: string): Promise<FocusItem> {
    const selected = this.focusItems().find((item) => item.id === id);
    if (!selected) throw new Error("记录不存在");
    if (selected.completedAt) throw new Error("已完成事项不能设为当前专注");
    const now = Date.now();
    let changed: FocusItem | undefined;
    const items = this.focusItems().map((item) => {
      if (item.day !== selected.day) return item;
      const next = {
        ...item,
        isCurrent: item.id === id,
        updatedAt: now,
      };
      if (item.id === id) changed = next;
      return next;
    });
    writePlanning(FOCUS_STORAGE_KEY, items);
    return changed!;
  }

  async setFocusItemCompleted(id: string, completed: boolean): Promise<FocusItem> {
    return this.changeFocus(id, (item) => ({
      ...item,
      completedAt: completed ? Date.now() : null,
      isCurrent: completed ? false : item.isCurrent,
      updatedAt: Date.now(),
    }));
  }

  async removeFocusItem(id: string): Promise<void> {
    writePlanning(
      FOCUS_STORAGE_KEY,
      this.focusItems().filter((item) => item.id !== id),
    );
  }

  async getDailyNote(day: string): Promise<DailyNote | null> {
    return this.notes().find((note) => note.day === day) ?? null;
  }

  async saveDailyNote(day: string, content: string): Promise<DailyNote | null> {
    const notes = this.notes().filter((note) => note.day !== day);
    if (!content) {
      writePlanning(NOTES_STORAGE_KEY, notes);
      return null;
    }
    const note = { day, content, updatedAt: Date.now() };
    writePlanning(NOTES_STORAGE_KEY, [...notes, note]);
    return note;
  }

  async listDailyRecords(): Promise<DailyRecord[]> {
    const days = new Set([
      ...this.focusItems().map((item) => item.day),
      ...this.notes().map((note) => note.day),
    ]);
    return [...days]
      .sort((left, right) => right.localeCompare(left))
      .map((day) => ({
        day,
        focusItems: this.focusItems()
          .filter((item) => item.day === day)
          .sort((left, right) => left.position - right.position),
        note: this.notes().find((note) => note.day === day) ?? null,
      }));
  }

  async subscribe(listener: () => void): Promise<() => void> {
    window.addEventListener(PLANNING_CHANGE_EVENT, listener);
    return () => window.removeEventListener(PLANNING_CHANGE_EVENT, listener);
  }

  private plans(): PlanItem[] {
    return readJson<PlanItem[]>(PLANS_STORAGE_KEY, []);
  }

  private focusItems(): FocusItem[] {
    return readJson<FocusItem[]>(FOCUS_STORAGE_KEY, []);
  }

  private notes(): DailyNote[] {
    return readJson<DailyNote[]>(NOTES_STORAGE_KEY, []);
  }

  private changePlan(
    id: string,
    mutate: (item: PlanItem) => PlanItem,
  ): PlanItem {
    let changed: PlanItem | undefined;
    const items = this.plans().map((item) => {
      if (item.id !== id) return item;
      changed = mutate(item);
      return changed;
    });
    if (!changed) throw new Error("记录不存在");
    writePlanning(PLANS_STORAGE_KEY, items);
    return changed;
  }

  private changeFocus(
    id: string,
    mutate: (item: FocusItem) => FocusItem,
  ): FocusItem {
    let changed: FocusItem | undefined;
    const items = this.focusItems().map((item) => {
      if (item.id !== id) return item;
      changed = mutate(item);
      return changed;
    });
    if (!changed) throw new Error("记录不存在");
    writePlanning(FOCUS_STORAGE_KEY, items);
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

  async setAutoCollapseCaptureBar(enabled: boolean): Promise<AppSettings> {
    return writeSettings({
      ...readSettings(),
      autoCollapseCaptureBar: enabled,
    });
  }

  async setCaptureBarCollapseDelay(delayMs: number): Promise<AppSettings> {
    return writeSettings({
      ...readSettings(),
      captureBarCollapseDelayMs: delayMs,
    });
  }

  async setCaptureBarAlwaysOnTop(enabled: boolean): Promise<AppSettings> {
    return writeSettings({
      ...readSettings(),
      captureBarAlwaysOnTop: enabled,
    });
  }

  async setRememberCaptureBarPosition(enabled: boolean): Promise<AppSettings> {
    return writeSettings({
      ...readSettings(),
      rememberCaptureBarPosition: enabled,
    });
  }

  async setCaptureBarMode(mode: CaptureBarMode): Promise<void> {
    document.documentElement.dataset.captureMode = mode;
  }

  async startCaptureBarDrag(): Promise<void> {}

  async showFocusWindow(): Promise<void> {
    window.location.search = "?window=focus";
  }

  async hideFocusWindow(): Promise<void> {}

  async setFocusWindowMode(mode: FocusWindowMode): Promise<void> {
    document.documentElement.dataset.focusMode = mode;
  }

  async startFocusWindowDrag(): Promise<void> {}

  async openMainView(view: MainView): Promise<void> {
    window.location.search = `?window=inbox&view=${view}`;
  }

  async setKeepFocusWindowVisible(enabled: boolean): Promise<AppSettings> {
    return writeSettings({
      ...readSettings(),
      keepFocusWindowVisible: enabled,
    });
  }

  async setAutoCollapseFocusWindow(enabled: boolean): Promise<AppSettings> {
    return writeSettings({
      ...readSettings(),
      autoCollapseFocusWindow: enabled,
    });
  }

  async subscribeCaptureBarActivation(): Promise<() => void> {
    return () => undefined;
  }

  async subscribeFocusWindowActivation(): Promise<() => void> {
    return () => undefined;
  }

  async subscribeMainNavigation(): Promise<() => void> {
    return () => undefined;
  }

  async subscribeSettingsChange(listener: () => void): Promise<() => void> {
    window.addEventListener(SETTINGS_CHANGE_EVENT, listener);
    return () => window.removeEventListener(SETTINGS_CHANGE_EVENT, listener);
  }
}
