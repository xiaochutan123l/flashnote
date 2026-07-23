import { useCallback, useEffect, useState } from "react";
import { useServices } from "../application/services-context";
import type {
  DailyNote,
  DailyRecord,
  FocusItem,
  PlanItem,
} from "../domain/planning";

export function useTodayPlanning(day: string) {
  const { planning } = useServices();
  const [plans, setPlans] = useState<PlanItem[]>([]);
  const [focusItems, setFocusItems] = useState<FocusItem[]>([]);
  const [note, setNote] = useState<DailyNote | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [nextPlans, nextFocus, nextNote] = await Promise.all([
        planning.listPlanItems(),
        planning.listFocusItems(day),
        planning.getDailyNote(day),
      ]);
      setPlans(nextPlans);
      setFocusItems(nextFocus);
      setNote(nextNote);
      setError(null);
    } catch (cause) {
      setError(formatError(cause));
    } finally {
      setLoading(false);
    }
  }, [day, planning]);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let disposed = false;
    void refresh();
    void planning.subscribe(() => void refresh()).then((stop) => {
      if (disposed) stop();
      else unsubscribe = stop;
    });
    return () => {
      disposed = true;
      unsubscribe?.();
    };
  }, [planning, refresh]);

  return { plans, focusItems, note, loading, error, refresh };
}

export function useDailyRecords() {
  const { planning } = useServices();
  const [records, setRecords] = useState<DailyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setRecords(await planning.listDailyRecords());
      setError(null);
    } catch (cause) {
      setError(formatError(cause));
    } finally {
      setLoading(false);
    }
  }, [planning]);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let disposed = false;
    void refresh();
    void planning.subscribe(() => void refresh()).then((stop) => {
      if (disposed) stop();
      else unsubscribe = stop;
    });
    return () => {
      disposed = true;
      unsubscribe?.();
    };
  }, [planning, refresh]);

  return { records, loading, error, refresh };
}

function formatError(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}
