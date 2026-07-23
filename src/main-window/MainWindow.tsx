import { useEffect, useState } from "react";
import { useServices } from "../application/services-context";
import type { MainView } from "../application/ports";
import { InboxPage } from "../inbox/InboxPage";
import { HistoryPage } from "../planning/HistoryPage";
import { PlansPage } from "../planning/PlansPage";
import { TodayFocusPage } from "../planning/TodayFocusPage";
import { SettingsPanel } from "../settings/SettingsPanel";
import {
  HistoryIcon,
  InboxIcon,
  PlanIcon,
  SettingsIcon,
  SparkIcon,
  TodayIcon,
} from "../shared/icons";

const views: Array<{
  value: MainView;
  label: string;
  icon: typeof InboxIcon;
}> = [
  { value: "inbox", label: "稍后看", icon: InboxIcon },
  { value: "today", label: "今日专注", icon: TodayIcon },
  { value: "plans", label: "计划", icon: PlanIcon },
  { value: "history", label: "每日历史", icon: HistoryIcon },
];

export function MainWindow() {
  const { desktop } = useServices();
  const [view, setView] = useState<MainView>(() => initialView());
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let disposed = false;
    void desktop.subscribeMainNavigation(setView).then((stop) => {
      if (disposed) stop();
      else unsubscribe = stop;
    });
    return () => {
      disposed = true;
      unsubscribe?.();
    };
  }, [desktop]);

  return (
    <main className="inbox-layout">
      <aside className="sidebar">
        <div className="brand" aria-label="Flashnote">
          <SparkIcon />
        </div>
        <nav>
          {views.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.value}
                className={`sidebar-item ${view === item.value ? "is-active" : ""}`}
                onClick={() => setView(item.value)}
              >
                <Icon />
                {item.label}
              </button>
            );
          })}
        </nav>
        <div className="sidebar-spacer" />
        <button className="sidebar-item" onClick={() => setSettingsOpen(true)}>
          <SettingsIcon />
          设置
        </button>
      </aside>

      {view === "inbox" ? <InboxPage /> : null}
      {view === "today" ? <TodayFocusPage onOpenPlans={() => setView("plans")} /> : null}
      {view === "plans" ? <PlansPage /> : null}
      {view === "history" ? <HistoryPage /> : null}

      {settingsOpen ? <SettingsPanel onClose={() => setSettingsOpen(false)} /> : null}
    </main>
  );
}

function initialView(): MainView {
  const value = new URLSearchParams(window.location.search).get("view");
  return value === "today" || value === "plans" || value === "history"
    ? value
    : "inbox";
}
