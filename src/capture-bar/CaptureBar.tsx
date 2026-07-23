import {
  FormEvent,
  type FocusEvent as ReactFocusEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import type { AppSettings } from "../application/ports";
import { useServices } from "../application/services-context";
import { InboxIcon, SparkIcon } from "../shared/icons";
import {
  CaptureCollapseController,
  type CaptureCollapsePhase,
} from "./collapse-controller";

const HIDE_AFTER_SAVE_MS = 650;
const SAVED_FEEDBACK_MS = 1_000;
type SaveState = "idle" | "saving" | "saved";

export function CaptureBar() {
  const { captures, desktop } = useServices();
  const [content, setContent] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [collapsePhase, setCollapsePhase] =
    useState<CaptureCollapsePhase>("expanded");
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const settingsRef = useRef<AppSettings | null>(null);
  const hideTimeoutRef = useRef<number | null>(null);
  const feedbackTimeoutRef = useRef<number | null>(null);
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
      clearFeedbackTimeout();
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

    async function refreshSettings() {
      try {
        const settings = await desktop.getSettings();
        if (disposed) return;
        settingsRef.current = settings;
        collapseController.configure({
          enabled:
            settings.keepCaptureBarVisible &&
            settings.autoCollapseCaptureBar,
          delayMs: settings.captureBarCollapseDelayMs,
        });
      } catch (cause) {
        if (!disposed) setError(formatError(cause));
      }
    }

    void refreshSettings();
    void desktop.subscribeSettingsChange(refreshSettings).then((stop) => {
      if (disposed) stop();
      else unsubscribe = stop;
    });

    return () => {
      disposed = true;
      unsubscribe?.();
    };
  }, [collapseController, desktop]);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let disposed = false;

    void desktop
      .subscribeCaptureBarActivation(() => {
        clearHideTimeout();
        collapseController.forceExpanded();
        setSaveState("idle");
        setError(null);
        void desktop
          .getSettings()
          .then((settings) => {
            settingsRef.current = settings;
            collapseController.configure({
              enabled:
                settings.keepCaptureBarVisible &&
                settings.autoCollapseCaptureBar,
              delayMs: settings.captureBarCollapseDelayMs,
            });
          })
          .catch((cause) => setError(formatError(cause)));
        window.requestAnimationFrame(() => inputRef.current?.focus());
      })
      .then((stop) => {
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
      if (event.key !== "Escape") return;
      event.preventDefault();
      clearHideTimeout();
      clearFeedbackTimeout();
      collapseController.forceExpanded();
      setContent("");
      setSaveState("idle");
      setError(null);
      void desktop.hideCaptureBar();
    }

    window.addEventListener("keydown", handleWindowKeyDown);
    return () => window.removeEventListener("keydown", handleWindowKeyDown);
  }, [collapseController, desktop]);

  useEffect(() => {
    function handleWindowBlur() {
      collapseController.setFocusWithin(false);
    }

    window.addEventListener("blur", handleWindowBlur);
    return () => window.removeEventListener("blur", handleWindowBlur);
  }, [collapseController]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saveState === "saving" || !content.trim()) return;

    try {
      clearHideTimeout();
      clearFeedbackTimeout();
      setSaveState("saving");
      setError(null);
      await captures.create(content);
      setContent("");
      setSaveState("saved");
      window.requestAnimationFrame(syncFocusFromDocument);

      const settings =
        settingsRef.current ?? (await desktop.getSettings().catch(() => null));
      if (settings?.keepCaptureBarVisible) {
        feedbackTimeoutRef.current = window.setTimeout(() => {
          feedbackTimeoutRef.current = null;
          setSaveState("idle");
        }, SAVED_FEEDBACK_MS);
      } else {
        hideTimeoutRef.current = window.setTimeout(() => {
          hideTimeoutRef.current = null;
          setSaveState("idle");
          void desktop.hideCaptureBar();
        }, HIDE_AFTER_SAVE_MS);
      }
    } catch (cause) {
      setSaveState("idle");
      setError(formatError(cause));
    }
  }

  function handleContentChange(value: string) {
    clearFeedbackTimeout();
    setContent(value);
    setSaveState("idle");
    setError(null);
  }

  function handleInputKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") event.currentTarget.blur();
  }

  function handleFocus(event: ReactFocusEvent<HTMLFormElement>) {
    if (event.currentTarget.contains(event.target)) {
      collapseController.setFocusWithin(true);
    }
  }

  function handleBlur(event: ReactFocusEvent<HTMLFormElement>) {
    const nextTarget = event.relatedTarget;
    if (!nextTarget || !event.currentTarget.contains(nextTarget as Node)) {
      collapseController.setFocusWithin(false);
    }
  }

  function syncFocusFromDocument() {
    collapseController.setFocusWithin(
      Boolean(
        formRef.current &&
          document.activeElement &&
          formRef.current.contains(document.activeElement),
      ),
    );
  }

  async function startDragging() {
    clearHideTimeout();
    collapseController.forceExpanded();
    setError(null);
    await desktop.startCaptureBarDrag().catch((cause) => setError(formatError(cause)));
  }

  async function openInbox() {
    const settings =
      settingsRef.current ?? (await desktop.getSettings().catch(() => null));
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

  function clearFeedbackTimeout() {
    if (feedbackTimeoutRef.current !== null) {
      window.clearTimeout(feedbackTimeoutRef.current);
      feedbackTimeoutRef.current = null;
    }
  }

  if (collapsePhase === "collapsed") {
    return (
      <main className="capture-shell capture-shell--collapsed">
        <button
          className="capture-capsule"
          type="button"
          aria-label="展开快速记录"
          title="记下一个新念头"
          onPointerEnter={() => collapseController.setPointerInside(true)}
          onFocus={() => {
            collapseController.setFocusWithin(true);
            window.requestAnimationFrame(() => inputRef.current?.focus());
          }}
        >
          <SparkIcon aria-hidden="true" />
        </button>
      </main>
    );
  }

  return (
    <main className="capture-shell">
      <form
        ref={formRef}
        className={`capture-bar capture-bar--${saveState}`}
        onSubmit={submit}
        onPointerEnter={() => collapseController.setPointerInside(true)}
        onPointerLeave={() => collapseController.setPointerInside(false)}
        onFocusCapture={handleFocus}
        onBlurCapture={handleBlur}
      >
        <button
          className="capture-bar__drag-handle"
          type="button"
          aria-label="拖动悬浮条"
          title="拖动到任意位置"
          onPointerDown={(event: ReactPointerEvent<HTMLButtonElement>) => {
            event.preventDefault();
            event.stopPropagation();
            void startDragging();
          }}
        >
          <span aria-hidden="true" />
        </button>
        <SparkIcon className="capture-bar__spark" aria-hidden="true" />

        {error ? (
          <p
            className="capture-bar__inline-error"
            onPointerDown={() => {
              setError(null);
              window.requestAnimationFrame(() => inputRef.current?.focus());
            }}
          >
            {error}
          </p>
        ) : (
          <input
            ref={inputRef}
            value={content}
            onChange={(event) => handleContentChange(event.target.value)}
            onKeyDown={handleInputKeyDown}
            maxLength={500}
            placeholder={
              saveState === "saved"
                ? "已记下，可以继续记录…"
                : "记下一个新念头…"
            }
            aria-label="记录念头"
            disabled={saveState === "saving"}
            spellCheck={false}
          />
        )}

        {!error && content.trim() ? (
          <button
            className="capture-bar__submit"
            type="submit"
            disabled={saveState === "saving"}
          >
            {saveState === "saving" ? "保存中" : "收下"}
          </button>
        ) : saveState === "saved" ? (
          <span className="capture-bar__saved-status">已记下</span>
        ) : saveState === "idle" && !error ? (
          <kbd>↵</kbd>
        ) : null}

        <button
          className="capture-bar__inbox-button"
          type="button"
          aria-label="打开稍后看"
          title="打开稍后看"
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
