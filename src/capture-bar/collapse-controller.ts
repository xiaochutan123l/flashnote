export const CAPTURE_COLLAPSE_DELAY_MS = 3_000;

export type CaptureCollapsePhase = "expanded" | "pending" | "collapsed";

/**
 * Owns the inactivity timer independently from React and desktop APIs.
 *
 * Keeping the timer in a small controller makes the interaction deterministic:
 * UI activity can restart the deadline, typing can cancel it, and the component
 * can dispose every pending callback when its window is unloaded.
 */
export class CaptureCollapseController {
  private timeout: ReturnType<typeof setTimeout> | null = null;
  private phase: CaptureCollapsePhase = "expanded";

  constructor(
    private readonly onChange: (phase: CaptureCollapsePhase) => void,
    private readonly delayMs = CAPTURE_COLLAPSE_DELAY_MS,
  ) {}

  /** Starts (or restarts) the inactivity deadline. */
  arm(): void {
    this.clearTimer();
    this.setPhase("pending");
    this.timeout = globalThis.setTimeout(() => {
      this.timeout = null;
      this.setPhase("collapsed");
    }, this.delayMs);
  }

  /** Pointer or keyboard activity only extends an already active deadline. */
  noteActivity(): void {
    if (this.phase === "pending") this.arm();
  }

  /** Keeps the full input visible until a later save arms the timer again. */
  keepExpanded(): void {
    this.clearTimer();
    this.setPhase("expanded");
  }

  /** Hovering the dot expands it, then lets inactivity collapse it again. */
  expandTemporarily(): void {
    this.arm();
  }

  dispose(): void {
    this.clearTimer();
  }

  private clearTimer(): void {
    if (this.timeout !== null) {
      globalThis.clearTimeout(this.timeout);
      this.timeout = null;
    }
  }

  private setPhase(phase: CaptureCollapsePhase): void {
    this.phase = phase;
    this.onChange(phase);
  }
}
