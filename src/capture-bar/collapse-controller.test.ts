import { afterEach, describe, expect, it, vi } from "vitest";
import { CaptureCollapseController } from "./collapse-controller";

afterEach(() => {
  vi.useRealTimers();
});

describe("CaptureCollapseController", () => {
  it("collapses after the inactivity deadline", () => {
    vi.useFakeTimers();
    const phases: string[] = [];
    const controller = new CaptureCollapseController((phase) => phases.push(phase));

    controller.arm();
    vi.advanceTimersByTime(2_999);
    expect(phases).toEqual(["pending"]);

    vi.advanceTimersByTime(1);
    expect(phases).toEqual(["pending", "collapsed"]);
  });

  it("restarts the deadline when the user is active", () => {
    vi.useFakeTimers();
    const phases: string[] = [];
    const controller = new CaptureCollapseController((phase) => phases.push(phase));

    controller.arm();
    vi.advanceTimersByTime(2_500);
    controller.noteActivity();
    vi.advanceTimersByTime(2_500);
    expect(phases.at(-1)).toBe("pending");

    vi.advanceTimersByTime(500);
    expect(phases.at(-1)).toBe("collapsed");
  });

  it("cancels collapsing when the user starts another capture", () => {
    vi.useFakeTimers();
    const phases: string[] = [];
    const controller = new CaptureCollapseController((phase) => phases.push(phase));

    controller.arm();
    controller.keepExpanded();
    vi.advanceTimersByTime(3_000);

    expect(phases.at(-1)).toBe("expanded");
  });
});
