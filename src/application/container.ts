import { CaptureService } from "./capture-service";
import { PlanningService } from "./planning-service";
import type { DesktopGateway } from "./ports";
import {
  BrowserCaptureGateway,
  BrowserDesktopGateway,
  BrowserPlanningGateway,
} from "../infrastructure/browser-adapters";
import {
  TauriCaptureGateway,
  TauriDesktopGateway,
  TauriPlanningGateway,
} from "../infrastructure/tauri-adapters";

export interface AppServices {
  captures: CaptureService;
  planning: PlanningService;
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
  const planningGateway = tauri
    ? new TauriPlanningGateway()
    : new BrowserPlanningGateway();

  return {
    captures: new CaptureService(captureGateway),
    planning: new PlanningService(planningGateway),
    desktop: desktopGateway,
  };
}
