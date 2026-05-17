import type { Response } from "express";

export function buildSseWriter(res: Response) {
  return (data: string) => {
    res.write(data);
  };
}

export function buildSseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export function sendProgress(
  write: (data: string) => void,
  stage: string,
  percent: number,
  detail: string,
  nodeId: string,
) {
  write(buildSseEvent("progress", { stage, percent, detail, nodeId }));
}

export function sendResult(
  write: (data: string) => void,
  resource: unknown,
  confidence?: number,
  riskAlerts?: string[],
) {
  write(buildSseEvent("result", { resource, confidence, riskAlerts }));
}

export function sendError(write: (data: string) => void, error: string, detail?: string) {
  write(buildSseEvent("error", { error, detail }));
}

export function sendFallback(write: (data: string) => void, message: string) {
  write(buildSseEvent("fallback", { message }));
}

export function sendDone(write: (data: string) => void, message: string) {
  write(buildSseEvent("done", { message }));
}
