export interface ICookieStore {
  get(name: string): { name: string; value: string } | undefined;
  set(name: string, value: string): void;
  delete(name: string): void;
  getAll(): Array<{ name: string; value: string }>;
}
