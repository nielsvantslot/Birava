const EVENT_NAME = "birava:sw-update-pending";

/**
 * Fired when a new service worker has taken over the tab (see
 * ControllerChangeReloadGate) but the reload was deferred because
 * FormDirtyTracker.isDirty() said there was unsaved input on screen.
 * UpdateAvailableBanner subscribes to this to let the user finish the
 * reload on their own terms instead of it happening invisibly whenever the
 * form eventually goes clean.
 */
export class UpdateAvailableSignal {
  private static pending = false;

  static markPending(): void {
    UpdateAvailableSignal.pending = true;
    window.dispatchEvent(new CustomEvent(EVENT_NAME));
  }

  /** For a listener that mounts after markPending() already fired once. */
  static isPending(): boolean {
    return UpdateAvailableSignal.pending;
  }

  static onPending(listener: () => void): () => void {
    window.addEventListener(EVENT_NAME, listener);
    return () => window.removeEventListener(EVENT_NAME, listener);
  }
}
