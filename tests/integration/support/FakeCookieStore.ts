import type { ICookieStore } from "./ICookieStore";

/**
 * In-memory stand-in for Next.js's request-scoped `cookies()` store.
 * Integration tests call command/query functions directly (no real HTTP
 * request), so `next/headers`'s `cookies()`/`headers()` are mocked to use
 * this instead of throwing "called outside a request scope".
 */
export class FakeCookieStore implements ICookieStore {
  private readonly values = new Map<string, string>();

  get(name: string): { name: string; value: string } | undefined {
    const value = this.values.get(name);
    return value === undefined ? undefined : { name, value };
  }

  set(name: string, value: string): void {
    this.values.set(name, value);
  }

  delete(name: string): void {
    this.values.delete(name);
  }

  getAll(): Array<{ name: string; value: string }> {
    return [...this.values.entries()].map(([name, value]) => ({ name, value }));
  }
}
