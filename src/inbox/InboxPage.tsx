import { useMemo, useState } from "react";
import type { Capture, CaptureFilter } from "../domain/capture";
import { useServices } from "../application/services-context";
import { SparkIcon } from "../shared/icons";
import { CaptureRow } from "./CaptureRow";
import { useCaptures } from "./use-captures";

const filters: Array<{ value: CaptureFilter; label: string }> = [
  { value: "all", label: "全部" },
  { value: "inbox", label: "未处理" },
  { value: "processed", label: "已处理" },
];

export function InboxPage() {
  const { captures: captureService, desktop } = useServices();
  const [filter, setFilter] = useState<CaptureFilter>("all");
  const [toast, setToast] = useState<{ message: string; undo?: () => void } | null>(null);
  const { captures, loading, error, refresh } = useCaptures(filter);

  const todayCount = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return captures.filter((capture) => capture.createdAt >= start.getTime()).length;
  }, [captures]);

  function showToast(message: string, undo?: () => void) {
    setToast({ message, undo });
    window.setTimeout(() => setToast(null), 4200);
  }

  async function update(id: string, content: string) {
    await captureService.update(id, content);
    await refresh();
  }

  async function toggle(capture: Capture) {
    await captureService.setStatus(
      capture.id,
      capture.status === "inbox" ? "processed" : "inbox",
    );
    await refresh();
  }

  async function remove(capture: Capture) {
    await captureService.delete(capture.id);
    await refresh();
    showToast("记录已删除", () => {
      void captureService.restore(capture.id).then(refresh);
      setToast(null);
    });
  }

  return (
    <>
      <section className="main-content">
        <header className="inbox-header">
          <div>
            <p className="eyebrow">念头收件箱</p>
            <h1>稍后看</h1>
            <p>先收下来，别打断当下。</p>
          </div>
          <button className="primary-button" onClick={() => void desktop.showCaptureBar()}>
            <SparkIcon />
            快速记录
            <kbd>⌘⇧Space</kbd>
          </button>
        </header>

        <div className="inbox-toolbar">
          <div className="segmented-control" aria-label="筛选记录">
            {filters.map((item) => (
              <button
                key={item.value}
                className={filter === item.value ? "is-active" : ""}
                onClick={() => setFilter(item.value)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <span>今天收集 <strong>{todayCount}</strong> 条</span>
        </div>

        <div className="capture-list" aria-live="polite">
          {loading ? <p className="state-message">正在读取记录…</p> : null}
          {error ? <p className="state-message state-message--error">{error}</p> : null}
          {!loading && !error && captures.length === 0 ? (
            <div className="empty-state">
              <span><SparkIcon /></span>
              <h2>{filter === "all" ? "还没有需要稍后看的念头" : "这里暂时是空的"}</h2>
              <p>按下快捷键，随手记下一句话，然后继续当前工作。</p>
              <kbd>⌘ / Ctrl · ⇧ · Space</kbd>
            </div>
          ) : null}
          {captures.map((capture) => (
            <CaptureRow
              key={capture.id}
              capture={capture}
              onUpdate={update}
              onToggle={toggle}
              onDelete={remove}
            />
          ))}
        </div>
      </section>

      {toast ? (
        <div className="toast" role="status">
          {toast.message}
          {toast.undo ? <button onClick={toast.undo}>撤销</button> : null}
        </div>
      ) : null}
    </>
  );
}
