import {
  type Capture,
  type CaptureFilter,
  type CaptureStatus,
  validateCaptureContent,
} from "../domain/capture";
import type { CaptureGateway } from "./ports";

/**
 * Application use cases for captures. Validation and workflow rules live here,
 * leaving React components focused on interaction and rendering.
 */
export class CaptureService {
  constructor(private readonly gateway: CaptureGateway) {}

  create(content: string): Promise<Capture> {
    return this.gateway.create(validateCaptureContent(content));
  }

  list(filter: CaptureFilter): Promise<Capture[]> {
    return this.gateway.list(filter);
  }

  update(id: string, content: string): Promise<Capture> {
    return this.gateway.update(id, validateCaptureContent(content));
  }

  markProcessed(id: string): Promise<Capture> {
    return this.gateway.setStatus(id, "processed");
  }

  moveToInbox(id: string): Promise<Capture> {
    return this.gateway.setStatus(id, "inbox");
  }

  delete(id: string): Promise<void> {
    return this.gateway.delete(id);
  }

  restore(id: string): Promise<Capture> {
    return this.gateway.restore(id);
  }

  subscribe(listener: () => void): Promise<() => void> {
    return this.gateway.subscribe(listener);
  }

  setStatus(id: string, status: CaptureStatus): Promise<Capture> {
    return this.gateway.setStatus(id, status);
  }
}

