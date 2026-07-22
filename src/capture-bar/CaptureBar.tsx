import {
  FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { useServices } from "../application/services-context";
import { InboxIcon, SparkIcon } from "../shared/icons";
import {
  CaptureCollapseController,
  type CaptureCollapsePhase,
} from "./collapse-controller";

const HIDE_AFTER_SAVE_MS = 650;
type SaveState = "idle" | "saving" | "saved";

export function CaptureBar() {
  const { captures, desktop } = useServices();
  const [content, setContent] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [collapsePhase, setCollapsePhase] =
    useState<CaptureCollapsePhase>("expanded");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const hideTimeoutRef = useRef<number | null>(null);
  const collapseControllerRef = useRef<CaptureCollapseController | null>(null);

  if (!collapseControllerRef.current) {
    collapseControllerRef.current = new CaptureCollapseController(setCollapsePhase);
  }
  const collapseController = collapseControllerRef.current;

  useEffect(() => {
    inputRef.current?.focus();
    return () => {
      collapseController.dispose();
      clearHideTimeout();
    };
  }, [collapseController]);

  useEffect(() => {
    void desktop
      .setCaptureBarMode(collapsePhase === "collapsed" ? "collapsed" : "expanded")
      .catch((cause) => setError(formatError(cause)));
  }, [collapsePhase, desktop]);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let disposed = false;

    void desktop.subscribeCaptureBarActivation(() => {
      clearHideTimeout();
      collapseController.keepExpanded();
      setSaveState("idle");
      setError(null);
      window.requestAnimationFrame(() => inputRef.current?.focus());
    }).then((stop) => {
      if (disposed) stop();
      else unsubscribe = stop;
    });

    return () => {
      disposed = true;
      unsubscribe?.();
    };
  }, [collapseController, desktop]);

  useEffect(() => {
    function handleWindowKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        clearHideTimeout();
        collapseController.keepExpanded();
        setContent("");
        setError(null);
        void desktop.hideCaptureBar();
        return;
      }

      if (saveState !== "saved") return;
      if (event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        beginNewCapture(event.key);
      } else if (event.key === "Backspace" || event.key === "Enter") {
        event.preventDefault();
        beginNewCapture();
      }
    }

    window.addEventListener("keydown", handleWindowKeyDown);
    return () => window.removeEventListener("keydown", handleWindowKeyDown);
  }, [collapseController, desktop, saveState]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saveState === "saving" || !content.trim()) return;

    try {
      clearHideTimeout();
      collapseController.keepExpanded();
      setSaveState("saving");
      setError(null);
      await captures.create(content);
      setContent("");
      setSaveState("saved");

      const settings = await desktop.getSettings().catch(() => null);
      if (settings?.keepCaptureBarVisible) {
        collapseController.arm();
      } else {
        hideTimeoutRef.current = window.setTimeout(() => {
          hideTimeoutRef.current = null;
          setSaveState("idle");
          void desktop.hideCaptureBar();
        }, HIDE_AFTER_SAVE_MS);
      }
    } catch (cause) {
      collapseController.keepExpanded();
      setSaveState("idle");
      setError(formatError(cause));
    }
  }

  function beginNewCapture(initialContent = "") {
    clearHideTimeout();
    collapseController.keepExpanded();
    setSaveState("idle");
    setError(null);
    if (initialContent) setContent(initialContent);
    window.requestAnimationFrame(() => inputRef.current?.focus());
  }

  function handleContentChange(value: string) {
    setContent(value);
    setError(null);
    if (value) collapseController.keepExpanded();
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLFormElement>) {
    if (saveState !== "saved") return;
    if ((event.target as Element).closest("button")) return;
    beginNewCapture();
  }

  function handleInputKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") event.currentTarget.blur();
  }

  function expandFromDot() {
    setSaveState("idle");
    setError(null);
    collapseController.expandTemporarily();
  }

  async function startDragging() {
    clearHideTimeout();
    collapseController.keepExpanded();
    setSaveState("idle");
    setError(null);
    await desktop.startCaptureBarDrag().catch((cause) => setError(formatError(cause)));
  }

  async function openInbox() {
    const settings = await desktop.getSettings().catch(() => null);
    await desktop.openInbox();
    if (!settings?.keepCaptureBarVisible) {
      await desktop.hideCaptureBar();
    }
  }

  function clearHideTimeout() {
    if (hideTimeoutRef.current !== null) {
      window.clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
  }

  if (collapsePhase === "collapsed") {
    return (
      <main className="capture-shell capture-shell--collapsed">
        <button
          className="capture-dot"
          type="button"
          aria-label="展开快速记录"
          title="记下一个新念头"
          onPointerEnter={expandFromDot}
          onFocus={expandFromDot}
        >
          <SparkIcon aria-hidden="true" />
        </button>
      </main>
    );
  }

  return (
    <main className="capture-shell">
      <form
        className={`capture-bar capture-bar--${saveState}`}
        onSubmit={submit}
        onPointerMove={() => collapseController.noteActivity()}
        onPointerDown={handlePointerDown}
      >
        <button
          className="capture-bar__drag-handle"
          type="button"
          aria-label="拖动悬浮条"
          title="拖动到任意位置"
          onPointerDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
            void startDragging();
          }}
        >
          <span aria-hidden="true" />
        </button>
        <SparkIcon className="capture-bar__spark" aria-hidden="true" />

        {saveState === "saved" ? (
          <p className="capture-bar__confirmation">
            <strong>已记下</strong>
            <span>3 秒后收起</span>
          </p>
        ) : error ? (
          <p className="capture-bar__inline-error" onPointerDown={() => beginNewCapture()}>
            {error}
          </p>
        ) : (
          <input
            ref={inputRef}
            value={content}
            onChange={(event) => handleContentChange(event.target.value)}
            onKeyDown={handleInputKeyDown}
            onFocus={() => collapseController.keepExpanded()}
            maxLength={500}
            placeholder="记下一个新念头…"
            aria-label="记录念头"
            disabled={saveState === "saving"}
            spellCheck={false}
          />
        )}

        {saveState !== "saved" && !error && content.trim() ? (
          <button className="capture-bar__submit" type="submit" disabled={saveState === "saving"}>
            {saveState === "saving" ? "保存中" : "收下"}
          </button>
        ) : saveState === "idle" && !error ? (
          <kbd>↵</kbd>
        ) : null}

        <button
          className="capture-bar__inbox-button"
          type="button"
          aria-label="打开稍后看"
          title="打开稍后看"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => void openInbox()}
        >
          <InboxIcon />
        </button>
      </form>
    </main>
  );
}

function formatError(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}
