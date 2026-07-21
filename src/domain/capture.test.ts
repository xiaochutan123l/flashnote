import { describe, expect, it } from "vitest";
import { normalizeCaptureContent, validateCaptureContent } from "./capture";

describe("capture content", () => {
  it("normalizes whitespace before persistence", () => {
    expect(normalizeCaptureContent("  一个   新念头\n ")).toBe("一个 新念头");
  });

  it("rejects empty content", () => {
    expect(() => validateCaptureContent("  \n ")).toThrow("请输入要记录的内容");
  });
});

