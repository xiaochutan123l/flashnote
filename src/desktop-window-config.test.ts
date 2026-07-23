import { describe, expect, it } from "vitest";
import tauriConfig from "../src-tauri/tauri.conf.json";

describe("desktop window configuration", () => {
  it("keeps the capture window genuinely transparent on macOS and Windows", () => {
    const captureWindow = tauriConfig.app.windows.find(
      (window) => window.label === "capture",
    );

    expect(tauriConfig.app.macOSPrivateApi).toBe(true);
    expect(captureWindow).toMatchObject({
      transparent: true,
      backgroundColor: "#00000000",
      decorations: false,
      shadow: false,
    });
  });
});
