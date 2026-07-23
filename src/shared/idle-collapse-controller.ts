export const DEFAULT_IDLE_COLLAPSE_DELAY_MS = 3_000;

export type IdleCollapsePhase = "expanded" | "pending" | "collapsed";

export interface IdleCollapsePolicy {
  enabled: boolean;
  delayMs: number;
}

/**
 * Owns the pointer/focus-driven state shared by lightweight desktop windows.
 *
 * Business actions are intentionally absent. A window collapses only when the
 * pointer is outside and none of its controls has focus, keeping persistence
 * and presentation independent.
 */
export class IdleCollapseController {
  private timeout: ReturnType<typeof setTimeout> | null = null;
  private phase: IdleCollapsePhase = "expanded";
  private pointerInside = false;
  private focusWithin = false;
  private policy: IdleCollapsePolicy = {
    enabled: false,
    delayMs: DEFAULT_IDLE_COLLAPSE_DELAY_MS,
  };

  constructor(
    private readonly onChange: (phase: IdleCollapsePhase) => void,
  ) {}

  /** Applies persisted preferences and immediately reconciles the UI state. */
  configure(policy: IdleCollapsePolicy): void {
    const nextPolicy = {
      enabled: policy.enabled,
      delayMs: normalizeDelay(policy.delayMs),
    };
    const changed =
      nextPolicy.enabled !== this.policy.enabled ||
      nextPolicy.delayMs !== this.policy.delayMs;
    this.policy = nextPolicy;
    if (changed) this.clearTimer();
    this.reconcile();
  }

  /** Expands immediately on hover and cancels any pending deadline. */
  setPointerInside(pointerInside: boolean): void {
    this.pointerInside = pointerInside;
    this.reconcile();
  }

  /** Keyboard/input focus protects the window from collapsing while in use. */
  setFocusWithin(focusWithin: boolean): void {
    this.focusWithin = focusWithin;
    this.reconcile();
  }

  /**
   * Used by the global shortcut and tray activation.
   *
   * It does not arm a new deadline. The next pointer/focus transition decides
   * when collapsing is appropriate.
   */
  forceExpanded(): void {
    this.clearTimer();
    this.setPhase("expanded");
  }

  dispose(): void {
    this.clearTimer();
  }

  private reconcile(): void {
    if (!this.policy.enabled) {
      this.clearTimer();
      this.setPhase("expanded");
      return;
    }

    if (this.pointerInside || this.focusWithin) {
      this.clearTimer();
      this.setPhase("expanded");
      return;
    }

    if (this.phase === "collapsed" || this.timeout !== null) return;

    this.setPhase("pending");
    this.timeout = globalThis.setTimeout(() => {
      this.timeout = null;
      if (
        this.policy.enabled &&
        !this.pointerInside &&
        !this.focusWithin
      ) {
        this.setPhase("collapsed");
      }
    }, this.policy.delayMs);
  }

  private clearTimer(): void {
    if (this.timeout !== null) {
      globalThis.clearTimeout(this.timeout);
      this.timeout = null;
    }
  }

  private setPhase(phase: IdleCollapsePhase): void {
    if (this.phase === phase) return;
    this.phase = phase;
    this.onChange(phase);
  }
}

function normalizeDelay(delayMs: number): number {
  if (!Number.isFinite(delayMs)) return DEFAULT_IDLE_COLLAPSE_DELAY_MS;
  return Math.max(0, Math.round(delayMs));
}
