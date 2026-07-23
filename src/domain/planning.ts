export interface PlanItem {
  id: string;
  title: string;
  parentId: string | null;
  position: number;
  createdAt: number;
  updatedAt: number;
  completedAt: number | null;
}

export interface FocusItem {
  id: string;
  day: string;
  planItemId: string;
  title: string;
  position: number;
  isCurrent: boolean;
  createdAt: number;
  updatedAt: number;
  completedAt: number | null;
}

export interface DailyNote {
  day: string;
  content: string;
  updatedAt: number;
}

export interface DailyRecord {
  day: string;
  focusItems: FocusItem[];
  note: DailyNote | null;
}

export const PLAN_TITLE_LIMIT = 120;
export const DAILY_NOTE_LIMIT = 5_000;

export function normalizePlanTitle(title: string): string {
  const normalized = title.trim().replace(/\s+/g, " ");
  if (!normalized) throw new Error("请输入计划事项");
  if ([...normalized].length > PLAN_TITLE_LIMIT) {
    throw new Error(`计划事项不能超过 ${PLAN_TITLE_LIMIT} 个字符`);
  }
  return normalized;
}

export function validateDailyNote(content: string): string {
  const normalized = content.trim().replace(/\r\n/g, "\n");
  if ([...normalized].length > DAILY_NOTE_LIMIT) {
    throw new Error(`每日随笔不能超过 ${DAILY_NOTE_LIMIT} 个字符`);
  }
  return normalized;
}

export function localDayKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatDay(day: string, options?: Intl.DateTimeFormatOptions): string {
  const [year, month, date] = day.split("-").map(Number);
  return new Intl.DateTimeFormat("zh-CN", {
    month: "long",
    day: "numeric",
    weekday: "short",
    ...options,
  }).format(new Date(year, month - 1, date));
}
