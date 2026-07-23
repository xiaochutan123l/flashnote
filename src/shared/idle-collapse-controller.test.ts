import { afterEach, describe, expect, it, vi } from "vitest";
import { IdleCollapseController } from "./idle-collapse-controller";

afterEach(() => {
  vi.useRealTimers();
});

function persistentController(phases: string[], delayMs = 3_000) {
  const controller = new IdleCollapseController((phase) => phases.push(phase));
  controller.configure({ enabled: true, delayMs });
  return controller;
}

describe("IdleCollapseController", () => {
  it("collapses after pointer and focus are both outside for the configured delay", () => {
    vi.useFakeTimers();
    const phases: string[] = [];
    const controller = persistentController(phases);

    vi.advanceTimersByTime(2_999);
    expect(phases).toEqual(["pending"]);

    vi.advanceTimersByTime(1);
    expect(phases).toEqual(["pending", "collapsed"]);
  });

  it("keeps the bar expanded while either pointer or focus remains inside", () => {
    vi.useFakeTimers();
    const phases: string[] = [];
    const controller = persistentController(phases);

    controller.setPointerInside(true);
    controller.setFocusWithin(true);
    controller.setPointerInside(false);
    vi.advanceTimersByTime(5_000);
    expect(phases.at(-1)).toBe("expanded");

    controller.setFocusWithin(false);
    vi.advanceTimersByTime(3_000);
    expect(phases.at(-1)).toBe("collapsed");
  });

  it("cancels the deadline and expands immediately when the pointer returns", () => {
    vi.useFakeTimers();
    const phases: string[] = [];
    const controller = persistentController(phases);

    vi.advanceTimersByTime(2_500);
    controller.setPointerInside(true);
    vi.advanceTimersByTime(3_000);
    expect(phases.at(-1)).toBe("expanded");

    controller.setPointerInside(false);
    vi.advanceTimersByTime(3_000);
    expect(phases.at(-1)).toBe("collapsed");
  });

  it("does not collapse when the preference is disabled", () => {
    vi.useFakeTimers();
    const phases: string[] = [];
    const controller = new IdleCollapseController((phase) => phases.push(phase));

    controller.configure({ enabled: false, delayMs: 1_000 });
    vi.advanceTimersByTime(10_000);

    expect(phases).toEqual([]);
  });

  it("expands an already collapsed bar when automatic collapsing is disabled", () => {
    vi.useFakeTimers();
    const phases: string[] = [];
    const controller = persistentController(phases, 1_000);
    vi.advanceTimersByTime(1_000);

    controller.configure({ enabled: false, delayMs: 1_000 });

    expect(phases.at(-1)).toBe("expanded");
  });

  it("restarts a pending deadline when the configured delay changes", () => {
    vi.useFakeTimers();
    const phases: string[] = [];
    const controller = persistentController(phases, 3_000);

    vi.advanceTimersByTime(2_000);
    controller.configure({ enabled: true, delayMs: 5_000 });
    vi.advanceTimersByTime(4_999);
    expect(phases.at(-1)).toBe("pending");

    vi.advanceTimersByTime(1);
    expect(phases.at(-1)).toBe("collapsed");
  });

  it("force-expands for a shortcut activation without coupling to save", () => {
    vi.useFakeTimers();
    const phases: string[] = [];
    const controller = persistentController(phases, 1_000);
    vi.advanceTimersByTime(1_000);

    controller.forceExpanded();
    expect(phases.at(-1)).toBe("expanded");
  });
});
