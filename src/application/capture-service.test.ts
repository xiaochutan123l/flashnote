import { describe, expect, it, vi } from "vitest";
import type { Capture } from "../domain/capture";
import type { CaptureGateway } from "./ports";
import { CaptureService } from "./capture-service";

function gateway(): CaptureGateway {
  const capture: Capture = {
    id: "capture-1",
    content: "稍后看看",
    status: "inbox",
    createdAt: 1,
    updatedAt: 1,
    processedAt: null,
  };
  return {
    create: vi.fn(async (content) => ({ ...capture, content })),
    list: vi.fn(async () => [capture]),
    update: vi.fn(async (_id, content) => ({ ...capture, content })),
    setStatus: vi.fn(async (_id, status) => ({ ...capture, status })),
    delete: vi.fn(async () => undefined),
    restore: vi.fn(async () => capture),
    subscribe: vi.fn(async () => () => undefined),
  };
}

describe("CaptureService", () => {
  it("normalizes input before calling infrastructure", async () => {
    const adapter = gateway();
    const service = new CaptureService(adapter);
    await service.create("  稍后   看看 ");
    expect(adapter.create).toHaveBeenCalledWith("稍后 看看");
  });

  it("expresses status transitions as named use cases", async () => {
    const adapter = gateway();
    const service = new CaptureService(adapter);
    await service.markProcessed("capture-1");
    await service.moveToInbox("capture-1");
    expect(adapter.setStatus).toHaveBeenNthCalledWith(1, "capture-1", "processed");
    expect(adapter.setStatus).toHaveBeenNthCalledWith(2, "capture-1", "inbox");
  });
});

