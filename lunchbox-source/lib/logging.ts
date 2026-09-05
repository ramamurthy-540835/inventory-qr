type LogContext = Record<string, string | number | boolean | null | undefined>;

function write(severity: "INFO" | "WARNING" | "ERROR", event: string, context: LogContext = {}) {
  const payload = { severity, event, timestamp: new Date().toISOString(), ...context };
  const line = JSON.stringify(payload);
  if (severity === "ERROR") console.error(line);
  else if (severity === "WARNING") console.warn(line);
  else console.log(line);
}

export function logInfo(event: string, context?: LogContext) { write("INFO", event, context); }
export function logWarning(event: string, context?: LogContext) { write("WARNING", event, context); }
export function logError(event: string, error: unknown, context: LogContext = {}) {
  write("ERROR", event, { ...context, errorName: error instanceof Error ? error.name : "UnknownError", errorMessage: error instanceof Error ? error.message : "Unknown error" });
}

export function requestId(request: Request) {
  return request.headers.get("X-Request-Id") || request.headers.get("X-Cloud-Trace-Context")?.split("/")[0] || crypto.randomUUID();
}
