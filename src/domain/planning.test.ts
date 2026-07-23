import { describe, expect, it } from "vitest";
import {
  localDayKey,
  normalizePlanTitle,
  validateDailyNote,
} from "./planning";

describe("planning domain", () => {
  it("normalizes plan titles without changing journal formatting", () => {
    expect(normalizePlanTitle("  完成   第一版 ")).toBe("完成 第一版");
    expect(validateDailyNote(" 第一行\n第二行 ")).toBe("第一行\n第二行");
  });

  it("uses local calendar dates instead of UTC dates", () => {
    expect(localDayKey(new Date(2026, 6, 23, 23, 30))).toBe("2026-07-23");
  });
});
