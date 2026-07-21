/**
 * The capture domain is deliberately small. A capture is an unprocessed thought,
 * not a task. Task-specific concepts such as due dates and priorities belong in a
 * future task module and should reference a capture instead of extending this type.
 */
export type CaptureStatus = "inbox" | "processed";
export type CaptureFilter = "all" | CaptureStatus;

export interface Capture {
  id: string;
  content: string;
  status: CaptureStatus;
  createdAt: number;
  updatedAt: number;
  processedAt: number | null;
}

export const CAPTURE_CONTENT_LIMIT = 500;

/** Normalizes user input at the application boundary. */
export function normalizeCaptureContent(content: string): string {
  return content.trim().replace(/\s+/g, " ");
}

export function validateCaptureContent(content: string): string {
  const normalized = normalizeCaptureContent(content);
  if (!normalized) {
    throw new Error("请输入要记录的内容");
  }
  if ([...normalized].length > CAPTURE_CONTENT_LIMIT) {
    throw new Error(`内容不能超过 ${CAPTURE_CONTENT_LIMIT} 个字符`);
  }
  return normalized;
}

