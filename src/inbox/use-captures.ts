import { useCallback, useEffect, useState } from "react";
import type { Capture, CaptureFilter } from "../domain/capture";
import { useServices } from "../application/services-context";

/** Keeps the list synchronized with changes from either application window. */
export function useCaptures(filter: CaptureFilter) {
  const { captures: captureService } = useServices();
  const [captures, setCaptures] = useState<Capture[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setCaptures(await captureService.list(filter));
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLoading(false);
    }
  }, [captureService, filter]);

  useEffect(() => {
    void refresh();
    let dispose: (() => void) | undefined;
    void captureService.subscribe(() => void refresh()).then((unsubscribe) => {
      dispose = unsubscribe;
    });
    return () => dispose?.();
  }, [captureService, refresh]);

  return { captures, loading, error, refresh };
}

