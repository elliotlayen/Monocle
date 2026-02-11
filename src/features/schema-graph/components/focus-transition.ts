export interface FocusSnapshot {
  focusedTableId: string | null;
}

export type FocusTransition = "enter" | "exit" | "target-change" | "none";

export function isFocusSessionActive(
  focusedTableId: string | null | undefined
): boolean {
  return Boolean(focusedTableId);
}

export function getFocusTransition(
  previous: FocusSnapshot,
  next: FocusSnapshot
): FocusTransition {
  const previousActive = isFocusSessionActive(previous.focusedTableId);
  const nextActive = isFocusSessionActive(next.focusedTableId);

  if (!previousActive && nextActive) return "enter";
  if (previousActive && !nextActive) return "exit";
  if (
    previousActive &&
    nextActive &&
    previous.focusedTableId !== next.focusedTableId
  ) {
    return "target-change";
  }
  return "none";
}

export function shouldForceEdgeFlush(transition: FocusTransition): boolean {
  return transition === "enter" || transition === "exit" || transition === "target-change";
}
