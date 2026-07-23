import { useMemo } from "react";
import { formatDay } from "../domain/planning";
import { CheckIcon, HistoryIcon, SparkIcon } from "../shared/icons";
import { useCaptures } from "../inbox/use-captures";
import { useDailyRecords } from "./use-planning";

export function HistoryPage() {
  const { records, loading, error } = useDailyRecords();
  const { captures: processedCaptures } = useCaptures("processed");

  const processedByDay = useMemo(() => {
    const groups = new Map<string, typeof processedCaptures>();
    for (const capture of processedCaptures) {
      const timestamp = capture.processedAt ?? capture.updatedAt;
      const date = new Date(timestamp);
      const day = [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, "0"),
        String(date.getDate()).padStart(2, "0"),
      ].join("-");
      groups.set(day, [...(groups.get(day) ?? []), capture]);
    }
    return groups;
  }, [processedCaptures]);

  const recordsByDay = new Map(records.map((record) => [record.day, record]));
  const days = [...new Set([...recordsByDay.keys(), ...processedByDay.keys()])].sort(
    (left, right) => right.localeCompare(left),
  );

  return (
    <section className="main-content">
      <header className="inbox-header">
        <div>
          <p className="eyebrow">每日历史</p>
          <h1>回头看每天做了什么</h1>
          <p>今日专注、完成情况、随笔和已处理灵感按日期自然归档。</p>
        </div>
      </header>

      {error ? <p className="inline-error">{error}</p> : null}
      {loading ? <p className="state-message">正在读取每日记录…</p> : null}
      {!loading && days.length === 0 ? (
        <div className="empty-state">
          <span><HistoryIcon /></span>
          <h2>还没有每日记录</h2>
          <p>选入今日专注或写下每日随笔后，这里会自动出现历史。</p>
        </div>
      ) : null}

      <div className="history-list">
        {days.map((day) => {
          const record = recordsByDay.get(day);
          const focusItems = record?.focusItems ?? [];
          const captures = processedByDay.get(day) ?? [];
          const completed = focusItems.filter((item) => item.completedAt).length;
          return (
            <article className="history-day" key={day}>
              <header>
                <div>
                  <h2>{formatDay(day, { year: "numeric" })}</h2>
                  <span>{focusItems.length ? `${completed}/${focusItems.length} 项完成` : "没有专注事项"}</span>
                </div>
                <time>{day}</time>
              </header>
              {focusItems.length ? (
                <div className="history-focus-items">
                  {focusItems.map((item) => (
                    <div key={item.id} className={item.completedAt ? "is-completed" : ""}>
                      <span>{item.completedAt ? <CheckIcon /> : null}</span>
                      {item.title}
                    </div>
                  ))}
                </div>
              ) : null}
              {record?.note ? <p className="history-note">{record.note.content}</p> : null}
              {captures.length ? (
                <div className="history-captures">
                  <strong><SparkIcon /> 已处理灵感</strong>
                  {captures.map((capture) => <p key={capture.id}>{capture.content}</p>)}
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}
