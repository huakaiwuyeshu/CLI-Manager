export type TerminalExitNotificationState =
  | "none"
  | "running"
  | "attention"
  | "done"
  | "failed";

export interface TerminalExitTaskCandidate {
  kind?: string | null;
  processStatus?: string | null;
  mergedStatus?: TerminalExitNotificationState | null;
  hookStatus?: TerminalExitNotificationState | null;
}

export function shouldIncludeTerminalExitTask(
  candidate: TerminalExitTaskCandidate,
  includeFinished = false
): boolean {
  if (candidate.kind && candidate.kind !== "pty") return false;

  if (candidate.processStatus === "running" && candidate.mergedStatus === "running") {
    return true;
  }

  if (!includeFinished) return false;

  return candidate.hookStatus === "done" || candidate.hookStatus === "failed";
}
