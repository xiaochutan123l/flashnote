import { FormEvent, useMemo, useState } from "react";
import { useServices } from "../application/services-context";
import type { PlanItem } from "../domain/planning";
import { localDayKey } from "../domain/planning";
import {
  CheckIcon,
  EditIcon,
  PlanIcon,
  PlusIcon,
  TrashIcon,
} from "../shared/icons";
import { useTodayPlanning } from "./use-planning";

interface TreeRow {
  item: PlanItem;
  depth: number;
}

export function PlansPage() {
  const { planning } = useServices();
  const day = localDayKey();
  const { plans, focusItems, loading, error } = useTodayPlanning(day);
  const [title, setTitle] = useState("");
  const [childParentId, setChildParentId] = useState<string | null>(null);
  const [childTitle, setChildTitle] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");

  const rows = useMemo(() => flattenPlanTree(plans), [plans]);
  const selectedIds = useMemo(
    () => new Set(focusItems.map((item) => item.planItemId)),
    [focusItems],
  );

  async function createRoot(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    await planning.createPlanItem(title);
    setTitle("");
  }

  async function createChild(event: FormEvent) {
    event.preventDefault();
    if (!childParentId || !childTitle.trim()) return;
    await planning.createPlanItem(childTitle, childParentId);
    setChildParentId(null);
    setChildTitle("");
  }

  async function saveEdit(event: FormEvent) {
    event.preventDefault();
    if (!editingId || !editingTitle.trim()) return;
    await planning.updatePlanItem(editingId, editingTitle);
    setEditingId(null);
    setEditingTitle("");
  }

  return (
    <section className="main-content">
      <header className="inbox-header">
        <div>
          <p className="eyebrow">长期计划</p>
          <h1>把复杂的事拆小</h1>
          <p>根事项可以代表一个项目，子事项按层级拆分；需要推进时选入今天。</p>
        </div>
      </header>

      <form className="plan-create-form" onSubmit={createRoot}>
        <PlanIcon />
        <input
          value={title}
          maxLength={120}
          placeholder="新建一个长期计划或项目…"
          onChange={(event) => setTitle(event.target.value)}
        />
        <button type="submit" disabled={!title.trim()}>添加</button>
      </form>

      {error ? <p className="inline-error">{error}</p> : null}
      <div className="plan-tree">
        {loading ? <p className="state-message">正在读取计划…</p> : null}
        {!loading && rows.length === 0 ? (
          <div className="empty-state">
            <span><PlanIcon /></span>
            <h2>还没有长期计划</h2>
            <p>先写下一个想完成的结果，再逐层拆成可以行动的小事项。</p>
          </div>
        ) : null}
        {rows.map(({ item, depth }) => (
          <div key={item.id}>
            <div
              className={`plan-row ${item.completedAt ? "is-completed" : ""}`}
              style={{ paddingLeft: `${10 + Math.min(depth, 6) * 24}px` }}
            >
              <button
                className="plan-check"
                aria-label={item.completedAt ? "恢复计划" : "完成计划"}
                onClick={() =>
                  void planning.setPlanItemCompleted(item.id, !item.completedAt)
                }
              >
                {item.completedAt ? <CheckIcon /> : null}
              </button>
              {editingId === item.id ? (
                <form className="plan-inline-edit" onSubmit={saveEdit}>
                  <input
                    autoFocus
                    value={editingTitle}
                    maxLength={120}
                    onChange={(event) => setEditingTitle(event.target.value)}
                    onBlur={() => setEditingId(null)}
                  />
                </form>
              ) : (
                <span className="plan-row-title">{item.title}</span>
              )}
              <div className="plan-row-actions">
                <button
                  title="添加子事项"
                  onClick={() => {
                    setChildParentId(item.id);
                    setChildTitle("");
                  }}
                >
                  <PlusIcon />
                </button>
                <button
                  title="编辑"
                  onClick={() => {
                    setEditingId(item.id);
                    setEditingTitle(item.title);
                  }}
                >
                  <EditIcon />
                </button>
                <button
                  className="plan-add-today"
                  disabled={selectedIds.has(item.id) || Boolean(item.completedAt)}
                  onClick={() => void planning.addPlanItemToDay(item.id, day)}
                >
                  {selectedIds.has(item.id) ? "已在今天" : "加入今天"}
                </button>
                <button
                  className="is-danger"
                  title="删除计划及其子事项"
                  onClick={() => {
                    if (window.confirm(`删除“${item.title}”及其所有子事项？`)) {
                      void planning.deletePlanItem(item.id);
                    }
                  }}
                >
                  <TrashIcon />
                </button>
              </div>
            </div>
            {childParentId === item.id ? (
              <form
                className="plan-child-form"
                style={{ paddingLeft: `${18 + Math.min(depth + 1, 6) * 24}px` }}
                onSubmit={createChild}
              >
                <span>↳</span>
                <input
                  autoFocus
                  value={childTitle}
                  maxLength={120}
                  placeholder={`“${item.title}”的子事项`}
                  onChange={(event) => setChildTitle(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") setChildParentId(null);
                  }}
                />
                <button type="submit">添加</button>
              </form>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}

function flattenPlanTree(items: PlanItem[]): TreeRow[] {
  const children = new Map<string | null, PlanItem[]>();
  for (const item of items) {
    const siblings = children.get(item.parentId) ?? [];
    siblings.push(item);
    children.set(item.parentId, siblings);
  }
  const rows: TreeRow[] = [];
  const visit = (parentId: string | null, depth: number) => {
    for (const item of children.get(parentId) ?? []) {
      rows.push({ item, depth });
      visit(item.id, depth + 1);
    }
  };
  visit(null, 0);
  return rows;
}
