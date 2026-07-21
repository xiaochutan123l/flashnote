import { CaptureService } from "./capture-service";
import type { DesktopGateway } from "./ports";
import {
  BrowserCaptureGateway,
  BrowserDesktopGateway,
} from "../infrastructure/browser-adapters";
import {
  TauriCaptureGateway,
  TauriDesktopGateway,
} from "../infrastructure/tauri-adapters";

export interface AppServices {
  captures: CaptureService;
  desktop: DesktopGateway;
}

function isTauriRuntime(): boolean {
  return "__TAURI_INTERNALS__" in window;
}

/** Composition root: the only place that chooses concrete infrastructure. */
export function createAppServices(): AppServices {
  const tauri = isTauriRuntime();
  const captureGateway = tauri
    ? new TauriCaptureGateway()
    : new BrowserCaptureGateway();
  const desktopGateway = tauri
    ? new TauriDesktopGateway()
    : new BrowserDesktopGateway();

  return {
    captures: new CaptureService(captureGateway),
    desktop: desktopGateway,
  };
}

