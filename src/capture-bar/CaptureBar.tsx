import { FormEvent, type KeyboardEvent, useEffect, useRef, useState } from "react";
import { useServices } from "../application/services-context";
import { SparkIcon } from "../shared/icons";

const HIDE_AFTER_SAVE_MS = 650;

export function CaptureBar() {
  const { captures, desktop } = useServices();
  const [content, setContent] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const focusInput = () => inputRef.current?.focus();
    window.addEventListener("focus", focusInput);
    return () => window.removeEventListener("focus", focusInput);
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (state === "saving" || !content.trim()) return;
    try {
      setState("saving");
      setError(null);
      await captures.create(content);
      setContent("");
      setState("saved");
      window.setTimeout(async () => {
        setState("idle");
        await desktop.hideCaptureBar();
      }, HIDE_AFTER_SAVE_MS);
    } catch (cause) {
      setState("idle");
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }

  async function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setContent("");
      setError(null);
      await desktop.hideCaptureBar();
    }
  }

  return (
    <main className="capture-shell" data-tauri-drag-region>
      <form
        className={`capture-bar capture-bar--${state}`}
        onSubmit={submit}
        data-tauri-drag-region
      >
        <SparkIcon className="capture-bar__spark" aria-hidden="true" />
        {state === "saved" ? (
          <p className="capture-bar__confirmation">已放入稍后看</p>
        ) : (
          <input
            ref={inputRef}
            value={content}
            onChange={(event) => setContent(event.target.value)}
            onKeyDown={handleKeyDown}
            maxLength={500}
            placeholder="记下一个念头…"
            aria-label="记录念头"
            disabled={state === "saving"}
            spellCheck={false}
          />
        )}
        {state !== "saved" && content.trim() ? (
          <button type="submit" disabled={state === "saving"}>
            {state === "saving" ? "保存中" : "收下"}
          </button>
        ) : state !== "saved" ? (
          <kbd>↵</kbd>
        ) : null}
      </form>
      {error ? <p className="capture-error">{error}</p> : null}
    </main>
  );
}
