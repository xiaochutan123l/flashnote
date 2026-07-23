import { useEffect, useMemo, useRef, useState } from "react";
import { useServices } from "../application/services-context";
import type { FocusItem } from "../domain/planning";
import { formatDay, localDayKey } from "../domain/planning";
import { CheckIcon, PlanIcon, SparkIcon, TodayIcon } from "../shared/icons";
import { useTodayPlanning } from "./use-planning";

export function TodayFocusPage({
  onOpenPlans,
}: {
  onOpenPlans(): void;
}) {
  const { planning, desktop } = useServices();
  const day = localDayKey();
  const { plans, focusItems, note, loading, error } = useTodayPlanning(day);
  const [noteText, setNoteText] = useState("");
  const [noteState, setNoteState] = useState<"idle" | "saving" | "saved">("idle");
  const [menu, setMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const noteInitialized = useRef(false);

  const selectedPlanIds = useMemo(
    () => new Set(focusItems.map((item) => item.planItemId)),
    [focusItems],
  );
  const availablePlans = plans.filter(
    (item) => !item.completedAt && !selectedPlanIds.has(item.id),
  );
  const menuItem = focusItems.find((item) => item.id === menu?.id);

  useEffect(() => {
    if (noteInitialized.current || loading) return;
    noteInitialized.current = true;
    setNoteText(note?.content ?? "");
  }, [loading, note]);

  useEffect(() => {
    if (!noteInitialized.current || noteText.trim() === (note?.content ?? "")) return;
    setNoteState("saving");
    const timeout = window.setTimeout(() => {
      void planning
        .saveDailyNote(day, noteText)
        .then(() => {
          setNoteState("saved");
          window.setTimeout(() => setNoteState("idle"), 1_200);
        })
        .catch(() => setNoteState("idle"));
    }, 650);
    return () => window.clearTimeout(timeout);
  }, [day, note?.content, noteText, planning]);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    window.addEventListener("pointerdown", close);
    window.addEventListener("blur", close);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("blur", close);
    };
  }, [menu]);

  async function setCurrent(item: FocusItem) {
    if (!item.completedAt) await planning.setCurrentFocusItem(item.id);
  }

  async function toggleCompleted(item: FocusItem) {
    await planning.setFocusItemCompleted(item.id, !item.completedAt);
    setMenu(null);
  }

  return (
    <section className="main-content">
      <header className="inbox-header focus-page-header">
        <div>
          <p className="eyebrow">今日专注 · {formatDay(day)}</p>
          <h1>今天主要就做这些</h1>
          <p>圆点表示你此刻要回到的事情；右键事项可以标记完成。</p>
        </div>
        <button className="primary-button" onClick={() => void desktop.showFocusWindow()}>
          <TodayIcon />
          显示浮窗
        </button>
      </header>

      {error ? <p className="inline-error">{error}</p> : null}

      <div className="focus-page-grid">
        <div className="focus-day-column">
          <div className="section-heading">
            <div>
              <h2>{formatDay(day, { year: "numeric" })}</h2>
              <span>{focusItems.filter((item) => item.completedAt).length}/{focusItems.length} 已完成</span>
            </div>
          </div>

          <div className="focus-day-list">
            {loading ? <p className="state-message state-message--compact">正在读取今日事项…</p> : null}
            {!loading && focusItems.length === 0 ? (
              <div className="focus-empty">
                <TodayIcon />
                <strong>今天还没有选择主要事项</strong>
                <p>从右侧计划中选几件真正重要的事。</p>
              </div>
            ) : null}
            {focusItems.map((item) => (
              <div
                key={item.id}
                className={`focus-item ${item.isCurrent ? "is-current" : ""} ${
                  item.completedAt ? "is-completed" : ""
                }`}
                onContextMenu={(event) => {
                  event.preventDefault();
                  setMenu({ id: item.id, x: event.clientX, y: event.clientY });
                }}
              >
                <button
                  className="focus-status"
                  aria-label={item.isCurrent ? "当前专注" : "设为当前专注"}
                  disabled={Boolean(item.completedAt)}
                  onClick={() => void setCurrent(item)}
                >
                  {item.completedAt ? <CheckIcon /> : item.isCurrent ? <span /> : null}
                </button>
                <span className="focus-item-title">{item.title}</span>
              </div>
            ))}
          </div>

          <div className="daily-note">
            <div className="section-heading">
              <div>
                <h2>今天的随笔</h2>
                <span>{noteState === "saving" ? "保存中…" : noteState === "saved" ? "已自动保存" : "自动存档到每日历史"}</span>
              </div>
            </div>
            <textarea
              value={noteText}
              maxLength={5_000}
              placeholder="一天快结束时，写几句今天做了什么、想到了什么…"
              onChange={(event) => setNoteText(event.target.value)}
            />
          </div>
        </div>

        <aside className="plan-picker">
          <div className="section-heading">
            <div>
              <h2>从计划中选择</h2>
              <span>只放今天真正要推进的事项</span>
            </div>
          </div>
          <div className="plan-picker-list">
            {availablePlans.slice(0, 12).map((item) => (
              <button
                key={item.id}
                onClick={() => void planning.addPlanItemToDay(item.id, day)}
              >
                <PlanIcon />
                <span>{item.title}</span>
                <b>＋</b>
              </button>
            ))}
            {availablePlans.length === 0 ? (
              <div className="plan-picker-empty">
                <SparkIcon />
                <span>{plans.length ? "可选计划都已加入今天" : "还没有长期计划"}</span>
              </div>
            ) : null}
          </div>
          <button className="secondary-button plan-picker-manage" onClick={onOpenPlans}>
            管理计划
          </button>
        </aside>
      </div>

      {menu && menuItem ? (
        <div
          className="context-menu"
          style={{ left: menu.x, top: menu.y }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <button onClick={() => void toggleCompleted(menuItem)}>
            {menuItem.completedAt ? "恢复为未完成" : "标记为已完成"}
          </button>
          <button
            className="is-danger"
            onClick={() => {
              setMenu(null);
              void planning.removeFocusItem(menuItem.id);
            }}
          >
            从今天移除
          </button>
        </div>
      ) : null}
    </section>
  );
}
