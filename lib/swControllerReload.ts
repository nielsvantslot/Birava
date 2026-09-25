/**
 * sw.js's install/activate handlers call skipWaiting() + clients.claim()
 * (see its own CACHE_VERSION comment), so a newly-activated SW takes over an
 * already-open tab immediately and mid-session, with no navigation involved.
 * Left alone, the tab keeps running whatever JS bundle it hydrated with
 * while every subsequent request goes through a different SW/cache
 * generation — a latent Flight-shape mismatch risk for a long-lived PWA
 * session sitting through a deploy.
 *
 * Decides whether a `controllerchange` event should trigger a one-time
 * reload. The FIRST one a tab ever sees is the ordinary "just got installed"
 * case (this document loaded with no controller yet, so its own bundle and
 * the newly-claiming SW came from the same deploy — nothing stale) and is
 * skipped; every one after that means a SW that was already controlling
 * this tab just got replaced by a different one — a genuine takeover.
 * Deliberately not a one-time snapshot taken at construction: a second
 * deploy landing before this tab's own first (skipped) takeover must still
 * be caught, not just one that lands on a tab that already survived an
 * earlier reload.
 */
export class ControllerChangeReloadGate {
  private hasController: boolean;
  private reloaded = false;

  constructor(hadControllerAtConstruction: boolean) {
    this.hasController = hadControllerAtConstruction;
  }

  /**
   * Call on every `controllerchange` event. Returns true at most once ever —
   * the one time this tab should actually reload — so a caller can just
   * `if (gate.onControllerChange()) location.reload()` without its own
   * bookkeeping, and can never be made to reload twice no matter how many
   * events arrive.
   */
  onControllerChange(): boolean {
    if (this.reloaded) return false;
    if (!this.hasController) {
      this.hasController = true;
      return false;
    }
    this.reloaded = true;
    return true;
  }
}
