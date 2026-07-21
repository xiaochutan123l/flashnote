import { FormEvent, useState } from "react";
import type { Capture } from "../domain/capture";
import { CheckIcon, EditIcon, SparkIcon, TrashIcon } from "../shared/icons";

interface CaptureRowProps {
  capture: Capture;
  onUpdate(id: string, content: string): Promise<void>;
  onToggle(capture: Capture): Promise<void>;
  onDelete(capture: Capture): Promise<void>;
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  return new Intl.DateTimeFormat("zh-CN", {
    ...(sameDay ? {} : { month: "numeric", day: "numeric" }),
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export function CaptureRow({
  capture,
  onUpdate,
  onToggle,
  onDelete,
}: CaptureRowProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(capture.content);

  async function submit(event: FormEvent) {
    event.preventDefault();
    await onUpdate(capture.id, draft);
    setEditing(false);
  }

  return (
    <article className={`capture-row ${capture.status === "processed" ? "is-processed" : ""}`}>
      <span className="capture-row__icon" aria-hidden="true">
        <SparkIcon />
      </span>
      <div className="capture-row__content">
        {editing ? (
          <form onSubmit={submit} className="capture-row__edit-form">
            <input
              autoFocus
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  setDraft(capture.content);
                  setEditing(false);
                }
              }}
              maxLength={500}
              aria-label="编辑记录"
            />
            <button type="submit">保存</button>
          </form>
        ) : (
          <p onDoubleClick={() => setEditing(true)}>{capture.content}</p>
        )}
        <time dateTime={new Date(capture.createdAt).toISOString()}>
          {formatTime(capture.createdAt)}
        </time>
      </div>
      <div className="capture-row__actions">
        <button
          className="icon-button"
          onClick={() => setEditing(true)}
          aria-label="编辑"
          title="编辑"
        >
          <EditIcon />
        </button>
        <button
          className="text-button"
          onClick={() => void onToggle(capture)}
          title={capture.status === "inbox" ? "标记为已处理" : "移回未处理"}
        >
          <CheckIcon />
          {capture.status === "inbox" ? "处理" : "恢复"}
        </button>
        <button
          className="icon-button icon-button--danger"
          onClick={() => void onDelete(capture)}
          aria-label="删除"
          title="删除"
        >
          <TrashIcon />
        </button>
      </div>
    </article>
  );
}

