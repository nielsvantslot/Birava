/**
 * Tracks whether the currently-mounted form holds content the user would
 * lose on a hard reload. ServiceWorkerRegistration checks this before
 * reloading the tab for a service worker takeover (see
 * ControllerChangeReloadGate) instead of reloading unconditionally and
 * silently discarding an in-progress check-in — a page component (currently
 * only CheckinForm) calls markDirty()/markClean() as its own draft state
 * changes; this class only tracks a boolean, it never inspects form
 * internals itself.
 */
export class FormDirtyTracker {
  private static dirty = false;
  private static onceCleanListeners: Array<() => void> = [];

  static markDirty(): void {
    FormDirtyTracker.dirty = true;
  }

  static markClean(): void {
    FormDirtyTracker.dirty = false;
    const listeners = FormDirtyTracker.onceCleanListeners;
    FormDirtyTracker.onceCleanListeners = [];
    listeners.forEach((listener) => listener());
  }

  static isDirty(): boolean {
    return FormDirtyTracker.dirty;
  }

  /**
   * Fires exactly once, the next time the form becomes clean (submitted,
   * cleared, or navigated away from). Used to finish a reload that was
   * deferred because the form was dirty at the moment a new service worker
   * took over, the instant it becomes safe to do so.
   */
  static onceClean(listener: () => void): void {
    FormDirtyTracker.onceCleanListeners.push(listener);
  }
}
