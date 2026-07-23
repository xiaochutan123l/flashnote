import {
  type FocusEvent as ReactFocusEvent,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { useServices } from "../application/services-context";
import type { FocusItem } from "../domain/planning";
import { formatDay, localDayKey } from "../domain/planning";
import {
  CheckIcon,
  PlanIcon,
  SparkIcon,
  TodayIcon,
} from "../shared/icons";
import {
  IdleCollapseController,
  type IdleCollapsePhase,
} from "../shared/idle-collapse-controller";
import { useTodayPlanning } from "../planning/use-planning";

export function FocusWindow() {
  const { planning, desktop } = useServices();
  const day = localDayKey();
  const { focusItems, loading, error } = useTodayPlanning(day);
  const [phase, setPhase] = useState<IdleCollapsePhase>("expanded");
  const rootRef = useRef<HTMLElement>(null);
  const controllerRef = useRef<IdleCollapseController | null>(null);

  if (!controllerRef.current) {
    controllerRef.current = new IdleCollapseController(setPhase);
  }
  const controller = controllerRef.current;
  const current = focusItems.find((item) => item.isCurrent && !item.completedAt);

  useEffect(() => {
    return () => controller.dispose();
  }, [controller]);

  useEffect(() => {
    void desktop
      .setFocusWindowMode(phase === "collapsed" ? "collapsed" : "expanded")
      .catch(() => undefined);
  }, [desktop, phase]);

  useEffect(() => {
    let unsubscribeSettings: (() => void) | undefined;
    let unsubscribeActivation: (() => void) | undefined;
    let disposed = false;

    const configure = async () => {
      const settings = await desktop.getSettings();
      if (disposed) return;
      controller.configure({
        enabled: settings.autoCollapseFocusWindow,
        delayMs: settings.captureBarCollapseDelayMs,
      });
    };

    void configure();
    void desktop.subscribeSettingsChange(configure).then((stop) => {
      if (disposed) stop();
      else unsubscribeSettings = stop;
    });
    void desktop.subscribeFocusWindowActivation(() => {
      controller.forceExpanded();
    }).then((stop) => {
      if (disposed) stop();
      else unsubscribeActivation = stop;
    });

    return () => {
      disposed = true;
      unsubscribeSettings?.();
      unsubscribeActivation?.();
    };
  }, [controller, desktop]);

  useEffect(() => {
    const blur = () => controller.setFocusWithin(false);
    window.addEventListener("blur", blur);
    return () => window.removeEventListener("blur", blur);
  }, [controller]);

  function handleFocus(event: ReactFocusEvent<HTMLElement>) {
    if (event.currentTarget.contains(event.target)) {
      controller.setFocusWithin(true);
    }
  }

  function handleBlur(event: ReactFocusEvent<HTMLElement>) {
    const next = event.relatedTarget;
    if (!next || !event.currentTarget.contains(next as Node)) {
      controller.setFocusWithin(false);
    }
  }

  async function startDragging(event: ReactPointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    controller.forceExpanded();
    await desktop.startFocusWindowDrag();
  }

  async function setCurrent(item: FocusItem) {
    if (!item.completedAt) await planning.setCurrentFocusItem(item.id);
  }

  if (phase === "collapsed") {
    return (
      <main
        className="focus-window-shell focus-window-shell--collapsed"
        onPointerEnter={() => controller.setPointerInside(true)}
        onPointerLeave={() => controller.setPointerInside(false)}
      >
        <div className="focus-window-collapsed">
          <span className={`focus-mini-status ${current ? "is-current" : ""}`}>
            {current ? <i /> : <TodayIcon />}
          </span>
          <strong>{current?.title ?? "尚未指定当前专注"}</strong>
          <button
            title="记下一个新念头"
            aria-label="记下一个新念头"
            onClick={() => void desktop.showCaptureBar()}
          >
            <SparkIcon />
          </button>
        </div>
      </main>
    );
  }

  return (
    <main
      ref={rootRef}
      className="focus-window-shell"
      onPointerEnter={() => controller.setPointerInside(true)}
      onPointerLeave={() => controller.setPointerInside(false)}
      onFocusCapture={handleFocus}
      onBlurCapture={handleBlur}
    >
      <section className="focus-window-card">
        <header>
          <button
            className="focus-window-drag"
            title="拖动今日专注"
            aria-label="拖动今日专注"
            onPointerDown={(event) => void startDragging(event)}
          >
            <span />
          </button>
          <div>
            <p>今日专注</p>
            <strong>{formatDay(day)}</strong>
          </div>
          <button
            className="focus-window-close"
            aria-label="隐藏今日专注"
            onClick={() => void desktop.hideFocusWindow()}
          >
            ×
          </button>
        </header>

        <div className="focus-window-list">
          {loading ? <p className="focus-window-message">正在读取…</p> : null}
          {error ? <p className="focus-window-message is-error">{error}</p> : null}
          {!loading && !error && focusItems.length === 0 ? (
            <button
              className="focus-window-empty"
              onClick={() => void desktop.openMainView("today")}
            >
              <PlanIcon />
              <span>去选择今天主要要做的事</span>
            </button>
          ) : null}
          {focusItems.map((item) => (
            <div
              key={item.id}
              className={`focus-window-item ${item.isCurrent ? "is-current" : ""} ${
                item.completedAt ? "is-completed" : ""
              }`}
              onContextMenu={(event) => {
                event.preventDefault();
                void planning.setFocusItemCompleted(item.id, !item.completedAt);
              }}
            >
              <button
                className="focus-status"
                disabled={Boolean(item.completedAt)}
                aria-label={item.isCurrent ? "当前专注" : "设为当前专注"}
                onClick={() => void setCurrent(item)}
              >
                {item.completedAt ? <CheckIcon /> : item.isCurrent ? <span /> : null}
              </button>
              <span>{item.title}</span>
            </div>
          ))}
        </div>

        <footer>
          <span>右键事项可标记完成</span>
          <div>
            <button onClick={() => void desktop.showCaptureBar()}>
              <SparkIcon /> 灵感
            </button>
            <button onClick={() => void desktop.openMainView("today")}>
              打开列表
            </button>
          </div>
        </footer>
      </section>
    </main>
  );
}
